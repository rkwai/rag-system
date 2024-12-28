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

1. Run the setup script:
```bash
./setup.sh
```

This will:
- Create a Python virtual environment
- Install uv package manager if not present
- Install all required dependencies

2. Activate the virtual environment:
```bash
source .venv/bin/activate
```

## 📦 Dependencies

- ragas >= 0.0.20
- datasets >= 2.15.0
- pandas >= 2.0.0
- pyyaml >= 6.0.1
- torch >= 2.1.0
- transformers >= 4.36.0
- numpy >= 1.24.0

## ���� Running Evaluations

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

Results are saved as CSV files in the `eval_results/` directory.

## 📝 Configuration

Evaluation parameters can be configured in `config/config.yaml`. This includes:
- Model parameters
- Evaluation thresholds
- Dataset paths
- Output configurations
