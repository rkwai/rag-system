import asyncio
import sys
from typing import Dict, Any, List

class AgentEvaluator:
    """Main evaluator that coordinates all evaluation types"""
    
    def __init__(self, agent_type: str):
        self.agent_type = agent_type
        # Import evaluators here to avoid circular imports
        from ragas_eval.evals.routing_evaluator import RoutingEvaluator
        from ragas_eval.evals.function_evaluator import FunctionEvaluator
        from ragas_eval.evals.rag_evaluator import RAGEvaluator
        
        self.routing_evaluator = RoutingEvaluator(agent_type)
        self.function_evaluator = FunctionEvaluator(agent_type)
        self.rag_evaluator = RAGEvaluator(agent_type)
    
    async def evaluate(self, eval_types: List[str] = None):
        """Run specified evaluations"""
        if eval_types is None:
            eval_types = ['routing', 'function', 'rag']
            
        results = {}
        
        if 'routing' in eval_types:
            print(f"\nEvaluating {self.agent_type} routing...")
            routing_results = await self.routing_evaluator.evaluate()
            results['routing'] = routing_results
            print(f"\nFinal Routing Results:")
            
            # Handle both list and dictionary return types
            if isinstance(routing_results['routing_accuracy'], list):
                print(f"Routing Accuracy: {routing_results['routing_accuracy'][0]*100:.2f}%")
                print(f"Sequence Accuracy: {routing_results['sequence_accuracy'][0]*100:.2f}%")
                print(f"Context Usage: {routing_results['context_usage'][0]*100:.2f}%")
                print(f"Completeness: {routing_results['completeness'][0]*100:.2f}%")
            else:
                print(f"Routing Accuracy: {routing_results['routing_accuracy']*100:.2f}%")
                print(f"Sequence Accuracy: {routing_results['sequence_accuracy']*100:.2f}%")
                print(f"Context Usage: {routing_results['context_usage']*100:.2f}%")
                print(f"Completeness: {routing_results['completeness']*100:.2f}%")
            
        if 'function' in eval_types:
            print(f"\nEvaluating {self.agent_type} function calls...")
            function_results = await self.function_evaluator.evaluate()
            results['function'] = function_results
            print(f"Parameter Presence: {function_results['param_presence']*100:.2f}%")
            print(f"Parameter Type Correctness: {function_results['param_type']*100:.2f}%")
            print(f"Parameter Value Correctness: {function_results['param_value']*100:.2f}%")
            
        if 'rag' in eval_types:
            print(f"\nEvaluating {self.agent_type} RAG quality...")
            rag_results = await self.rag_evaluator.evaluate()
            results['rag'] = rag_results
            print("\nRetrieval Metrics:")
            for metric, value in rag_results['retrieval'].items():
                print(f"{metric.title()}: {value*100:.2f}%")
            print("\nGeneration Metrics:")
            for metric, value in rag_results['generation'].items():
                print(f"{metric.title()}: {value*100:.2f}%")
                
        return results

async def main():
    """Run evaluation for specified agent and evaluation types"""
    # Get agent type and evaluation types from command line
    if len(sys.argv) < 2:
        print("Usage: python agent_evaluator.py <agent_type> [eval_types...]")
        print("Available agent types: email, appointment, article_writing, research, executive")
        print("Available eval types: routing, function, rag")
        sys.exit(1)
        
    agent_type = sys.argv[1]
    eval_types = sys.argv[2:] if len(sys.argv) > 2 else None
    
    evaluator = AgentEvaluator(agent_type)
    results = await evaluator.evaluate(eval_types)
    
    print(f"\n{agent_type} Agent Evaluation Complete!")
    print("Detailed results saved in eval_results/")

if __name__ == "__main__":
    asyncio.run(main()) 