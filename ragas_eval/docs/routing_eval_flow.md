## Routing Evaluation Flow

```mermaid
sequenceDiagram
    participant User
    participant RunScript as run_evals.sh
    participant MainEval as AgentEvaluator
    participant Router as RoutingEvaluator
    participant Model as LLM Model
    participant FileSystem as File System

    User->>RunScript: ./run_evals.sh -a executive -e routing
    
    RunScript->>MainEval: python evals/agent_evaluator.py executive routing
    
    MainEval->>MainEval: Initialize evaluators
    Note over MainEval: Creates RoutingEvaluator instance
    
    MainEval->>Router: evaluate()
    
    Router->>FileSystem: Load data/executive_routing_eval_data.json
    FileSystem-->>Router: Return test cases
    
    loop For each test case
        Router->>Model: Query model with test case
        Note over Model: Model decides which agents to call<br/>and in what sequence
        Model-->>Router: Return function calls
        
        Router->>Router: validate_routing(model_response, expected_calls)
        Note over Router: Compare model's routing decisions<br/>against ground truth
        Router->>Router: Collect metrics
    end
    
    Router->>Router: Calculate final scores
    Note over Router: Average routing_accuracy<br/>Average sequence_accuracy
    
    Router->>FileSystem: Save eval_results/executive_routing_results.json
    
    Router-->>MainEval: Return results
    
    MainEval->>MainEval: Print results
    Note over MainEval: Display routing_accuracy<br/>Display sequence_accuracy
    
    MainEval-->>RunScript: Evaluation complete
    RunScript-->>User: Show completion message
```

This diagram shows how we test the model's routing decisions:

1. User runs the evaluation script
2. System loads test cases with known correct routings
3. For each test case:
   - Send the query to the actual LLM model
   - Model makes routing decisions (which agents to call)
   - Compare model's decisions against expected routing
4. Calculate how often the model:
   - Calls the correct set of agents (routing accuracy)
   - Calls them in the correct order (sequence accuracy)
5. Results show how well the model routes queries to agents 