from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
import pandas as pd
import json
import os
import logging
from utils.agent_interface import call_email_agent

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format=os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)
logger = logging.getLogger(__name__)

def validate_function_calls(response, expected_calls):
    """Validate that the email agent made the correct function calls"""
    try:
        response_calls = response.get('function_calls', [])
        
        # Check if all expected function calls are present in correct order
        if len(response_calls) != len(expected_calls):
            logger.error(f"Number of function calls mismatch. Expected {len(expected_calls)}, got {len(response_calls)}")
            return False
            
        for expected_call, actual_call in zip(expected_calls, response_calls):
            # Check function name
            if expected_call['name'] != actual_call['name']:
                logger.error(f"Function name mismatch: expected {expected_call['name']}, got {actual_call['name']}")
                return False
                
            # Check function arguments
            expected_args = expected_call['args']
            actual_args = actual_call['args']
            
            # For compose_email, check structure but allow content flexibility
            if expected_call['name'] == 'compose_email':
                if not all(key in actual_args for key in ['to', 'subject', 'body']):
                    logger.error("Missing required email fields")
                    return False
                if not isinstance(actual_args['to'], list):
                    logger.error("'to' field should be a list of recipients")
                    return False
            
            # For send_email, check draft_id exists
            elif expected_call['name'] == 'send_email':
                if 'draft_id' not in actual_args:
                    logger.error("Missing draft_id in send_email call")
                    return False
                    
        return True
    except Exception as e:
        logger.error(f"Error validating function calls: {str(e)}")
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

def generate_answers(data: pd.DataFrame) -> pd.DataFrame:
    """Generate answers using the email agent"""
    try:
        logger.info("Generating answers using email agent")
        data['answer'] = data['query'].apply(call_email_agent)
        
        # Validate function calls
        data['function_calls_valid'] = data.apply(
            lambda row: validate_function_calls(row['answer'], row['ground_truth']['function_calls']), 
            axis=1
        )
        
        return data
    except Exception as e:
        logger.error(f"Error generating answers: {str(e)}")
        raise

def run_evaluation(eval_data: pd.DataFrame):
    """Run the evaluation metrics"""
    try:
        logger.info("Running evaluation metrics")
        metrics = [faithfulness, answer_relevancy]
        
        # Add custom metric for function calls
        eval_data['function_calls_score'] = eval_data['function_calls_valid'].astype(float)
        
        results = evaluate(
            eval_data,
            metrics=metrics,
            llm=None
        )
        
        # Add custom metric to results
        results['function_calls_accuracy'] = eval_data['function_calls_score'].mean()
        
        return results
    except Exception as e:
        logger.error(f"Error running evaluation: {str(e)}")
        raise

def save_results(results, output_path: str):
    """Save evaluation results to CSV"""
    try:
        logger.info(f"Saving results to {output_path}")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        results_df = results.to_pandas()
        
        # Add custom metric to the results
        results_df['function_calls_accuracy'] = results.get('function_calls_accuracy', 0)
        
        results_df.to_csv(output_path, index=False)
        logger.info("Results saved successfully")
    except Exception as e:
        logger.error(f"Error saving results: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        logger.info("Starting email agent evaluation")
        
        # Load and process data
        eval_data = load_data("data/email_agent_eval_data.jsonl")
        eval_data = generate_answers(eval_data)
        
        # Run evaluation
        results = run_evaluation(eval_data)
        
        # Save results
        output_path = "eval_results/email_agent_results.csv"
        save_results(results, output_path)
        
        # Log accuracy metrics
        logger.info(f"Function Calls Accuracy: {results.get('function_calls_accuracy', 0):.2%}")
        logger.info("Email agent evaluation completed successfully")
        
    except Exception as e:
        logger.error(f"Email agent evaluation failed: {str(e)}")
        raise