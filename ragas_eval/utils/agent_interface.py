# utils/agent_interface.py
import os
import yaml
import logging
from typing import Dict, Any, List, Union, Optional
from .llm_interface import LLMInterface

logger = logging.getLogger(__name__)

class AgentInterface:
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize agent interface with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.llm = LLMInterface(config_path)
    
    def validate_parameter_type(self, value: Any, param_spec: Dict[str, Any]) -> bool:
        """Validate parameter type against specification"""
        param_type = param_spec['type']
        
        if param_type == 'string':
            return isinstance(value, str)
        elif param_type == 'integer':
            return isinstance(value, int)
        elif param_type == 'array':
            if not isinstance(value, list):
                return False
            # Validate array items if type is specified
            if 'items' in param_spec:
                return all(self.validate_parameter_type(item, param_spec['items']) for item in value)
            return True
        elif param_type == 'object':
            return isinstance(value, dict)
        return False

    def validate_function_call(self, function_call: Dict[str, Any], function_spec: Dict[str, Any]) -> bool:
        """Validate function call against its specification"""
        try:
            # Check required parameters
            required_params = {
                name for name, param in function_spec['parameters'].items()
                if param.get('required', True)
            }
            
            if not all(param in function_call['args'] for param in required_params):
                logger.error(f"Missing required parameters: {required_params - set(function_call['args'].keys())}")
                return False
            
            # Validate parameter types
            for param_name, param_value in function_call['args'].items():
                if param_name in function_spec['parameters']:
                    param_spec = function_spec['parameters'][param_name]
                    if not self.validate_parameter_type(param_value, param_spec):
                        logger.error(f"Invalid type for parameter {param_name}: expected {param_spec['type']}")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating function call: {str(e)}")
            return False
        
    async def call_agent(self, agent_type: str, query: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Call a specific agent with a query and context"""
        try:
            # Get agent configuration
            agent_config = self.config['prompts'].get(f"{agent_type}_agent")
            if not agent_config:
                raise ValueError(f"Unknown agent type: {agent_type}")
            
            # Get system prompt and functions
            system_prompt = f"{self.config['prompts']['system_context']}\n{agent_config['instruction']}"
            available_functions = [
                {**func_def, 'name': func_name}
                for func_name, func_def in agent_config.get('functions', {}).items()
            ]
            
            # Generate response with context
            response = await self.llm.generate_response(
                system_prompt=system_prompt,
                user_prompt=query,
                context=context,
                available_functions=available_functions
            )
            
            # Validate function calls
            for function_call in response.get('function_calls', []):
                function_spec = next(
                    (f for f in available_functions if f['name'] == function_call['name']),
                    None
                )
                if not function_spec:
                    logger.error(f"Unknown function: {function_call['name']}")
                    raise ValueError(f"Unknown function: {function_call['name']}")
                    
                if not self.validate_function_call(function_call, function_spec):
                    logger.error(f"Invalid function call: {function_call}")
                    raise ValueError(f"Invalid function call: {function_call['name']}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error calling {agent_type} agent: {str(e)}")
            raise

# Async function wrappers for each agent
async def call_executive_agent(query: str, context: Optional[str] = None) -> Dict[str, Any]:
    """Call the executive agent"""
    agent = AgentInterface()
    return await agent.call_agent("executive", query, context)

async def call_email_agent(query: str, context: Optional[str] = None) -> Dict[str, Any]:
    """Call the email agent"""
    agent = AgentInterface()
    return await agent.call_agent("email", query, context)

async def call_appointment_agent(query: str, context: Optional[str] = None) -> Dict[str, Any]:
    """Call the appointment agent"""
    agent = AgentInterface()
    return await agent.call_agent("appointment", query, context)

async def call_research_agent(query: str, context: Optional[str] = None) -> Dict[str, Any]:
    """Call the research agent"""
    agent = AgentInterface()
    return await agent.call_agent("research", query, context)

async def call_article_writing_agent(query: str, context: Optional[str] = None) -> Dict[str, Any]:
    """Call the article writing agent"""
    agent = AgentInterface()
    return await agent.call_agent("article_writing", query, context)