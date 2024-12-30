## RAG Evaluation Flow for Article Writing Agent

```mermaid
sequenceDiagram
    participant User
    participant RunScript as run_evals.sh
    participant MainEval as AgentEvaluator
    participant RAGEval as RAGEvaluator
    participant Model as LLM Model
    participant FileSystem as File System

    User->>RunScript: ./run_evals.sh -a article_writing -e rag
    
    RunScript->>MainEval: python evals/agent_evaluator.py article_writing rag
    
    MainEval->>MainEval: Initialize evaluators
    Note over MainEval: Creates RAGEvaluator instance
    
    MainEval->>RAGEval: evaluate()
    
    RAGEval->>FileSystem: Load data/article_writing_agent_eval_data.json
    FileSystem-->>RAGEval: Return test cases
    Note over RAGEval: Test cases contain:<br/>1. Article topics/queries<br/>2. Required research points<br/>3. Ground truth facts
    
    loop For each test case
        RAGEval->>Model: Query model for context retrieval
        Note over Model: Model retrieves relevant context<br/>from knowledge base
        Model-->>RAGEval: Return retrieved chunks
        
        RAGEval->>RAGEval: validate_retrieval()
        Note over RAGEval: Check:<br/>1. Recall (found relevant info)<br/>2. Precision (info is relevant)<br/>3. Coverage (info is complete)
        
        RAGEval->>Model: Generate article content
        Note over Model: Model generates article using<br/>retrieved context
        Model-->>RAGEval: Return generated article
        
        RAGEval->>RAGEval: validate_generation()
        Note over RAGEval: Check:<br/>1. Factual accuracy<br/>2. Completeness<br/>3. Relevance to topic
        
        RAGEval->>RAGEval: Collect metrics
        Note over RAGEval: Track scores for:<br/>- Retrieval quality<br/>- Generation quality
    end
    
    RAGEval->>RAGEval: Calculate final scores
    Note over RAGEval: Average scores across test cases
    
    RAGEval->>FileSystem: Save eval_results/article_writing_rag_results.json
    
    RAGEval-->>MainEval: Return results
    
    MainEval->>MainEval: Print results
    Note over MainEval: Display:<br/>1. Retrieval metrics<br/>2. Generation metrics
    
    MainEval-->>RunScript: Evaluation complete
    RunScript-->>User: Show completion message
```

This diagram shows how we evaluate the article writing agent's RAG capabilities:

1. **Test Case Loading**:
   - Load test cases with article topics
   - Each case includes required research points and facts
   - Ground truth contains expected content and facts

2. **Retrieval Evaluation**:
   - Model retrieves relevant context
   - Evaluate if retrieved content:
     - Contains required information (recall)
     - Is relevant to topic (precision)
     - Covers all needed points (coverage)

3. **Generation Evaluation**:
   - Model generates article using context
   - Evaluate if generated article:
     - States facts correctly
     - Covers all required points
     - Stays relevant to topic

4. **Metrics Collection**:
   - Retrieval metrics:
     - Recall: Found relevant information
     - Precision: Information is relevant
     - Coverage: Information is complete
   - Generation metrics:
     - Factual accuracy
     - Completeness
     - Topic relevance

5. **Results**:
   - Save detailed metrics
   - Show retrieval and generation scores 