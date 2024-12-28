import os
import yaml
import google.generativeai as genai
from typing import Dict, List, Any, Optional
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class LLMInterface:
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize LLM interface with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)['llm']
        
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
        formatted = """Available functions:

When you need to call a function, use the following format:
FUNCTION_CALL: <function_name>
ARGS:
- <arg_name>: <arg_value>
END_FUNCTION_CALL

IMPORTANT: Make sure to call ALL necessary functions to complete the task. Do not stop after the first function call.
After each function call, explain what you'll do next and make the next function call.

Available functions:
"""
        for func in functions:
            formatted += f"\n{func['name']}\n"
            formatted += f"Description: {func['description']}\n"
            formatted += "Parameters:\n"
            for param_name, param_info in func['parameters'].items():
                formatted += f"  - {param_name}: {param_info['type']} - {param_info['description']}\n"
            formatted += "\n"
        return formatted

    def format_messages(self, system: str, user: str, functions: Optional[List[Dict[str, Any]]] = None) -> str:
        """Format messages for Gemini's chat format"""
        context = [
            system,
            "Important: When you need to call functions, use them explicitly with the FUNCTION_CALL format.",
            "Make sure to call ALL necessary functions to complete the task. Do not stop after the first function call.",
            "After each function call, explain what you'll do next and make the next function call."
        ]
        if functions:
            context.append(self.format_function_calls(functions))
        context.append(f"User request: {user}")
        context.append("\nProvide your response and make any necessary function calls using the specified format.")
        return "\n\n".join(context)

    async def generate_response(self, 
                              system_prompt: str,
                              user_prompt: str,
                              available_functions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate a response using Gemini"""
        try:
            formatted_prompt = self.format_messages(system_prompt, user_prompt, available_functions)
            logger.info(f"Formatted prompt:\n{formatted_prompt}")
            
            response = await self.model.generate_content_async(formatted_prompt)
            logger.info(f"Raw response:\n{response.text}")
            
            # Parse the response to extract function calls
            parsed_response = self.parse_response(response.text)
            logger.info(f"Parsed response:\n{parsed_response}")
            
            return {
                'response': response.text,
                'function_calls': parsed_response.get('function_calls', []),
                'content': parsed_response.get('content', '')
            }
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
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