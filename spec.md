# RAG System Technical Architecture

## Project Overview
An AI-powered role-playing game where stories are dynamically generated and contextually aware using a memory system built on RAG (Retrieval-Augmented Generation).

## Technical Overview
Edge-first RAG system leveraging Cloudflare's infrastructure for a serverless, globally distributed architecture. All components are designed for edge deployment, ensuring minimal latency and maximum scalability.

## Infrastructure Components

### Model Layer
1. **Model Serving**
   - **Cloudflare Workers AI**
   - **Mixtral 7B Instruct**
     - Story generation
     - Game effect detection
     - Quest generation
   - **BGE-base-en-v1.5**
     - Memory embedding
     - Dimensionality: 768
     - Context window: 512 tokens

2. **API Structure**
   ```typescript
   interface GameWorker {
     generateStoryResponse: (action: GameAction, context: GameContext) => Promise<GameResponse>;
     interpretEffects: (action: GameAction, response: string) => Promise<GameEffect[]>;
     retrieveRelevantMemories: (request: MemoryContextRequest) => Promise<GameMemoryEntry[]>;
   }
   ```

### Data Storage Layer
1. **Vector Store**
   - Cloudflare Vectorize
   - Memory storage and retrieval
   - Configuration:
     - Dimension: 768 (matching BGE)
     - Metric: cosine similarity
     - Index type: HNSW
     - Metadata filtering

2. **Relational Storage**
   - Cloudflare D1
   - Schema:
   ```typescript
   interface Memory {
     id: string;
     player_id: string;
     type: string;
     content: string;
     location: string;
     importance: number;
     metadata: string;
     embedding: string;
     timestamp: string;
   }

   interface Player {
     id: string;
     name: string;
     class: string;
     level: number;
     experience: number;
     location: string;
     inventory: string;
     stats: string;
   }
   ```

3. **Cache Layer**
   - Cloudflare KV
   - Use cases:
     - Game state caching
     - Active effects
     - Temporary flags
     - Session data

## Application Architecture

### Game Worker
1. **Story Generation**
   ```typescript
   async function generateStoryResponse(action: GameAction, context: GameContext): Promise<GameResponse> {
     // Retrieve relevant memories
     const memories = await retrieveRelevantMemories({
       playerId: action.playerId,
       location: context.currentLocation,
       action: action.action
     });

     // Generate story with context
     const response = await AI.chat([
       {
         role: 'system',
         content: `You are a creative dungeon master. Context: ${context}`
       },
       {
         role: 'user',
         content: action.action
       }
     ]);

     // Interpret effects
     const effects = await interpretEffects(action, response);

     return { story: response, effects };
   }
   ```

2. **Memory Management**
   ```typescript
   async function storeMemory(entry: GameMemoryEntry): Promise<string> {
     // Generate embedding
     const embedding = await AI.embed(
       `${entry.location} ${entry.content}`
     );

     // Store in vector database
     await vectorize.insert([{
       id: entry.id,
       values: embedding,
       metadata: {
         playerId: entry.playerId,
         type: entry.type,
         content: entry.content,
         location: entry.location,
         importance: entry.importance
       }
     }]);

     // Store in relational database
     await db.insert('memories').values({
       ...entry,
       embedding: JSON.stringify(embedding)
     });

     return entry.id;
   }
   ```

### Memory Retrieval System
1. **Context-Based Search**
   - Location-aware memory filtering
   - Importance-based ranking
   - Temporal relevance
   - Player-specific context

2. **Memory Importance Scoring**
   - Vector similarity score
   - Memory importance weight
   - Temporal decay
   - Location relevance

## Development Environment

### Local Development
```bash
# Start local development
npm run dev

# Run tests
npm test

# Setup resources
npm run setup
```

## System Constraints
- Workers execution time: 30s
- KV entry size: 25MB
- D1 query timeout: 30s
- Vectorize query limit: 20 matches
- Memory embedding dimension: 768

## Monitoring
1. **Debug Logging**
   - Memory operations
   - Story generation
   - Effect detection
   - Vector search results

2. **Error Handling**
   - Graceful fallbacks
   - D1 fallback for vector search
   - Error response formatting
   - Debug mode toggle