import os
import yaml
import google.generativeai as genai
from typing import Dict, List, Any, Optional
import logging
from dotenv import load_dotenv
import asyncio
import re

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class LLMInterface:
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize LLM interface with configuration"""
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            self.config = config['llm']
            self.prompts = self.config['prompts']
        
        # Configure Gemini
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        genai.configure(api_key=api_key)
        
        # Set up the model
        generation_config = {
            'temperature': float(os.getenv('TEMPERATURE', self.config['temperature'])),
            'top_p': float(os.getenv('TOP_P', self.config['top_p'])),
            'top_k': int(os.getenv('TOP_K', self.config['top_k'])),
            'max_output_tokens': int(os.getenv('MAX_OUTPUT_TOKENS', self.config['max_output_tokens'])),
        }
        
        safety_settings = [
            {
                "category": setting,
                "threshold": "BLOCK_NONE"
            }
            for setting in self.config['safety_settings']
        ]
        
        model_name = os.getenv('MODEL_NAME', self.config['model_name'])
        self.model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=generation_config,
            safety_settings=safety_settings
        )

    def format_function_calls(self, functions: List[Dict[str, Any]]) -> str:
        """Format function definitions for Gemini's context"""
        functions_str = ""
        for func in functions:
            functions_str += f"\n{func['name']}\n"
            functions_str += f"Description: {func['description']}\n"
            functions_str += "Parameters:\n"
            for param_name, param_info in func['parameters'].items():
                functions_str += f"  - {param_name}: {param_info['type']} - {param_info['description']}\n"
            functions_str += "\n"
        
        return self.prompts['function_format'].format(functions=functions_str)

    def format_messages(self, system: str, user: str, context: Optional[str] = None, functions: Optional[List[Dict[str, Any]]] = None) -> str:
        """Format messages for Gemini's chat format"""
        format_vars = {
            "system": system,
            "user": user,
            "context": context if context else "No additional context provided.",
            "functions": self.format_function_calls(functions) if functions else ""
        }
        
        return "\n\n".join(
            line.format(**format_vars) 
            for line in self.prompts['message_format']
        )

    def parse_evaluation_response(self, response_text: str) -> float:
        """Parse evaluation response to extract numerical score"""
        try:
            # Clean up the response text
            cleaned_text = response_text.strip()
            
            # If it's a single number, try to parse it directly
            try:
                score = float(cleaned_text)
                return min(max(score, 0), 1)  # Clamp between 0 and 1
            except ValueError:
                pass
            
            # Extract the first number found in the response
            numbers = re.findall(r"0\.\d+|\d+\.?\d*", cleaned_text)
            if numbers:
                score = float(numbers[0])
                return min(max(score, 0), 1)  # Clamp between 0 and 1
            
            logger.warning(f"No valid numerical score found in response: {cleaned_text}")
            return 0  # Default to 0 if no valid number found
            
        except Exception as e:
            logger.error(f"Error parsing evaluation response: {str(e)}")
            return 0

    async def generate_response(self, 
                              system_prompt: str,
                              user_prompt: str,
                              context: Optional[str] = None,
                              available_functions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate a response using Gemini"""
        max_retries = 3
        retry_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                # For evaluation prompts, use a simpler prompt format
                if "evaluate" in system_prompt.lower():
                    formatted_prompt = self.prompts['evaluation'].format(user_prompt=user_prompt)
                else:
                    formatted_prompt = self.format_messages(system_prompt, user_prompt, context, available_functions)
                
                logger.info(f"Formatted prompt:\n{formatted_prompt}")
                
                response = await self.model.generate_content_async(formatted_prompt)
                logger.info(f"Raw response:\n{response.text}")
                
                # For evaluation responses, extract just the numerical value
                if "evaluate" in system_prompt.lower():
                    score = self.parse_evaluation_response(response.text)
                    return {
                        'response': str(score),
                        'function_calls': [],
                        'content': str(score)
                    }
                
                # For regular responses, parse function calls
                parsed_response = self.parse_response(response.text)
                logger.info(f"Parsed response:\n{parsed_response}")
                
                return {
                    'response': response.text,
                    'function_calls': parsed_response.get('function_calls', []),
                    'content': parsed_response.get('content', '')
                }
                
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    logger.warning(f"Rate limit hit, retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                logger.error(f"Error generating response: {str(e)}")
                if "evaluate" in system_prompt.lower():
                    return {
                        'response': '0',
                        'function_calls': [],
                        'content': '0'
                    }
                raise

    def parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini's response to extract function calls and content"""
        try:
            # Split response into function calls and content
            function_calls = []
            content = []
            
            # Split by function call blocks
            parts = response_text.split("FUNCTION_CALL:")
            
            # First part is always content
            if parts[0].strip():
                content.append(parts[0].strip())
            
            # Process function calls
            for part in parts[1:]:
                if "END_FUNCTION_CALL" not in part:
                    content.append(part.strip())
                    continue
                
                func_part, remaining = part.split("END_FUNCTION_CALL", 1)
                if remaining.strip():
                    content.append(remaining.strip())
                
                # Parse function name and arguments
                lines = [line.strip() for line in func_part.split("\n") if line.strip()]
                if not lines:
                    continue
                
                func_name = lines[0].strip()
                args = {}
                
                # Find the ARGS: section
                try:
                    args_idx = lines.index("ARGS:")
                    for arg_line in lines[args_idx + 1:]:
                        if arg_line.startswith("-"):
                            arg_line = arg_line[1:].strip()
                            if ":" in arg_line:
                                key, value = arg_line.split(":", 1)
                                args[key.strip()] = value.strip()
                except ValueError:
                    # No ARGS: section found
                    pass
                
                function_calls.append({
                    'name': func_name,
                    'args': args
                })
            
            return {
                'function_calls': function_calls,
                'content': "\n".join(content)
            }
            
        except Exception as e:
            logger.error(f"Error parsing response: {str(e)}")
            raise

    def validate_function_call(self, function_call: Dict[str, Any], function_spec: Dict[str, Any]) -> bool:
        """Validate a function call against its specification"""
        try:
            # Check function name
            if function_call['name'] != function_spec['name']:
                return False
                
            # Check required parameters
            required_params = {
                name for name, param in function_spec['parameters'].items()
                if param.get('required', True)
            }
            
            if not all(param in function_call['args'] for param in required_params):
                return False
                
            # Validate parameter types
            for param_name, param_value in function_call['args'].items():
                if param_name in function_spec['parameters']:
                    param_type = function_spec['parameters'][param_name]['type']
                    if not self.validate_type(param_value, param_type):
                        return False
                        
            return True
            
        except Exception as e:
            logger.error(f"Error validating function call: {str(e)}")
            return False

    def validate_type(self, value: Any, expected_type: str) -> bool:
        """Validate a value against an expected type"""
        try:
            if expected_type == 'string':
                return isinstance(value, str)
            elif expected_type == 'number':
                return isinstance(value, (int, float))
            elif expected_type == 'array':
                return isinstance(value, list)
            elif expected_type == 'object':
                return isinstance(value, dict)
            elif expected_type == 'boolean':
                return isinstance(value, bool)
            else:
                return True  # Allow unknown types
        except Exception:
            return False 