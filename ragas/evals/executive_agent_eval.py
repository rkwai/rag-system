from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_relevancy, harmfulness, context_recall
import pandas as pd
import json
from utils.agent_interface import call_executive_agent

def load_data(file_path):
    data = []
    with open(file_path, 'r') as f:
        for line in f:
            data.append(json.loads(line))
    return pd.DataFrame(data)

def generate_answers(data):
    data['answer'] = data['query'].apply(call_executive_agent)
    return data

if __name__ == "__main__":
    eval_data = load_data("data/executive_agent_eval_data.jsonl")
    eval_data = generate_answers(eval_data)

    # Define a subset of metrics relevant to the executive agent
    metrics = [faithfulness, answer_relevancy, context_relevancy]

    results = evaluate(
        eval_data,
        metrics=metrics,
        llm=None  # If you want to use the default RAGAs LLM, otherwise configure it
    )

    print(results)
    results.to_pandas().to_csv("eval_results/executive_agent_results.csv", index=False)