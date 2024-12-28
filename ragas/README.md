# RAG Evaluation System

A comprehensive evaluation framework for testing and benchmarking the Retrieval-Augmented Generation (RAG) components of our RPG system.

## 📊 Overview

This system provides automated evaluation pipelines for different aspects of our RAG system:
- Executive agent evaluation
- Email agent evaluation
- Context retrieval quality assessment
- Response generation evaluation

## 🗂️ Project Structure

```
ragas/
├── config/         # Configuration files
├── data/          # Evaluation datasets
├── evals/         # Evaluation implementations
├── utils/         # Shared utilities
└── .venv/         # Python virtual environment
```

## 🔧 Setup

1. Set up environment variables:
```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your API keys and settings
nano .env
```

2. Run the setup script:
```bash
./setup.sh
```

This will:
- Create a Python virtual environment
- Install uv package manager if not present
- Install all required dependencies

3. Activate the virtual environment:
```bash
source .venv/bin/activate
```

## 🔑 Environment Variables

The following environment variables need to be set in your `.env` file:

### Required
- `GOOGLE_API_KEY`: Your Google API key for Gemini Pro access

### Optional
- `OPENAI_API_KEY`: OpenAI API key (if using as fallback)
- `LOG_LEVEL`: Logging level (default: INFO)
- `MODEL_TEMPERATURE`: Response temperature (default: 0.7)
- `MODEL_TOP_P`: Top-p sampling parameter (default: 0.8)
- `MODEL_TOP_K`: Top-k sampling parameter (default: 40)
- `MAX_OUTPUT_TOKENS`: Maximum output length (default: 2048)

## 📦 Dependencies

- ragas >= 0.0.20
- datasets >= 2.15.0
- pandas >= 2.0.0
- pyyaml >= 6.0.1
- torch >= 2.1.0
- transformers >= 4.36.0
- numpy >= 1.24.0
- google-generativeai >= 0.3.1
- python-dotenv >= 1.0.0
- aiohttp >= 3.9.1

## 🏃‍♂️ Running Evaluations

### Executive Agent Evaluation
```bash
python evals/executive_agent_eval.py
```

### Email Agent Evaluation
```bash
python evals/email_agent_eval.py
```

## 📈 Metrics

The evaluation system measures:
- Faithfulness
- Answer Relevancy
- Context Relevancy
- Context Recall
- Response Harmfulness
- Function Call Accuracy

Results are saved as CSV files in the `eval_results/` directory.

## 📝 Configuration

Evaluation parameters can be configured in:
1. `config/config.yaml` - Model and agent configurations
2. `.env` - Environment-specific settings
3. Individual evaluation scripts
