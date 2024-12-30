import json
import os
import pandas as pd
from typing import Dict, Any, List

class BaseEvaluator:
    """Base class for all evaluators"""
    
    def __init__(self, agent_type: str):
        self.agent_type = agent_type
        
    def load_data(self, file_path: str) -> pd.DataFrame:
        """Load evaluation data from JSON file"""
        with open(file_path, 'r') as f:
            data = json.load(f)
        return pd.DataFrame(data)
    
    def save_results(self, results: Dict[str, float], eval_type: str):
        """Save evaluation results"""
        os.makedirs('eval_results', exist_ok=True)
        output_file = f"eval_results/{self.agent_type}_{eval_type}_results.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
    def evaluate(self, mock_responses: Dict[str, Any] = None):
        """Base evaluate method to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement evaluate()") 