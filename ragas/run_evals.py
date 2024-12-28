#!/usr/bin/env python3
import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format=os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)
logger = logging.getLogger(__name__)

async def run_evaluation(eval_script: str) -> bool:
    """Run a single evaluation script"""
    try:
        logger.info(f"Running evaluation: {eval_script}")
        process = await asyncio.create_subprocess_exec(
            'python',
            f'evals/{eval_script}',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            logger.info(f"Successfully completed: {eval_script}")
            return True
        else:
            logger.error(f"Failed to run {eval_script}")
            logger.error(f"Error output: {stderr.decode()}")
            return False
            
    except Exception as e:
        logger.error(f"Error running {eval_script}: {str(e)}")
        return False

async def run_all_evaluations():
    """Run all evaluation scripts"""
    try:
        # Create results directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_dir = Path(os.getenv('EVAL_RESULTS_DIR', 'eval_results'))
        run_dir = results_dir / f"run_{timestamp}"
        run_dir.mkdir(parents=True, exist_ok=True)
        
        # List of evaluation scripts
        eval_scripts = [
            'executive_agent_eval.py',
            'email_agent_eval.py',
            'appointment_agent_eval.py',
            'research_agent_eval.py',
            'article_writing_agent_eval.py'
        ]
        
        # Run evaluations concurrently
        tasks = [run_evaluation(script) for script in eval_scripts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Generate summary
        summary = []
        for script, result in zip(eval_scripts, results):
            status = "✅ Passed" if result is True else "❌ Failed"
            summary.append(f"{status}: {script}")
        
        # Save summary
        summary_path = run_dir / "summary.txt"
        with open(summary_path, 'w') as f:
            f.write("\n".join(summary))
        
        logger.info("Evaluation Summary:")
        for line in summary:
            logger.info(line)
            
    except Exception as e:
        logger.error(f"Error running evaluations: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        # Run all evaluations
        asyncio.run(run_all_evaluations())
        
    except KeyboardInterrupt:
        logger.info("Evaluation interrupted by user")
        
    except Exception as e:
        logger.error(f"Evaluation failed: {str(e)}")
        raise 