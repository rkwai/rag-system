#!/bin/bash

# Ensure we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    uv venv
fi

# Ensure the activate script exists
if [ ! -f ".venv/bin/activate" ]; then
    echo "Error: Virtual environment activation script not found"
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
. .venv/bin/activate

# Verify activation
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Error: Virtual environment not activated"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
uv pip install -r requirements.txt

echo "Setup complete! You can now run: source .venv/bin/activate && python evals/*.py" 