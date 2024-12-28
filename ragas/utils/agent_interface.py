# utils/agent_interface.py
import os
import yaml
import logging
from typing import Dict, Any
from .llm_interface import LLMInterface

logger = logging.getLogger(__name__)

class AgentInterface:
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize agent interface with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.llm = LLMInterface(config_path)
        
    async def call_agent(self, agent_type: str, query: str) -> Dict[str, Any]:
        """Call a specific agent with a query"""
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
            
            # Generate response
            response = await self.llm.generate_response(
                system_prompt=system_prompt,
                user_prompt=query,
                available_functions=available_functions
            )
            
            # Validate function calls
            for function_call in response.get('function_calls', []):
                function_spec = next(
                    (f for f in available_functions if f['name'] == function_call['name']),
                    None
                )
                if function_spec and not self.llm.validate_function_call(function_call, function_spec):
                    logger.error(f"Invalid function call: {function_call}")
                    raise ValueError(f"Invalid function call: {function_call['name']}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error calling {agent_type} agent: {str(e)}")
            raise

# Async function wrappers for each agent
async def call_executive_agent(query: str) -> Dict[str, Any]:
    """Call the executive agent"""
    agent = AgentInterface()
    return await agent.call_agent("executive", query)

async def call_email_agent(query: str) -> Dict[str, Any]:
    """Call the email agent"""
    agent = AgentInterface()
    return await agent.call_agent("email", query)

async def call_appointment_agent(query: str) -> Dict[str, Any]:
    """Call the appointment agent"""
    agent = AgentInterface()
    return await agent.call_agent("appointment", query)

async def call_research_agent(query: str) -> Dict[str, Any]:
    """Call the research agent"""
    agent = AgentInterface()
    return await agent.call_agent("research", query)

async def call_article_writing_agent(query: str) -> Dict[str, Any]:
    """Call the article writing agent"""
    agent = AgentInterface()
    return await agent.call_agent("article_writing", query)