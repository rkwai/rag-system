from typing import Dict, Any, List
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
from datasets import Dataset
from .base_evaluator import BaseEvaluator

class RAGEvaluator(BaseEvaluator):
    """Evaluator for RAG (Retrieval-Augmented Generation) quality using RAGAs framework"""
    
    def prepare_dataset(self, eval_data: List[Dict[str, Any]]) -> Dataset:
        """Convert evaluation data to RAGAs dataset format"""
        formatted_data = []
        for item in eval_data:
            formatted_data.append({
                'question': item['query'],
                'contexts': item['ground_truth']['relevant_context'],
                'answer': item.get('response', {}).get('generated_response', ''),
                'ground_truths': item['ground_truth']['facts']
            })
        return Dataset.from_list(formatted_data)

    async def evaluate(self, mock_responses: Dict[str, Any] = None):
        """Run RAG evaluation pipeline using RAGAs metrics"""
        # Load test data
        data_file = f"data/{self.agent_type}_rag_eval_data.json"
        eval_data = self.load_data(data_file)
        
        # Prepare dataset in RAGAs format
        dataset = self.prepare_dataset(eval_data)
        
        # Define metrics to evaluate
        metrics = [
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall
        ]
        
        # Run RAGAs evaluation
        results = evaluate(
            dataset=dataset,
            metrics=metrics
        )
        
        # Format results
        final_results = {
            'retrieval': {
                'context_relevancy': results['context_precision'],
                'context_recall': results['context_recall']
            },
            'generation': {
                'faithfulness': results['faithfulness'],
                'answer_relevancy': results['answer_relevancy']
            }
        }
        
        # Save results
        self.save_results(final_results, 'rag')
        
        return final_results 