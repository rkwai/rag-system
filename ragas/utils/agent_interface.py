# utils/agent_interface.py
import openai
import yaml

with open("config/config.yaml", "r") as f:
    config = yaml.safe_load(f)

openai.api_key = config['llm']['api_key']
llm_model = config['llm']['model_name']

def call_executive_agent(user_query):
    # Logic to run your executive agent based on the query
    # This might involve parsing the query and calling other agents
    # For simplicity, let's assume it directly uses an LLM with the executive prompt
    response = openai.chat.completions.create(
        model=llm_model,
        messages=[
            {"role": "system", "content": config['prompts']['executive_agent']['instruction']},
            {"role": "user", "content": user_query}
        ]
    )
    return response.choices[0].message.content

# ... Similar functions for other agents (call_email_agent, call_appointment_agent, etc.) ...