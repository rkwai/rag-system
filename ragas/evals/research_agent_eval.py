from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_relevancy, context_recall  # Include recall for research completeness
import pandas as pd
import json
import os
import yaml
import logging
from utils.agent_interface import call_research_agent
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
    """Validate that the research agent made the correct function calls"""
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
    """Generate answers using the research agent"""
    try:
        logger.info("Generating answers using research agent")
        data['answer'] = data['query'].apply(call_research_agent)
        
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
        # Include context_recall for research completeness
        metrics = [faithfulness, answer_relevancy, context_relevancy, context_recall]
        
        results = evaluate(
            eval_data,
            metrics=metrics,
            llm=None
        )
        
        # Calculate function calls accuracy
        function_calls_accuracy = eval_data['function_calls_score'].mean() * 100
        
        # Create results dictionary
        results = {
            'timestamp': pd.Timestamp.now(),
            'function_calls_accuracy': function_calls_accuracy,
            'faithfulness_score': results.get('faithfulness', 0) * 100,
            'relevancy_score': results.get('answer_relevancy', 0) * 100,
            'context_relevancy_score': results.get('context_relevancy', 0) * 100,
            'context_recall_score': results.get('context_recall', 0) * 100,
            'num_examples': len(eval_data)
        }
        
        # Log metrics
        logger.info(f"Function Calls Accuracy: {function_calls_accuracy:.2f}%")
        logger.info(f"Faithfulness Score: {results['faithfulness_score']:.2f}%")
        logger.info(f"Answer Relevancy Score: {results['relevancy_score']:.2f}%")
        logger.info(f"Context Relevancy Score: {results['context_relevancy_score']:.2f}%")
        logger.info(f"Context Recall Score: {results['context_recall_score']:.2f}%")
        
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
        logger.info("Starting research agent evaluation")
        
        # Load and process data
        eval_data = load_data("data/research_agent_eval_data.jsonl")
        eval_data = await generate_answers(eval_data)
        
        # Run evaluation
        results = await run_evaluation(eval_data)
        
        # Save results
        output_path = "eval_results/research_agent_results.csv"
        save_results(results, output_path)
        
        # Log accuracy metrics
        logger.info(f"Function Calls Accuracy: {results.get('function_calls_accuracy', 0):.2%}")
        logger.info("Research agent evaluation completed successfully")
        
    except Exception as e:
        logger.error(f"Research agent evaluation failed: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 