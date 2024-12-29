"""Evaluation metrics for agent evaluation"""
import logging
from typing import Dict, Any, List
import yaml
import time
from utils.llm_interface import LLMInterface
import asyncio

# Load config
with open("config/config.yaml", 'r') as f:
    config = yaml.safe_load(f)

logger = logging.getLogger(__name__)

# Initialize LLM interface
llm = LLMInterface()

async def evaluate_with_llm(prompt: str, max_retries: int = 5, initial_retry_delay: float = 1.0) -> float:
    """Call LLM to evaluate and return a score"""
    retry_delay = initial_retry_delay
    attempt = 0
    
    while attempt < max_retries:
        try:
            # Add system prompt and evaluation instructions
            system_prompt = config['prompts']['evaluation']['system_prompt']
            full_prompt = f"{system_prompt}\n\n{prompt}\n\nScore (0-1):"
            
            # Call LLM
            response = await llm.generate_response(
                system_prompt=system_prompt,
                user_prompt=prompt
            )
            
            # Extract score from response
            score_text = response.get('content', '0.0').strip()
            try:
                score = float(score_text)
                # Ensure score is between 0 and 1
                score = max(0.0, min(1.0, score))
                return score
            except ValueError:
                logger.error(f"LLM returned non-numeric score: {score_text}")
                return 0.0
                
        except Exception as e:
            if "429" in str(e) or "Resource exhausted" in str(e):
                if attempt < max_retries - 1:
                    logger.warning(f"Rate limit hit, retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    attempt += 1
                    continue
            logger.error(f"Error evaluating with LLM: {str(e)}")
            return 0.0
    
    logger.error("Max retries reached for LLM evaluation")
    return 0.0

async def faithfulness(answer: Dict[str, Any], context: str) -> float:
    """Evaluate faithfulness of answer to context"""
    prompt = config['prompts']['evaluation']['faithfulness'].format(
        answer=answer.get('content', ''),
        context=context
    )
    return await evaluate_with_llm(prompt)

async def answer_relevancy(answer: Dict[str, Any], context: str) -> float:
    """Evaluate relevancy of answer to query"""
    prompt = config['prompts']['evaluation']['answer_relevancy'].format(
        answer=answer.get('content', ''),
        context=context
    )
    return await evaluate_with_llm(prompt)

async def context_relevancy(answer: Dict[str, Any], context: str) -> float:
    """Evaluate relevancy of context to answer"""
    prompt = config['prompts']['evaluation']['context_relevancy'].format(
        answer=answer.get('content', ''),
        context=context
    )
    return await evaluate_with_llm(prompt)

async def harmfulness(answer: Dict[str, Any], context: str) -> float:
    """Evaluate potential harmfulness of the answer"""
    prompt = config['prompts']['evaluation']['harmfulness'].format(
        answer=answer.get('content', '')
    )
    return await evaluate_with_llm(prompt)

async def context_recall(answer: Dict[str, Any], context: str) -> float:
    """Evaluate how well the answer recalls information from context"""
    prompt = config['prompts']['evaluation']['context_recall'].format(
        answer=answer.get('content', ''),
        context=context
    )
    return await evaluate_with_llm(prompt)

async def task_coordination(answer: Dict[str, Any], expected_sequence: List[str]) -> float:
    """Evaluate task coordination and sequencing"""
    actual_sequence = [call.get('name', '') for call in answer.get('function_calls', [])]
    prompt = config['prompts']['evaluation']['task_coordination'].format(
        expected_sequence=', '.join(expected_sequence),
        actual_sequence=', '.join(actual_sequence)
    )
    return await evaluate_with_llm(prompt) 