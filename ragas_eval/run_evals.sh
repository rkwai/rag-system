#!/bin/bash

# Set base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    uv venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies with uv
echo "Installing dependencies..."
uv pip install -r requirements.txt

# Install package in development mode
echo "Installing package in development mode..."
uv pip install -e .

# Default values
AGENT_TYPE="executive"
EVAL_TYPES=("routing" "function" "rag")

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--agent)
            AGENT_TYPE="$2"
            shift 2
            ;;
        -e|--eval-types)
            IFS=',' read -ra EVAL_TYPES <<< "$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [-a|--agent <agent_type>] [-e|--eval-types <eval_types>]"
            echo
            echo "Options:"
            echo "  -a, --agent        Agent type to evaluate (default: executive)"
            echo "                     Available: email, appointment, article_writing, research, executive"
            echo
            echo "  -e, --eval-types   Comma-separated list of evaluation types (default: all)"
            echo "                     Available: routing,function,rag"
            echo
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Print configuration
echo "Running evaluations with:"
echo "Agent type: $AGENT_TYPE"
echo "Evaluation types: ${EVAL_TYPES[*]}"
echo

# Add the parent directory to PYTHONPATH
export PYTHONPATH="$(dirname "$BASE_DIR"):$PYTHONPATH"

# Run evaluations
python3 "$BASE_DIR/evals/agent_evaluator.py" "$AGENT_TYPE" "${EVAL_TYPES[@]}"

# Check if evaluation was successful
if [ $? -eq 0 ]; then
    echo
    echo "Evaluation complete. Results saved in eval_results/"
else
    echo
    echo "Error: Evaluation failed. Check the error messages above."
    exit 1
fi 