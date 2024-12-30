import os
import yaml
import aiohttp
from typing import Dict, List, Any, Optional
import logging
from dotenv import load_dotenv
import asyncio
import re
import json

# Load environment variables
load_dotenv()

def get_agent_logger(agent_type: str) -> logging.Logger:
    """Get or create a logger for the specific agent type"""
    logger = logging.getLogger(f"{agent_type}_agent")
    
    # Only add handlers if they don't exist
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)
        
        # Create handlers
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        file_handler = logging.FileHandler(os.path.join(log_dir, f'{agent_type}_agent.log'))
        console_handler = logging.StreamHandler()
        
        # Create formatters
        file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_formatter = logging.Formatter('%(levelname)s: %(message)s')
        
        # Set formatters
        file_handler.setFormatter(file_formatter)
        console_handler.setFormatter(console_formatter)
        
        # Set levels
        file_handler.setLevel(logging.DEBUG)
        console_handler.setLevel(logging.INFO)
        
        # Add handlers
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
    
    return logger

class LLMInterface:
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize LLM interface with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            self.llm_config = self.config['llm']
            self.prompts = self.config['prompts']
        
        # Configure OpenRouter
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable not set")
        
        # Use config values directly
        self.api_base = self.llm_config['api_base']
        self.model = self.llm_config['model']
        
        # Set up generation config from config values
        self.generation_config = {
            'temperature': self.llm_config['temperature'],
            'max_tokens': self.llm_config['max_tokens'],
        }

    def format_messages(self, system_prompt: str, user_prompt: str, context: str = None, available_functions: List[Dict[str, Any]] = None) -> str:
        """Format messages for the LLM"""
        formatted_prompt = system_prompt + "\n\n"
        
        if context:
            formatted_prompt += f"Context:\n{context}\n\n"
            
        if available_functions:
            formatted_prompt += "Available functions:\n"
            for func in available_functions:
                formatted_prompt += f"- {func['name']}: {func['description']}\n"
                if 'parameters' in func:
                    formatted_prompt += "  Parameters:\n"
                    for param_name, param_info in func['parameters'].items():
                        formatted_prompt += f"  - {param_name}: {param_info.get('description', '')}\n"
            formatted_prompt += "\n"
            
        formatted_prompt += f"User query: {user_prompt}"
        return formatted_prompt

    async def _make_api_request(self, messages: List[Dict[str, str]], agent_type: str) -> Dict[str, Any]:
        """Make API request to OpenRouter"""
        logger = get_agent_logger(agent_type)
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/rickwong/rag-system',
        }
        
        data = {
            'model': self.model,
            'messages': messages,
            **self.generation_config
        }
        
        logger.info("Making API request:")
        logger.info(f"Model: {self.model}")
        logger.info(f"Messages:\n{json.dumps(messages, indent=2)}")
        logger.info(f"Generation config:\n{json.dumps(self.generation_config, indent=2)}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"API request failed with status {response.status}:")
                    logger.error(error_text)
                    raise Exception(f"API request failed: {error_text}")
                    
                response_json = await response.json()
                logger.info("Received API response:")
                logger.info(json.dumps(response_json, indent=2))
                
                if 'choices' not in response_json:
                    raise Exception(f"Unexpected response format: {response_json}")
                return {
                    'choices': [{
                        'message': {
                            'content': response_json['choices'][0]['message']['content']
                        }
                    }]
                }

    def parse_evaluation_response(self, response_text: str, agent_type: str) -> float:
        """Parse evaluation response to extract numerical score"""
        logger = get_agent_logger(agent_type)
        try:
            logger.info(f"Parsing evaluation response: {response_text}")
            
            # Clean up the response text
            cleaned_text = response_text.strip()
            logger.info(f"Cleaned text: {cleaned_text}")
            
            # If it's a single number, try to parse it directly
            try:
                score = float(cleaned_text)
                logger.info(f"Successfully parsed direct float: {score}")
                return min(max(score, 0), 1)  # Clamp between 0 and 1
            except ValueError:
                logger.info("Failed to parse as direct float, trying regex")
            
            # Extract the first number found in the response
            numbers = re.findall(r"0\.\d+|\d+\.?\d*", cleaned_text)
            if numbers:
                logger.info(f"Found numbers via regex: {numbers}")
                score = float(numbers[0])
                clamped_score = min(max(score, 0), 1)
                logger.info(f"Using first number: {score} (clamped: {clamped_score})")
                return clamped_score
            
            logger.warning(f"No valid numerical score found in response: {cleaned_text}")
            return 0  # Default to 0 if no valid number found
            
        except Exception as e:
            logger.error(f"Error parsing evaluation response: {str(e)}")
            return 0

    async def generate_response(self, 
                              system_prompt: str,
                              user_prompt: str,
                              context: Optional[str] = None,
                              available_functions: Optional[List[Dict[str, Any]]] = None,
                              agent_type: str = "default") -> Dict[str, Any]:
        """Generate a response using OpenRouter"""
        logger = get_agent_logger(agent_type)
        max_retries = 5
        base_delay = 5
        
        for attempt in range(max_retries):
            try:
                logger.info(f"\n{'='*50}\nGenerate Response Attempt {attempt + 1}/{max_retries}")
                logger.info(f"System prompt: {system_prompt}")
                logger.info(f"User prompt: {user_prompt}")
                if context:
                    logger.info(f"Context: {context}")
                if available_functions:
                    logger.info(f"Available functions: {json.dumps(available_functions, indent=2)}")
                
                # Format messages for chat API
                messages = []
                
                # Add system message
                if "evaluate" in system_prompt.lower():
                    messages.append({
                        "role": "system",
                        "content": "You are an evaluation system. Provide numerical scores between 0 and 1. Return ONLY the number, with no additional text or explanation."
                    })
                    messages.append({
                        "role": "user",
                        "content": user_prompt
                    })
                else:
                    try:
                        formatted_prompt = self.format_messages(system_prompt, user_prompt, context, available_functions)
                        logger.info(f"Formatted prompt:\n{formatted_prompt}")
                        messages.append({
                            "role": "system",
                            "content": formatted_prompt
                        })
                    except Exception as e:
                        logger.error(f"Error formatting messages: {str(e)}")
                        logger.error(f"system_prompt: {system_prompt}")
                        logger.error(f"user_prompt: {user_prompt}")
                        logger.error(f"context: {context}")
                        logger.error(f"available_functions: {available_functions}")
                        raise
                
                try:
                    response = await self._make_api_request(messages, agent_type)
                    response_text = response['choices'][0]['message']['content']
                except Exception as e:
                    if "429" in str(e) or "Resource exhausted" in str(e):
                        if attempt < max_retries - 1:
                            retry_delay = base_delay * (2 ** attempt)
                            logger.warning(f"Rate limit hit, retrying in {retry_delay} seconds...")
                            await asyncio.sleep(retry_delay)
                            continue
                    logger.error(f"Error generating content: {str(e)}")
                    if "evaluate" in system_prompt.lower():
                        return {'content': '0.0', 'function_calls': []}
                    raise
                
                # For evaluation responses, extract just the numerical value
                if "evaluate" in system_prompt.lower():
                    score = self.parse_evaluation_response(response_text, agent_type)
                    return {
                        'content': str(score),
                        'function_calls': []
                    }
                
                # For regular responses, parse function calls
                try:
                    parsed_response = self.parse_response(response_text)
                except Exception as e:
                    logger.error(f"Error parsing response: {str(e)}")
                    logger.error(f"Response text: {response_text}")
                    raise
                
                return {
                    'content': parsed_response.get('content', ''),
                    'function_calls': parsed_response.get('function_calls', [])
                }
                
            except Exception as e:
                if attempt < max_retries - 1:
                    retry_delay = base_delay * (2 ** attempt)
                    logger.warning(f"Error occurred, retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                    continue
                logger.error(f"Error generating response: {str(e)}")
                if "evaluate" in system_prompt.lower():
                    return {'content': '0.0', 'function_calls': []}
                raise

    def parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini's response to extract function calls and content"""
        try:
            # Extract JSON from the response if it exists
            json_match = re.search(r'```json\n(.*?)\n```', response_text, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(1)
                try:
                    parsed_json = json.loads(json_str)
                    if isinstance(parsed_json, dict) and 'function_calls' in parsed_json:
                        return {
                            'function_calls': parsed_json['function_calls'],
                            'content': response_text
                        }
                except json.JSONDecodeError:
                    pass
            
            # Fallback to original parsing logic for non-JSON responses
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
            return {
                'function_calls': [],
                'content': response_text
            }

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

    async def get_routing_decision(self, query: str, context: str = '') -> Dict[str, Any]:
        """Get routing decision from the LLM for a given query"""
        system_prompt = self.prompts['routing_evaluation']
        user_prompt = f"Query: {query}\nContext: {context}"
        
        response = await self.generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            context=context,
            agent_type="routing"
        )
        
        return response 