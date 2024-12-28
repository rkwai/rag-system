from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_relevancy
import pandas as pd
import json
import os
import logging
from utils.agent_interface import call_executive_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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
                if (actual_call['name'] == expected_call['name'] and
                    actual_call['args'].get('task') == expected_call['args'].get('task')):
                    found = True
                    break
            if not found:
                logger.error(f"Missing expected agent call: {expected_call['name']}")
                return False
        return True
    except Exception as e:
        logger.error(f"Error validating agent calls: {str(e)}")
        return False

def validate_task_coordination(response, expected_coordination):
    """Validate task coordination and dependencies"""
    try:
        coordination = response.get('function_calls', [])
        for call in coordination:
            if call['name'] == 'coordinate_tasks':
                tasks = call['args'].get('tasks', [])
                # Check task sequence and dependencies
                for expected_task, actual_task in zip(expected_coordination, tasks):
                    if (expected_task['agent'] != actual_task['agent'] or
                        expected_task.get('dependencies', []) != actual_task.get('dependencies', [])):
                        logger.error(f"Task coordination mismatch: {expected_task} vs {actual_task}")
                        return False
                return True
        return False
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

def generate_answers(data: pd.DataFrame) -> pd.DataFrame:
    """Generate answers using the executive agent"""
    try:
        logger.info("Generating answers using executive agent")
        data['answer'] = data['query'].apply(call_executive_agent)
        
        # Validate agent calls and task coordination
        data['agent_calls_valid'] = data.apply(
            lambda row: validate_agent_calls(row['answer'], row['ground_truth']['function_calls']), 
            axis=1
        )
        data['task_coordination_valid'] = data.apply(
            lambda row: validate_task_coordination(row['answer'], row['ground_truth'].get('coordination', [])), 
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
        metrics = [faithfulness, answer_relevancy, context_relevancy]
        
        # Add custom metrics for agent calls and coordination
        eval_data['agent_calls_score'] = eval_data['agent_calls_valid'].astype(float)
        eval_data['task_coordination_score'] = eval_data['task_coordination_valid'].astype(float)
        
        results = evaluate(
            eval_data,
            metrics=metrics,
            llm=None
        )
        
        # Add custom metrics to results
        results['agent_calls_accuracy'] = eval_data['agent_calls_score'].mean()
        results['task_coordination_accuracy'] = eval_data['task_coordination_score'].mean()
        
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
        
        # Add custom metrics to the results
        results_df['agent_calls_accuracy'] = results.get('agent_calls_accuracy', 0)
        results_df['task_coordination_accuracy'] = results.get('task_coordination_accuracy', 0)
        
        results_df.to_csv(output_path, index=False)
        logger.info("Results saved successfully")
    except Exception as e:
        logger.error(f"Error saving results: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        logger.info("Starting executive agent evaluation")
        
        # Load and process data
        eval_data = load_data("data/executive_agent_eval_data.jsonl")
        eval_data = generate_answers(eval_data)
        
        # Run evaluation
        results = run_evaluation(eval_data)
        
        # Save results
        output_path = "eval_results/executive_agent_results.csv"
        save_results(results, output_path)
        
        # Log accuracy metrics
        logger.info(f"Agent Calls Accuracy: {results.get('agent_calls_accuracy', 0):.2%}")
        logger.info(f"Task Coordination Accuracy: {results.get('task_coordination_accuracy', 0):.2%}")
        logger.info("Executive agent evaluation completed successfully")
        
    except Exception as e:
        logger.error(f"Executive agent evaluation failed: {str(e)}")
        raise