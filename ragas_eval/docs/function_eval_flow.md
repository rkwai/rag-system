## Function Call Evaluation Flow

```mermaid
sequenceDiagram
    participant User
    participant RunScript as run_evals.sh
    participant MainEval as AgentEvaluator
    participant FuncEval as FunctionEvaluator
    participant Model as LLM Model
    participant FileSystem as File System

    User->>RunScript: ./run_evals.sh -a email -e function
    
    RunScript->>MainEval: python evals/agent_evaluator.py email function
    
    MainEval->>MainEval: Initialize evaluators
    Note over MainEval: Creates FunctionEvaluator instance
    
    MainEval->>FuncEval: evaluate()
    
    FuncEval->>FileSystem: Load data/email_function_eval_data.json
    FileSystem-->>FuncEval: Return test cases
    Note over FuncEval: Test cases contain queries and<br/>expected function parameters
    
    loop For each test case
        FuncEval->>Model: Query model with test case
        Note over Model: Model generates function call with:<br/>- recipient<br/>- subject<br/>- body<br/>- attachments<br/>- cc/bcc
        Model-->>FuncEval: Return function call details
        
        FuncEval->>FuncEval: validate_parameters(model_response, expected_params)
        Note over FuncEval: Check:<br/>1. Required params present<br/>2. Parameter types correct<br/>3. Parameter values valid
        
        FuncEval->>FuncEval: Collect metrics
        Note over FuncEval: Track:<br/>- param_presence score<br/>- param_type score<br/>- param_value score
    end
    
    FuncEval->>FuncEval: Calculate final scores
    Note over FuncEval: Average scores across all test cases
    
    FuncEval->>FileSystem: Save eval_results/email_function_results.json
    
    FuncEval-->>MainEval: Return results
    
    MainEval->>MainEval: Print results
    Note over MainEval: Display:<br/>- Parameter Presence<br/>- Type Correctness<br/>- Value Correctness
    
    MainEval-->>RunScript: Evaluation complete
    RunScript-->>User: Show completion message
```

This diagram shows how we test the email agent's function call parameter handling:

1. User runs evaluation specifically for email agent's function calls
2. System loads test cases with expected parameter specifications
3. For each test case:
   - Send query to LLM model
   - Model generates email function call with parameters
   - Validate parameters against expectations:
     - Are required parameters (recipient, subject, body) present?
     - Are parameter types correct (e.g., array for cc/bcc)?
     - Are values valid (e.g., valid email format)?
4. Calculate scores for:
   - Parameter presence (completeness)
   - Type correctness (format)
   - Value validity (constraints)
5. Results show how well the model structures email function calls 