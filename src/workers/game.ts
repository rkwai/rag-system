import { 
  GameAction, 
  GameContext, 
  GameResponse, 
  GameEffect,
  GameState,
  GameMemoryEntry,
  MemoryContextRequest
} from '../types/game';
import { Env, AIResponse } from '../types/env';
import { nanoid } from 'nanoid';

class GameWorker {
  private async generateStoryResponse(
    action: GameAction,
    context: GameContext,
    env: Env
  ): Promise<GameResponse> {
    try {
      // Retrieve relevant memories for context
      const memories = await this.retrieveRelevantMemories({
        playerId: action.playerId,
        location: context.currentLocation,
        action: action.action,
        limit: 3  // Limit to top 3 most relevant memories
      }, env);

      // Construct prompt with essential context only
      const prompt = {
        role: 'system',
        content: `You are a creative and engaging dungeon master. The player is in ${context.currentLocation}.
                 Their recent actions: ${context.gameHistory.slice(-2).map((h) => h.action).join(', ')}.
                 Relevant memories: ${memories.map(m => m.content).join(', ')}.`
      };

      const userPrompt = {
        role: 'user',
        content: action.action
      };

      // Generate response with a shorter timeout
      const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1', {
        messages: [prompt, userPrompt],
        max_tokens: 150,  // Limit response length
        temperature: 0.7
      });

      if (!response?.response) {
        throw new Error('Failed to generate story response');
      }

      // Parse effects from the response
      const effects = await this.interpretEffects(action, response.response, env);

      return {
        story: response.response,
        effects
      };
    } catch (error) {
      console.error('Failed to generate story response:', error);
      return {
        story: 'The dungeon master seems lost in thought...',
        effects: []
      };
    }
  }

  private async interpretEffects(
    action: GameAction,
    response: string,
    env: Env
  ): Promise<GameEffect[]> {
    try {
      const prompt = {
        role: 'system',
        content: `Analyze the following player action and story response. Extract any game effects that should occur (e.g. item found, location changed, quest progress). Return a JSON array of effects.`
      };

      const userPrompt = {
        role: 'user',
        content: `Action: ${action.action}\nResponse: ${response}`
      };

      const effectsResponse = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1', {
        messages: [prompt, userPrompt],
        max_tokens: 100,
        temperature: 0.3
      });

      try {
        if (!effectsResponse?.response) return [];
        const effects = JSON.parse(effectsResponse.response);
        return Array.isArray(effects) ? effects : [];
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Failed to interpret effects:', error);
      return [];
    }
  }

  private async retrieveRelevantMemories(
    memoryRequest: MemoryContextRequest,
    env: Env
  ): Promise<GameMemoryEntry[]> {
    try {
      const { playerId, location, action, limit = 5 } = memoryRequest;

      // Generate embedding for the current action
      const response = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
        text: `${location} ${action}`,
        dimensions: 768
      });

      if (!response?.embedding) {
        console.warn('Failed to generate embedding for memory retrieval');
        return [];
      }

      // Query vectorize for similar memories
      const memories = await env.MEMORIES_VECTORSTORE.query({
        values: response.embedding,
        topK: limit
      });

      if (!memories?.length) {
        return [];
      }

      return memories.map(memory => ({
        id: memory.id,
        playerId: memory.metadata.playerId,
        type: memory.metadata.type,
        content: memory.metadata.content,
        timestamp: new Date(memory.metadata.timestamp),
        location: memory.metadata.location,
        importance: memory.metadata.importance,
        metadata: memory.metadata.metadata
      }));
    } catch (error) {
      console.error('Failed to retrieve memories:', error);
      return [];
    }
  }

  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Handle game action
      if (request.method === 'POST' && path === '/game/action') {
        try {
          const { playerId, action, context }: {
            playerId: string;
            action: string;
            context: GameContext;
          } = await request.json();

          const gameAction: GameAction = {
            playerId,
            action,
            timestamp: new Date().toISOString()
          };

          const response = await this.generateStoryResponse(gameAction, context, env);

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Failed to process game action:', error);
          return new Response(JSON.stringify({
            error: 'Failed to process game action',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle game state storage
      if (request.method === 'POST' && path === '/game/state') {
        try {
          const { playerId, state }: { 
            playerId: string, 
            state: GameState 
          } = await request.json();

          // Store in KV
          await env.CACHE.put(
            `gameState:${playerId}`, 
            JSON.stringify({
              ...state,
              lastUpdated: new Date().toISOString()
            })
          );

          return new Response(JSON.stringify({ 
            success: true 
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Failed to save game state:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to save game state',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle game state retrieval
      if (request.method === 'GET' && path.startsWith('/game/state/')) {
        try {
          const playerId = path.split('/').pop();
          if (!playerId) {
            return new Response(JSON.stringify({ 
              error: 'Player ID is required' 
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const stateStr = await env.CACHE.get(`gameState:${playerId}`);
          if (!stateStr) {
            return new Response(JSON.stringify({ 
              error: 'Game state not found' 
            }), { 
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const state = JSON.parse(stateStr);
          return new Response(JSON.stringify(state), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Failed to retrieve game state:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to retrieve game state',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle memory storage
      if (request.method === 'POST' && path === '/game/memory') {
        try {
          const { playerId, entry }: { 
            playerId: string, 
            entry: Omit<GameMemoryEntry, 'id'> 
          } = await request.json();

          const memoryId = nanoid();
          
          // Generate embedding for the memory
          const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
            text: `${entry.location} ${entry.content}`,
            dimensions: 768
          });

          if (!embeddingResponse?.embedding) {
            return new Response(JSON.stringify({ 
              error: 'Failed to generate embedding' 
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Store in vectorize for semantic search
          await env.MEMORIES_VECTORSTORE.insert([{
            id: memoryId,
            values: embeddingResponse.embedding,
            metadata: {
              ...entry,
              id: memoryId,
              playerId,
              timestamp: entry.timestamp.toISOString()  // Ensure timestamp is string
            }
          }]);

          // Store in D1 database
          await env.DB.prepare(`
            INSERT INTO memories (
              id, player_id, type, content, location, importance, metadata, embedding, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            memoryId,
            playerId,
            entry.type,
            entry.content,
            entry.location,
            entry.importance || 0.5,
            JSON.stringify(entry.metadata || {}),
            JSON.stringify(embeddingResponse.embedding),
            entry.timestamp.toISOString()
          ).run();

          return new Response(JSON.stringify({ 
            success: true,
            memoryId 
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Failed to store memory:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to store memory',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle memory context retrieval
      if (request.method === 'POST' && path === '/game/memory/context') {
        try {
          const memoryRequest: MemoryContextRequest = await request.json();
          const memories = await this.retrieveRelevantMemories(memoryRequest, env);

          return new Response(JSON.stringify(memories), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Failed to retrieve memory context:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to retrieve memory context',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ 
        error: 'Not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Game Worker Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

export default new GameWorker(); 