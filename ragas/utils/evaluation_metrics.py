"""Evaluation metrics for agent evaluation"""
import logging
from typing import Dict, Any, List
import yaml
import time
from utils.llm_interface import LLMInterface

# Load config
with open("config/config.yaml", 'r') as f:
    config = yaml.safe_load(f)

logger = logging.getLogger(__name__)

# Initialize LLM interface
llm = LLMInterface()

async def evaluate_with_llm(prompt: str, max_retries: int = 3, initial_retry_delay: float = 1.0) -> float:
    """Call LLM to evaluate and return a score"""
    try:
        retry_delay = initial_retry_delay
        attempt = 0
        
        while attempt < max_retries:
            try:
                # Add system prompt and evaluation instructions
                system_prompt = config['prompts']['evaluation']['system_prompt']
                full_prompt = f"{system_prompt}\n\n{prompt}\n\nScore (0-1):"
                
                # Call LLM
                llm = LLMInterface()
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
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        attempt += 1
                        continue
                raise
            
        logger.error("Max retries exceeded for LLM evaluation")
        return 0.0
        
    except Exception as e:
        logger.error(f"Error calling LLM for evaluation: {str(e)}")
        return 0.0

async def faithfulness(answer: Dict[str, Any], context: str) -> float:
    """Evaluate if the answer is faithful to the context"""
    try:
        prompt = config['prompts']['evaluation']['faithfulness_prompt'].format(
            context=context,
            answer=answer.get('content', '')
        )
        return await evaluate_with_llm(prompt)
    except Exception as e:
        logger.error(f"Error evaluating faithfulness: {str(e)}")
        return 0.0

async def answer_relevancy(answer: Dict[str, Any], query: str) -> float:
    """Evaluate if the answer is relevant to the query"""
    try:
        prompt = config['prompts']['evaluation']['answer_relevancy_prompt'].format(
            question=query,
            answer=answer.get('content', '')
        )
        return await evaluate_with_llm(prompt)
    except Exception as e:
        logger.error(f"Error evaluating answer relevancy: {str(e)}")
        return 0.0

async def context_relevancy(answer: Dict[str, Any], context: str) -> float:
    """Evaluate if the answer uses the context effectively"""
    try:
        prompt = config['prompts']['evaluation']['context_relevancy_prompt'].format(
            context=context,
            answer=answer.get('content', '')
        )
        return await evaluate_with_llm(prompt)
    except Exception as e:
        logger.error(f"Error evaluating context relevancy: {str(e)}")
        return 0.0

async def harmfulness(answer: Dict[str, Any]) -> float:
    """Evaluate if the answer is safe and ethical"""
    try:
        prompt = config['prompts']['evaluation']['harmfulness_prompt'].format(
            answer=answer.get('content', '')
        )
        # Invert the score since we want 1.0 to mean not harmful
        return 1.0 - await evaluate_with_llm(prompt)
    except Exception as e:
        logger.error(f"Error evaluating harmfulness: {str(e)}")
        return 0.0

async def context_recall(answer: Dict[str, Any], context: str) -> float:
    """Evaluate how well the answer recalls and uses the context"""
    try:
        prompt = config['prompts']['evaluation']['context_recall_prompt'].format(
            context=context,
            answer=answer.get('content', '')
        )
        return await evaluate_with_llm(prompt)
    except Exception as e:
        logger.error(f"Error evaluating context recall: {str(e)}")
        return 0.0

async def task_coordination(expected_sequence: List[str], actual_sequence: List[str]) -> float:
    """Evaluate how well tasks are coordinated"""
    try:
        prompt = config['prompts']['evaluation']['task_coordination_prompt'].format(
            expected_sequence=", ".join(expected_sequence),
            actual_sequence=", ".join(actual_sequence)
        )
        return await evaluate_with_llm(prompt)
    except Exception as e:
        logger.error(f"Error evaluating task coordination: {str(e)}")
        return 0.0 