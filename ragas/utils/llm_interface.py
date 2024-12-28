import os
import yaml
import google.generativeai as genai
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class LLMInterface:
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize LLM interface with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)['llm']
        
        # Configure Gemini
        genai.configure(api_key=os.getenv('GOOGLE_API_KEY', self.config['api_key']))
        
        # Set up the model
        generation_config = {
            'temperature': self.config['temperature'],
            'top_p': self.config['top_p'],
            'top_k': self.config['top_k'],
            'max_output_tokens': self.config['max_output_tokens'],
        }
        
        safety_settings = {
            setting: {'block_none'} for setting in self.config['safety_settings']
        }
        
        self.model = genai.GenerativeModel(
            model_name=self.config['model_name'],
            generation_config=generation_config,
            safety_settings=safety_settings
        )

    def format_function_calls(self, functions: List[Dict[str, Any]]) -> str:
        """Format function definitions for Gemini's context"""
        formatted = "Available functions:\n\n"
        for func in functions:
            formatted += f"Function: {func['name']}\n"
            formatted += f"Description: {func['description']}\n"
            formatted += "Parameters:\n"
            for param_name, param_info in func['parameters'].items():
                formatted += f"  - {param_name}: {param_info['type']} - {param_info['description']}\n"
            formatted += "\n"
        return formatted

    def format_messages(self, system: str, user: str, functions: Optional[List[Dict[str, Any]]] = None) -> str:
        """Format messages for Gemini's chat format"""
        context = [system]
        if functions:
            context.append(self.format_function_calls(functions))
        context.append(f"User request: {user}")
        return "\n\n".join(context)

    async def generate_response(self, 
                              system_prompt: str,
                              user_prompt: str,
                              available_functions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate a response using Gemini"""
        try:
            formatted_prompt = self.format_messages(system_prompt, user_prompt, available_functions)
            
            response = await self.model.generate_content_async(formatted_prompt)
            
            # Parse the response to extract function calls
            parsed_response = self.parse_response(response.text)
            
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
            content = response_text
            
            # Look for function call patterns
            if "Function call:" in response_text:
                parts = response_text.split("Function call:")
                content = parts[0].strip()
                
                for part in parts[1:]:
                    # Parse function name and arguments
                    lines = part.strip().split("\n")
                    func_name = lines[0].strip()
                    args = {}
                    
                    for line in lines[1:]:
                        if ":" in line:
                            key, value = line.split(":", 1)
                            args[key.strip()] = value.strip()
                    
                    function_calls.append({
                        'name': func_name,
                        'args': args
                    })
            
            return {
                'function_calls': function_calls,
                'content': content
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