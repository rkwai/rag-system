from typing import Dict, Any, List
import json
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
from .base_evaluator import BaseEvaluator
from utils.llm_interface import LLMInterface

class FunctionEvaluator(BaseEvaluator):
    """Evaluator for function call parameters using ragas metrics"""
    
    def __init__(self, agent_type: str):
        super().__init__(agent_type)
        self.llm = LLMInterface()
    
    def prepare_dataset(self, eval_data: List[Dict[str, Any]], responses: List[Dict[str, Any]]) -> Dataset:
        """Convert evaluation data to ragas dataset format"""
        formatted_data = []
        for test_case, response in zip(eval_data, responses):
            # Format function calls into a structured description
            actual_calls = response.get('function_calls', [])
            call_descriptions = []
            
            # Describe function parameters
            for call in actual_calls:
                params = call.get('args', {})
                param_desc = [f"{k}={v}" for k, v in params.items()]
                call_descriptions.append(f"{call['name']} parameters: {', '.join(param_desc)}")
            
            # Get ground truth statements about parameters
            ground_truths = []
            if 'parameters' in test_case.get('ground_truth', {}):
                for func, params in test_case['ground_truth']['parameters'].items():
                    for param, spec in params.items():
                        if spec.get('required', True):
                            ground_truths.append(f"{func} requires {param}")
                        if 'type' in spec:
                            ground_truths.append(f"{func}'s {param} must be {spec['type']}")
                        if 'min_length' in spec:
                            ground_truths.append(f"{func}'s {param} must be at least {spec['min_length']} characters")
                        if 'min_items' in spec:
                            ground_truths.append(f"{func}'s {param} must have at least {spec['min_items']} items")
                        if 'should_contain' in spec:
                            ground_truths.append(f"{func}'s {param} must contain {spec['should_contain']}")
            
            formatted_data.append({
                'question': test_case['query'],
                'contexts': test_case.get('contexts', [test_case.get('context', '')]),
                'answer': '\n'.join(call_descriptions),
                'ground_truths': ground_truths
            })
        return Dataset.from_list(formatted_data)

    async def evaluate(self):
        """Run function evaluation pipeline using ragas metrics"""
        # Load test data
        data_file = f"data/{self.agent_type}_agent_eval_data.json"
        with open(data_file, 'r') as f:
            eval_data = json.load(f)
        
        # Collect model responses
        model_responses = []
        
        # Get model's function calls for each test case
        for test_case in eval_data:
            model_response = await self.get_model_function_calls(
                test_case['query'],
                test_case.get('context', '')
            )
            model_responses.append(model_response)
            
            # Print raw responses for debugging
            print(f"\nTest case: {test_case['query']}")
            print(f"Model response: {model_response}")
        
        # Prepare dataset for ragas evaluation
        dataset = self.prepare_dataset(eval_data, model_responses)
        
        # Define metrics to evaluate
        metrics = [
            faithfulness(),         # Are parameter values correct?
            answer_relevancy(),     # Are parameters relevant to query?
            context_precision(),    # Are parameters using context correctly?
            context_recall()        # Are all required parameters included?
        ]
        
        # Run ragas evaluation
        results = evaluate(
            dataset=dataset,
            metrics=metrics
        )
        
        # Format results
        final_results = {
            'param_presence': results['context_recall'],      # Are all required parameters present?
            'param_type': results['context_precision'],       # Are parameter types correct?
            'param_value': results['faithfulness']           # Are parameter values correct?
        }
        
        # Save results
        self.save_results(final_results, 'function')
        
        return final_results 