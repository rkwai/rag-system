from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_relevancy, harmfulness  # Include harmfulness check for content
import pandas as pd
import json
import os
import yaml
import logging
from utils.agent_interface import call_article_writing_agent
from utils.llm_interface import LLMInterface
import asyncio

# Load config
with open("config/config.yaml", 'r') as f:
    config = yaml.safe_load(f)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def validate_function_calls(response, expected_calls) -> float:
    """Validate that the article writing agent made the correct function calls"""
    try:
        response_calls = response.get('function_calls', [])
        
        # Get prompt from config
        prompt = config['prompts']['evaluation']['function_calls']['instruction'].format(
            expected_calls=json.dumps(expected_calls, indent=2),
            actual_calls=json.dumps(response_calls, indent=2)
        )

        # Get LLM response
        llm = LLMInterface()
        response = await llm.generate_response(
            system_prompt=config['prompts']['evaluation']['system_prompt'],
            user_prompt=prompt
        )
        
        # Extract just the numerical score
        score_text = response.get('content', '0.0').strip()
        return float(score_text)
            
    except Exception as e:
        logger.error(f"Error validating function calls: {str(e)}")
        return 0.0

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

async def generate_answers(data: pd.DataFrame) -> pd.DataFrame:
    """Generate answers using the article writing agent"""
    try:
        logger.info("Generating answers using article writing agent")
        data['answer'] = data['query'].apply(call_article_writing_agent)
        
        # Validate function calls
        function_calls_scores = await asyncio.gather(*[
            validate_function_calls(row['answer'], row['ground_truth']['function_calls'])
            for _, row in data.iterrows()
        ])
        data['function_calls_score'] = function_calls_scores
        
        return data
    except Exception as e:
        logger.error(f"Error generating answers: {str(e)}")
        raise

async def run_evaluation(eval_data: pd.DataFrame):
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
        
        # Add custom metrics to results
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
        
        # Add custom metrics to the results
        results_df['function_calls_accuracy'] = results.get('function_calls_accuracy', 0)
        
        results_df.to_csv(output_path, index=False)
        logger.info("Results saved successfully")
    except Exception as e:
        logger.error(f"Error saving results: {str(e)}")
        raise

async def main():
    try:
        logger.info("Starting article writing agent evaluation")
        
        # Load and process data
        eval_data = load_data("data/article_writing_agent_eval_data.jsonl")
        eval_data = await generate_answers(eval_data)
        
        # Run evaluation
        results = await run_evaluation(eval_data)
        
        # Save results
        output_path = "eval_results/article_writing_agent_results.csv"
        save_results(results, output_path)
        
        # Log accuracy metrics
        logger.info(f"Function Calls Accuracy: {results.get('function_calls_accuracy', 0):.2%}")
        logger.info("Article writing agent evaluation completed successfully")
        
    except Exception as e:
        logger.error(f"Article writing agent evaluation failed: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 