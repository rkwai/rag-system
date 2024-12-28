from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_relevancy, harmfulness  # Include harmfulness check for content
import pandas as pd
import json
import os
import logging
from utils.agent_interface import call_article_writing_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    """Generate answers using the article writing agent"""
    try:
        logger.info("Generating answers using article writing agent")
        data['answer'] = data['query'].apply(call_article_writing_agent)
        return data
    except Exception as e:
        logger.error(f"Error generating answers: {str(e)}")
        raise

def run_evaluation(eval_data: pd.DataFrame):
    """Run the evaluation metrics"""
    try:
        logger.info("Running evaluation metrics")
        # Include harmfulness check for content safety
        metrics = [faithfulness, answer_relevancy, context_relevancy, harmfulness]
        
        results = evaluate(
            eval_data,
            metrics=metrics,
            llm=None
        )
        return results
    except Exception as e:
        logger.error(f"Error running evaluation: {str(e)}")
        raise

def save_results(results, output_path: str):
    """Save evaluation results to CSV"""
    try:
        logger.info(f"Saving results to {output_path}")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        results.to_pandas().to_csv(output_path, index=False)
        logger.info("Results saved successfully")
    except Exception as e:
        logger.error(f"Error saving results: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        logger.info("Starting article writing agent evaluation")
        
        # Load and process data
        eval_data = load_data("data/article_writing_agent_eval_data.jsonl")
        eval_data = generate_answers(eval_data)
        
        # Run evaluation
        results = run_evaluation(eval_data)
        
        # Save results
        output_path = "eval_results/article_writing_agent_results.csv"
        save_results(results, output_path)
        
        logger.info("Article writing agent evaluation completed successfully")
        
    except Exception as e:
        logger.error(f"Article writing agent evaluation failed: {str(e)}")
        raise 