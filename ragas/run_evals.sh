#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Activate virtual environment
source "$SCRIPT_DIR/.venv/bin/activate"

# Set Python path
export PYTHONPATH="$SCRIPT_DIR"

# Run evaluations
python "$SCRIPT_DIR/evals/agent_evaluator.py"

# Print results summary
echo "Evaluation results saved in eval_results/" 