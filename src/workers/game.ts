import { 
  GameAction, 
  GameContext, 
  GameResponse, 
  GameEffect,
  GameState,
  GameMemoryEntry,
  MemoryContextRequest
} from '../types/game';
import { Env } from '../types/env';
import { nanoid } from 'nanoid';
import type { VectorizeVector } from '@cloudflare/workers-types';

interface AIEmbeddingResponse {
  data: number[][];
}

interface AITextResponse {
  response: string;
}

interface VectorizeQueryResult {
  matches: Array<{
    id: string;
    score: number;
    metadata?: {
      playerId?: string;
      type?: string;
      content?: string;
      timestamp?: string;
      location?: string;
      importance?: string;
      metadata?: string;
    };
  }>;
}

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
      }) as AITextResponse;

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
      }) as AITextResponse;

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

  private createVectorMetadata(entry: Omit<GameMemoryEntry, 'id'>, playerId: string, memoryId: string): Record<string, string> {
    // Ensure all values are strings and properly formatted
    return {
      playerId: String(playerId),
      type: String(entry.type),
      content: String(entry.content),
      location: String(entry.location),
      timestamp: (entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)).toISOString(),
      importance: String(entry.importance || 0.5),
      metadata: JSON.stringify(entry.metadata || {})
    };
  }

  private async retrieveRelevantMemories(
    memoryRequest: MemoryContextRequest,
    env: Env
  ): Promise<GameMemoryEntry[]> {
    try {
      const { playerId, location, action, limit = 5 } = memoryRequest;

      // First try to get all memories for the player from D1
      const dbMemories = await env.DB.prepare(`
        SELECT * FROM memories WHERE player_id = ? ORDER BY importance DESC LIMIT ?
      `).bind(playerId, limit).all();

      const mapDbToMemory = (m: any): GameMemoryEntry => ({
        id: String(m.id),
        playerId: String(m.player_id),
        type: String(m.type),
        content: String(m.content),
        timestamp: new Date(String(m.timestamp)),
        location: String(m.location),
        importance: Number(m.importance),
        metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : {}
      });

      // Generate embedding for the current action
      const text = `${location} ${action}`;
      const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: text
      }) as AIEmbeddingResponse;

      if (!embeddingResponse?.data?.[0]) {
        console.warn('Failed to generate embedding');
        // Return importance-sorted memories from D1 as fallback
        return (dbMemories.results || [])
          .map(mapDbToMemory)
          .sort((a, b) => b.importance - a.importance)
          .slice(0, limit);
      }

      const embedding = Array.from(embeddingResponse.data[0]);
      if (!Array.isArray(embedding) || embedding.length !== 768) {
        console.error('Invalid embedding format');
        return [];
      }

      // Query vectorize for similar memories with a larger topK
      const results = await env.MEMORIES_VECTORSTORE.query(embedding, {
        topK: Math.max(limit * 3, 20), // Get more results for better filtering
      }) as VectorizeQueryResult;

      if (!results?.matches?.length) {
        console.warn('No matching memories found in vector store, falling back to D1 results');
        // Return importance-sorted memories from D1 as fallback
        return (dbMemories.results || [])
          .map(mapDbToMemory)
          .sort((a, b) => b.importance - a.importance)
          .slice(0, limit);
      }

      // Process and filter results
      const memories = results.matches
        .filter(match => {
          const hasMetadata = !!match.metadata;
          const matchPlayerId = match.metadata?.playerId;
          return hasMetadata && String(matchPlayerId) === String(playerId);
        })
        .map(match => {
          const metadata = match.metadata!;
          return {
            id: String(match.id),
            playerId: String(metadata.playerId),
            type: String(metadata.type),
            content: String(metadata.content),
            timestamp: new Date(String(metadata.timestamp)),
            location: String(metadata.location),
            importance: Number(metadata.importance),
            metadata: metadata.metadata ? JSON.parse(String(metadata.metadata)) : {},
            score: match.score || 0
          };
        })
        .sort((a, b) => {
          // Sort by combination of vector similarity score and importance
          const scoreA = (a.score || 0) * (a.importance || 0.5);
          const scoreB = (b.score || 0) * (b.importance || 0.5);
          return scoreB - scoreA;
        })
        .slice(0, limit); // Take only the requested number of memories

      return memories.length > 0 ? memories : (dbMemories.results || [])
        .map(mapDbToMemory)
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);
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

          await env.CACHE.put(
            `gameState:${playerId}`, 
            JSON.stringify({
              ...state,
              lastUpdated: new Date().toISOString()
            })
          );

          return new Response(JSON.stringify({ success: true }), {
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
          const text = `${entry.location} ${entry.content}`;
          const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: text
          }) as AIEmbeddingResponse;

          if (!embeddingResponse?.data?.[0]) {
            console.error('Failed to generate embedding');
            return new Response(JSON.stringify({ 
              error: 'Failed to generate embedding'
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const embedding = Array.from(embeddingResponse.data[0]);
          
          // First verify player exists
          const player = await env.DB.prepare(
            'SELECT id FROM players WHERE id = ?'
          ).bind(playerId).first();

          if (!player) {
            console.error('Player not found:', playerId);
            return new Response(JSON.stringify({ 
              error: 'Player not found'
            }), { 
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Store in vectorize
          const metadata = this.createVectorMetadata(entry, playerId, memoryId);
          const vectorData: VectorizeVector = {
            id: memoryId,
            values: embedding,
            metadata
          };

          await env.MEMORIES_VECTORSTORE.insert([vectorData]);

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
            JSON.stringify(embedding),
            (entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)).toISOString()
          ).run();

          // Verify the memory was stored by trying to retrieve it
          const results = await env.MEMORIES_VECTORSTORE.query(embedding, {
            topK: 1,
            filter: { playerId }
          }) as VectorizeQueryResult;

          if (!results?.matches?.length) {
            console.warn('Memory stored but not immediately retrievable');
          }

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