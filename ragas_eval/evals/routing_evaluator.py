from typing import Dict, Any, List
import json
import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import AspectCritic
from .base_evaluator import BaseEvaluator
from utils.llm_interface import LLMInterface

class RoutingEvaluator(BaseEvaluator):
    """Evaluator for agent routing and function call decisions using ragas metrics"""
    
    def __init__(self, agent_type: str):
        super().__init__(agent_type)
        self.llm = LLMInterface()
    
    async def get_model_routing(self, query: str, context: str = '') -> Dict[str, Any]:
        """Get model's routing decisions for a given query"""
        response = await self.llm.get_routing_decision(query, context)
        return response

    def prepare_dataset(self, eval_data: List[Dict[str, Any]], responses: List[Dict[str, Any]]) -> Dataset:
        """Convert evaluation data to ragas dataset format"""
        formatted_data = []
        for test_case, response in zip(eval_data, responses):
            # Format function calls into a structured description
            actual_calls = response.get('function_calls', [])
            call_descriptions = []
            
            # Describe routing sequence
            call_sequence = [call['name'] for call in actual_calls]
            call_descriptions.append(f"Routing sequence: {' -> '.join(call_sequence)}")
            
            # Describe function parameters
            for call in actual_calls:
                params = call.get('args', {})
                param_desc = [f"{k}={v}" for k, v in params.items()]
                call_descriptions.append(f"{call['name']} parameters: {', '.join(param_desc)}")
            
            formatted_data.append({
                'question': test_case['query'],
                'contexts': test_case.get('contexts', [test_case.get('context', '')]),
                'answer': '\n'.join(call_descriptions),
                'ground_truths': test_case.get('ground_truths', [])
            })
        return Dataset.from_list(formatted_data)

    async def evaluate(self):
        """Run routing evaluation pipeline using ragas metrics"""
        # Load test data
        data_file = f"data/{self.agent_type}_agent_eval_data.json"
        with open(data_file, 'r') as f:
            eval_data = json.load(f)
        
        # Collect model responses
        model_responses = []
        
        # Get model's routing decisions for each test case
        for test_case in eval_data:
            model_response = await self.get_model_routing(
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
            AspectCritic(name="context_usage", definition="Verify if the routing decisions appropriately use the provided context."),
            AspectCritic(name="routing_accuracy", definition="Verify if the routing sequence is accurate and relevant to the query."),
            AspectCritic(name="sequence_accuracy", definition="Verify if the routing sequence follows the expected order from ground truth."),
            AspectCritic(name="completeness", definition="Verify if all required routing steps are included.")
        ]
        
        # Run ragas evaluation
        results = evaluate(
            dataset=dataset,
            metrics=metrics
        )
        
        # Format results
        final_results = {
            'routing_accuracy': results['routing_accuracy'],      # How relevant routing is to query
            'sequence_accuracy': results['sequence_accuracy'],    # How well routing follows ground truth
            'context_usage': results['context_usage'],           # How well routing uses context
            'completeness': results['completeness']              # How complete the routing is
        }
        
        # Save results
        self.save_results(final_results, 'routing')
        
        return final_results 