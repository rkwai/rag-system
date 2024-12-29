import asyncio
import pandas as pd
import json
import os
import yaml
import logging
from logging.handlers import RotatingFileHandler
from utils.agent_interface import call_executive_agent
from utils.llm_interface import LLMInterface
from datasets import Dataset

# Load config
with open("config/config.yaml", 'r') as f:
    config = yaml.safe_load(f)

# Configure logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)

# Create formatters and handlers
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# File handler for general logs
file_handler = RotatingFileHandler(
    os.path.join(log_dir, 'executive_agent.log'),
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(file_formatter)
file_handler.setLevel(logging.INFO)

# File handler specifically for LLM interactions
llm_file_handler = RotatingFileHandler(
    os.path.join(log_dir, 'llm_interactions.log'),
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
llm_file_handler.setFormatter(file_formatter)
llm_file_handler.setLevel(logging.INFO)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(console_formatter)
console_handler.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

# Configure LLM logger
llm_logger = logging.getLogger('utils.llm_interface')
llm_logger.addHandler(llm_file_handler)

logger = logging.getLogger(__name__)

def validate_agent_calls(response, expected_calls):
    """Validate that the executive agent made the correct agent calls"""
    try:
        response_calls = response.get('function_calls', [])
        
        # Check if all expected agent calls are present
        for expected_call in expected_calls:
            found = False
            for actual_call in response_calls:
                if actual_call['name'] == expected_call:
                    found = True
                    break
            if not found:
                logger.error(f"Missing expected agent call: {expected_call}")
                return False
        return True
    except Exception as e:
        logger.error(f"Error validating agent calls: {str(e)}")
        return False

def validate_task_coordination(response, expected_coordination):
    """Validate task coordination and dependencies"""
    try:
        coordination = response.get('function_calls', [])
        if not coordination:
            return False
        
        # Check that all expected functions are called in order
        expected_sequence = [call for call in expected_coordination]
        actual_sequence = [call['name'] for call in coordination]
        
        return expected_sequence == actual_sequence
    except Exception as e:
        logger.error(f"Error validating task coordination: {str(e)}")
        return False

def load_data(file_path: str) -> pd.DataFrame:
    """Load evaluation data from JSONL file"""
    try:
        logger.info(f"Loading evaluation data from {file_path}")
        data = []
        with open(file_path, 'r') as f:
            for line in f:
                data.append(json.loads(line))
        return pd.DataFrame(data)
    except FileNotFoundError:
        logger.error(f"Evaluation data file not found: {file_path}")
        raise
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in evaluation data: {file_path}")
        raise
    except Exception as e:
        logger.error(f"Error loading data from {file_path}: {str(e)}")
        raise

async def generate_answer(query: str, context: str) -> dict:
    """Generate a single answer using the executive agent"""
    try:
        return await call_executive_agent(query, context)
    except Exception as e:
        logger.error(f"Error generating answer: {str(e)}")
        return {'error': str(e)}

async def generate_answers(data: pd.DataFrame) -> pd.DataFrame:
    """Generate answers using the executive agent"""
    try:
        logger.info("Generating answers using executive agent")
        
        # Generate answers concurrently
        answers = await asyncio.gather(*[
            generate_answer(row['query'], row['context']) for _, row in data.iterrows()
        ])
        data['answer'] = answers
        
        # Extract text responses from answers
        data['response'] = data['answer'].apply(lambda x: x.get('content', ''))
        
        # Validate agent calls and task coordination
        data['agent_calls_valid'] = data.apply(
            lambda row: validate_agent_calls(row['answer'], row['ground_truth']['function_calls']), 
            axis=1
        )
        data['task_coordination_valid'] = data.apply(
            lambda row: validate_task_coordination(row['answer'], row['ground_truth']['function_calls']), 
            axis=1
        )
        
        return data
    except Exception as e:
        logger.error(f"Error generating answers: {str(e)}")
        raise

async def evaluate_faithfulness(answer: dict, context: str) -> float:
    """Evaluate if the answer is faithful to the context"""
    try:
        # Get prompt from config
        prompt = config['prompts']['evaluation']['faithfulness']['instruction'].format(
            context=context,
            answer=answer.get('content', '')
        )

        response = await llm.generate_response(
            system_prompt=config['prompts']['evaluation']['system_prompt'],
            user_prompt=prompt
        )
        
        # Extract just the numerical score
        score_text = response.get('content', '0.0').strip()
        return float(score_text)
        
    except Exception as e:
        logger.error(f"Error evaluating faithfulness: {str(e)}")
        return 0.0

async def evaluate_answer_relevancy(answer: dict, query: str) -> float:
    """Evaluate if the answer is relevant to the question"""
    try:
        # Get prompt from config
        prompt = config['prompts']['evaluation']['answer_relevancy']['instruction'].format(
            query=query,
            answer=answer.get('content', '')
        )

        response = await llm.generate_response(
            system_prompt=config['prompts']['evaluation']['system_prompt'],
            user_prompt=prompt
        )
        
        # Extract just the numerical score
        score_text = response.get('content', '0.0').strip()
        return float(score_text)
        
    except Exception as e:
        logger.error(f"Error evaluating answer relevancy: {str(e)}")
        return 0.0

async def evaluate_context_precision(answer: dict, context: str) -> float:
    """Evaluate if the answer uses the context precisely"""
    try:
        # Get prompt from config
        prompt = config['prompts']['evaluation']['context_precision']['instruction'].format(
            context=context,
            answer=answer.get('content', '')
        )

        response = await llm.generate_response(
            system_prompt=config['prompts']['evaluation']['system_prompt'],
            user_prompt=prompt
        )
        
        # Extract just the numerical score
        score_text = response.get('content', '0.0').strip()
        return float(score_text)
        
    except Exception as e:
        logger.error(f"Error evaluating context precision: {str(e)}")
        return 0.0

async def run_evaluation(eval_data: pd.DataFrame):
    """Run evaluation metrics"""
    try:
        logger.info("Running evaluation metrics")
        
        # Validate agent calls and task coordination
        eval_data['agent_calls_valid'] = eval_data.apply(
            lambda row: validate_agent_calls(row['answer'], row['ground_truth']['function_calls']), 
            axis=1
        )
        eval_data['task_coordination_valid'] = eval_data.apply(
            lambda row: validate_task_coordination(row['answer'], row['ground_truth']['function_calls']), 
            axis=1
        )
        
        # Run evaluation metrics concurrently
        faithfulness_scores = await asyncio.gather(*[
            evaluate_faithfulness(row['answer'], row['context'])
            for _, row in eval_data.iterrows()
        ])
        
        relevancy_scores = await asyncio.gather(*[
            evaluate_answer_relevancy(row['answer'], row['query'])
            for _, row in eval_data.iterrows()
        ])
        
        precision_scores = await asyncio.gather(*[
            evaluate_context_precision(row['answer'], row['context'])
            for _, row in eval_data.iterrows()
        ])
        
        # Calculate average scores
        agent_calls_accuracy = eval_data['agent_calls_valid'].mean() * 100
        task_coordination_accuracy = eval_data['task_coordination_valid'].mean() * 100
        faithfulness_score = sum(faithfulness_scores) / len(faithfulness_scores) * 100
        relevancy_score = sum(relevancy_scores) / len(relevancy_scores) * 100
        precision_score = sum(precision_scores) / len(precision_scores) * 100
        
        # Create results dictionary
        results = {
            'timestamp': pd.Timestamp.now(),
            'agent_calls_accuracy': agent_calls_accuracy,
            'task_coordination_accuracy': task_coordination_accuracy,
            'faithfulness_score': faithfulness_score,
            'relevancy_score': relevancy_score,
            'precision_score': precision_score,
            'num_examples': len(eval_data)
        }
        
        # Log metrics
        logger.info(f"Agent Calls Accuracy: {agent_calls_accuracy:.2f}%")
        logger.info(f"Task Coordination Accuracy: {task_coordination_accuracy:.2f}%")
        logger.info(f"Faithfulness Score: {faithfulness_score:.2f}%")
        logger.info(f"Answer Relevancy Score: {relevancy_score:.2f}%")
        logger.info(f"Context Precision Score: {precision_score:.2f}%")
        
        return results
        
    except Exception as e:
        logger.error(f"Error running evaluation: {str(e)}")
        raise

def save_results(results, output_path: str):
    """Save evaluation results to CSV"""
    try:
        logger.info(f"Saving results to {output_path}")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Create results DataFrame
        results_df = pd.DataFrame([results])
        
        # Load existing results if they exist
        if os.path.exists(output_path):
            existing_results = pd.read_csv(output_path)
            results_df = pd.concat([existing_results, results_df], ignore_index=True)
        
        # Save all results
        results_df.to_csv(output_path, index=False)
        logger.info("Results saved successfully")
    except Exception as e:
        logger.error(f"Error saving results: {str(e)}")
        raise

async def main():
    try:
        logger.info("Starting executive agent evaluation")
        
        # Load and process data
        eval_data = load_data("data/executive_agent_eval_data.jsonl")
        eval_data = await generate_answers(eval_data)
        
        # Run evaluation
        results = await run_evaluation(eval_data)
        
        # Save results
        output_path = "eval_results/executive_agent_results.csv"
        save_results(results, output_path)
        
        # Log accuracy metrics
        logger.info(f"Agent Calls Accuracy: {results.get('agent_calls_accuracy', 0):.2%}")
        logger.info(f"Task Coordination Accuracy: {results.get('task_coordination_accuracy', 0):.2%}")
        logger.info(f"Faithfulness Score: {results.get('faithfulness', 0):.2%}")
        logger.info(f"Answer Relevancy Score: {results.get('answer_relevancy', 0):.2%}")
        logger.info(f"Context Precision Score: {results.get('context_precision', 0):.2%}")
        logger.info("Executive agent evaluation completed successfully")
        
    except Exception as e:
        logger.error(f"Executive agent evaluation failed: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())