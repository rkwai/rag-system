"""Evaluation metrics for agent evaluation"""
import logging
from typing import Dict, Any, List
import yaml

# Load config
with open("config/config.yaml", 'r') as f:
    config = yaml.safe_load(f)

logger = logging.getLogger(__name__)

async def faithfulness(answer: Dict[str, Any], context: str) -> float:
    """Evaluate if the answer is faithful to the context"""
    try:
        # Get prompt from config
        prompt = config['llm']['prompts']['evaluation']['faithfulness']['instruction'].format(
            context=context,
            answer=answer.get('content', '') if isinstance(answer, dict) else str(answer)
        )
        
        # Call LLM for evaluation
        score = await evaluate_with_llm(prompt)
        return score
    except Exception as e:
        logger.error(f"Error evaluating faithfulness: {str(e)}")
        return 0.0

async def answer_relevancy(answer: Dict[str, Any], query: str) -> float:
    """Evaluate if the answer is relevant to the question"""
    try:
        # Get prompt from config
        prompt = config['llm']['prompts']['evaluation']['answer_relevancy']['instruction'].format(
            query=query,
            answer=answer.get('content', '') if isinstance(answer, dict) else str(answer)
        )
        
        # Call LLM for evaluation
        score = await evaluate_with_llm(prompt)
        return score
    except Exception as e:
        logger.error(f"Error evaluating answer relevancy: {str(e)}")
        return 0.0

async def context_relevancy(answer: Dict[str, Any], context: str) -> float:
    """Evaluate if the answer uses the context effectively"""
    try:
        # Get prompt from config
        prompt = config['llm']['prompts']['evaluation']['context_relevancy']['instruction'].format(
            context=context,
            answer=answer.get('content', '') if isinstance(answer, dict) else str(answer)
        )
        
        # Call LLM for evaluation
        score = await evaluate_with_llm(prompt)
        return score
    except Exception as e:
        logger.error(f"Error evaluating context relevancy: {str(e)}")
        return 0.0

async def task_coordination(answer: Dict[str, Any], expected_sequence: List[str]) -> float:
    """Evaluate if the task coordination is effective"""
    try:
        # Get actual sequence
        actual_sequence = [call.get('name', '') for call in answer.get('function_calls', [])] if isinstance(answer, dict) else []
        
        # Get prompt from config
        prompt = config['llm']['prompts']['evaluation']['task_coordination']['instruction'].format(
            expected_sequence=', '.join(expected_sequence),
            actual_sequence=', '.join(actual_sequence)
        )
        
        # Call LLM for evaluation
        score = await evaluate_with_llm(prompt)
        return score
    except Exception as e:
        logger.error(f"Error evaluating task coordination: {str(e)}")
        return 0.0

async def harmfulness(answer: Dict[str, Any], *args) -> float:
    """Evaluate if the content contains harmful elements"""
    try:
        # Get prompt from config
        prompt = config['llm']['prompts']['evaluation']['harmfulness']['instruction'].format(
            answer=answer.get('content', '') if isinstance(answer, dict) else str(answer)
        )
        
        # Call LLM for evaluation
        score = await evaluate_with_llm(prompt)
        # Invert score since lower harmfulness is better
        return 1.0 - score
    except Exception as e:
        logger.error(f"Error evaluating harmfulness: {str(e)}")
        return 0.0

async def context_recall(answer: Dict[str, Any], context: str) -> float:
    """Evaluate if the research is comprehensive"""
    try:
        # Extract sources from context if available
        sources = []
        used_sources = []
        if isinstance(answer, dict):
            sources = answer.get('available_sources', [])
            used_sources = answer.get('used_sources', [])
        
        # Get prompt from config
        prompt = config['llm']['prompts']['evaluation']['context_recall']['instruction'].format(
            sources=', '.join(sources),
            used_sources=', '.join(used_sources),
            answer=answer.get('content', '') if isinstance(answer, dict) else str(answer)
        )
        
        # Call LLM for evaluation
        score = await evaluate_with_llm(prompt)
        return score
    except Exception as e:
        logger.error(f"Error evaluating context recall: {str(e)}")
        return 0.0

async def evaluate_with_llm(prompt: str) -> float:
    """Call LLM to evaluate and return a score"""
    try:
        # TODO: Implement actual LLM call
        # For now, return a mock score
        return 0.75
    except Exception as e:
        logger.error(f"Error calling LLM for evaluation: {str(e)}")
        return 0.0 