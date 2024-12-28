import asyncio
import pandas as pd
import json
import os
import logging
from utils.agent_interface import call_executive_agent
from utils.llm_interface import LLMInterface
from datasets import Dataset

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format=os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)
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

async def generate_answer(query: str) -> dict:
    """Generate a single answer using the executive agent"""
    try:
        return await call_executive_agent(query)
    except Exception as e:
        logger.error(f"Error generating answer: {str(e)}")
        return {'error': str(e)}

async def generate_answers(data: pd.DataFrame) -> pd.DataFrame:
    """Generate answers using the executive agent"""
    try:
        logger.info("Generating answers using executive agent")
        
        # Generate answers concurrently
        answers = await asyncio.gather(*[
            generate_answer(query) for query in data['query']
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

async def evaluate_faithfulness(llm: LLMInterface, answer: str, context: str) -> float:
    """Evaluate if the answer is faithful to the context"""
    try:
        prompt = f"""
        Given the following context and answer, evaluate if the answer is faithful to the context.
        Score from 0 to 1, where 1 means completely faithful and 0 means not faithful at all.
        
        Context: {context}
        Answer: {answer}
        
        Score (0-1):"""
        
        response = await llm.generate_response(
            system_prompt="You are an evaluation assistant. Provide numerical scores only.",
            user_prompt=prompt
        )
        
        score = float(response.get('content', '0').strip())
        return min(max(score, 0), 1)  # Clamp between 0 and 1
    except Exception as e:
        logger.error(f"Error evaluating faithfulness: {str(e)}")
        return 0

async def evaluate_answer_relevancy(llm: LLMInterface, answer: str, question: str) -> float:
    """Evaluate if the answer is relevant to the question"""
    try:
        prompt = f"""
        Given the following question and answer, evaluate if the answer is relevant to the question.
        Score from 0 to 1, where 1 means completely relevant and 0 means not relevant at all.
        
        Question: {question}
        Answer: {answer}
        
        Score (0-1):"""
        
        response = await llm.generate_response(
            system_prompt="You are an evaluation assistant. Provide numerical scores only.",
            user_prompt=prompt
        )
        
        score = float(response.get('content', '0').strip())
        return min(max(score, 0), 1)  # Clamp between 0 and 1
    except Exception as e:
        logger.error(f"Error evaluating answer relevancy: {str(e)}")
        return 0

async def evaluate_context_precision(llm: LLMInterface, answer: str, context: str) -> float:
    """Evaluate if the answer uses the context precisely"""
    try:
        prompt = f"""
        Given the following context and answer, evaluate if the answer uses the context precisely.
        Score from 0 to 1, where 1 means perfect precision and 0 means poor precision.
        
        Context: {context}
        Answer: {answer}
        
        Score (0-1):"""
        
        response = await llm.generate_response(
            system_prompt="You are an evaluation assistant. Provide numerical scores only.",
            user_prompt=prompt
        )
        
        score = float(response.get('content', '0').strip())
        return min(max(score, 0), 1)  # Clamp between 0 and 1
    except Exception as e:
        logger.error(f"Error evaluating context precision: {str(e)}")
        return 0

async def run_evaluation(eval_data: pd.DataFrame):
    """Run the evaluation metrics"""
    try:
        logger.info("Running evaluation metrics")
        
        # Add custom metrics for agent calls and coordination
        eval_data['agent_calls_score'] = eval_data['agent_calls_valid'].astype(float)
        eval_data['task_coordination_score'] = eval_data['task_coordination_valid'].astype(float)
        
        # Calculate custom metrics
        agent_calls_accuracy = eval_data['agent_calls_score'].mean()
        task_coordination_accuracy = eval_data['task_coordination_score'].mean()
        
        # Initialize LLM for evaluation
        llm = LLMInterface()
        
        # Run evaluation metrics concurrently
        faithfulness_scores = await asyncio.gather(*[
            evaluate_faithfulness(llm, row['response'], row['context'])
            for _, row in eval_data.iterrows()
        ])
        
        relevancy_scores = await asyncio.gather(*[
            evaluate_answer_relevancy(llm, row['response'], row['query'])
            for _, row in eval_data.iterrows()
        ])
        
        precision_scores = await asyncio.gather(*[
            evaluate_context_precision(llm, row['response'], row['context'])
            for _, row in eval_data.iterrows()
        ])
        
        # Calculate average scores
        results = {
            'agent_calls_accuracy': agent_calls_accuracy,
            'task_coordination_accuracy': task_coordination_accuracy,
            'faithfulness': sum(faithfulness_scores) / len(faithfulness_scores),
            'answer_relevancy': sum(relevancy_scores) / len(relevancy_scores),
            'context_precision': sum(precision_scores) / len(precision_scores)
        }
        
        return results
    except Exception as e:
        logger.error(f"Error running evaluation: {str(e)}")
        raise

def save_results(results, output_path: str):
    """Save evaluation results to CSV"""
    try:
        logger.info(f"Saving results to {output_path}")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Convert results to DataFrame
        results_df = pd.DataFrame([results])
        
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