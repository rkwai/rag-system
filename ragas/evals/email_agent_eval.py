from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy  # Focus on email content
import pandas as pd
import json
from utils.agent_interface import call_email_agent  # Assuming you have this

def load_data(file_path):
    # ... (same as above) ...
    pass

def generate_answers(data):
    data['answer'] = data['query'].apply(call_email_agent)
    return data

if __name__ == "__main__":
    eval_data = load_data("data/email_agent_eval_data.jsonl")
    eval_data = generate_answers(eval_data)

    metrics = [faithfulness, answer_relevancy]  # Focus on content accuracy and relevance

    results = evaluate(
        eval_data,
        metrics=metrics,
        llm=None
    )

    print(results)
    results.to_pandas().to_csv("eval_results/email_agent_results.csv", index=False)