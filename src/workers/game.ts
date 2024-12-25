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
        limit: 3
      }, env);

      // Construct prompt with essential context only
      const prompt = {
        role: 'system',
        content: `You are a creative and engaging dungeon master. Generate both a story response and game effects.
                 The player is in ${context.currentLocation}.
                 Their recent actions: ${context.gameHistory.slice(-2).map((h) => h.action).join(', ')}.
                 Relevant memories: ${memories.map(m => m.content).join(', ')}.
                 
                 Return your response in the following format (exactly as shown):
                 {
                   "story": "<your narrative response>",
                   "effects": [
                     {
                       "type": "<item|location|quest|status>",
                       "action": "<action string>",
                       "data": {
                         // data fields based on type
                       }
                     }
                   ]
                 }
                 
                 Effect types and their data:
                 - item: {"id": "<string>", "quantity": <number>}
                 - location: {"name": "<string>", "description": "<string>"}
                 - quest: {"id": "<string>", "progress": <number>}
                 - status: {"type": "<string>", "value": <number>}
                 
                 Important:
                 1. Use only ASCII characters in the response
                 2. Escape all quotes in strings
                 3. No line breaks in strings
                 4. Keep story concise but engaging
                 5. Format the response as valid JSON with no special characters`
      };

      const userPrompt = {
        role: 'user',
        content: action.action
      };

      // Generate combined story and effects response
      const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1', {
        messages: [prompt, userPrompt],
        max_tokens: 1000,
        temperature: 0.8
      }) as AITextResponse;

      if (!response?.response) {
        throw new Error('Failed to generate story response');
      }

      try {
        // Clean the response string before parsing
        const cleanedResponse = response.response
          .replace(/[\u0000-\u001F\u007F-\u009F]+/g, '') // Remove all control characters
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\\"/g, '"') // Fix escaped quotes
          .replace(/"{2,}/g, '"') // Fix multiple quotes
          .replace(/([^\\])"([^:,}\]])/g, '$1\\"$2') // Escape unescaped quotes in values
          .trim();

        let parsed;
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (jsonError) {
          // If direct parsing fails, try to extract JSON using regex
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw jsonError;
          }
        }

        const effects = this.validateAndProcessEffects(parsed.effects || []);

        // Store important events as memories
        const memoryEffects = effects.filter(effect => 
          (effect.type === 'quest' || 
           (effect.type === 'item' && effect.action === 'add') ||
           effect.type === 'location')
        );

        if (memoryEffects.length > 0) {
          await this.storeMemories(action.playerId, memoryEffects, parsed.story, env);
        }

        return {
          story: parsed.story,
          effects
        };
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, '\nResponse was:', response.response);
        // If parsing fails, still return the response as story with no effects
        return {
          story: response.response
            .replace(/[\u0000-\u001F\u007F-\u009F]+/g, '') // Clean control characters
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .trim(),
          effects: []
        };
      }
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
        content: `You are a game engine that analyzes story text to extract game effects. 
        Extract ALL effects that should occur based on the story, including:
        
        - ITEM: Item changes (format: {type: "item", action: "add"|"remove"|"use", data: {id: string, quantity: number}})
        - LOCATION: Location changes (format: {type: "location", action: "move", data: {name: string, description: string}})
        - QUEST: Quest updates (format: {type: "quest", action: "start"|"update"|"complete", data: {id: string, progress: number}})
        - STATUS: Status changes (format: {type: "status", action: "update", data: {type: string, value: number}})
        
        Return a JSON array of effects. Each effect must follow the format: {type, action, data}.
        Be thorough but only extract effects that are explicitly or strongly implied in the text.
        The type must be one of: "item", "location", "quest", or "status".`
      };

      const userPrompt = {
        role: 'user',
        content: `Player Action: ${action.action}\n\nStory Response: ${response}\n\nExtract all game effects from this interaction.`
      };

      const effectsResponse = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1', {
        messages: [prompt, userPrompt],
        max_tokens: 500,
        temperature: 0.2  // Lower temperature for more consistent parsing
      }) as AITextResponse;

      if (!effectsResponse?.response) return [];

      let effects: GameEffect[] = [];
      try {
        const parsedEffects = JSON.parse(effectsResponse.response);
        effects = this.validateAndProcessEffects(parsedEffects);
      } catch (parseError) {
        console.error('Failed to parse effects:', parseError);
        return [];
      }

      // Store important events as memories
      const memoryEffects = effects.filter(effect => 
        (effect.type === 'quest' || 
         (effect.type === 'item' && effect.action === 'add') ||
         effect.type === 'location')
      );

      if (memoryEffects.length > 0) {
        await this.storeMemories(action.playerId, memoryEffects, response, env);
      }

      return effects;
    } catch (error) {
      console.error('Failed to interpret effects:', error);
      return [];
    }
  }

  private validateAndProcessEffects(parsedEffects: any[]): GameEffect[] {
    if (!Array.isArray(parsedEffects)) return [];

    return parsedEffects.filter(effect => {
      // Validate effect structure
      if (!effect || typeof effect !== 'object') return false;
      if (!effect.type || !effect.action || !effect.data) return false;

      // Validate type is one of the allowed types
      if (!['item', 'location', 'quest', 'status'].includes(effect.type)) return false;

      return this.validateEffect(effect);
    }).map(effect => ({
      type: effect.type as 'item' | 'location' | 'quest' | 'status',
      action: effect.action,
      data: effect.data
    }));
  }

  private validateEffect(effect: any): boolean {
    // Validate common structure
    if (!effect.type || !effect.action || !effect.data) return false;

    // Validate data based on type
    switch (effect.type) {
      case 'item':
        return (
          ['add', 'remove', 'use'].includes(effect.action) &&
          typeof effect.data.id === 'string' &&
          typeof effect.data.quantity === 'number'
        );
      case 'status':
        return (
          effect.action === 'update' &&
          typeof effect.data.type === 'string' &&
          typeof effect.data.value === 'number'
        );
      case 'location':
        return (
          effect.action === 'move' &&
          typeof effect.data.name === 'string' &&
          typeof effect.data.description === 'string'
        );
      case 'quest':
        return (
          ['start', 'update', 'complete'].includes(effect.action) &&
          typeof effect.data.id === 'string' &&
          typeof effect.data.progress === 'number'
        );
      default:
        return false;
    }
  }

  private async storeMemories(
    playerId: string,
    effects: GameEffect[],
    storyResponse: string,
    env: Env
  ): Promise<void> {
    for (const effect of effects) {
      let content = '';
      let importance = 0.5;

      switch (effect.type) {
        case 'quest':
          content = `Quest ${effect.action}: ${effect.data.id}`;
          importance = 0.8;
          break;
        case 'item':
          if (effect.action === 'add') {
            content = `Found item: ${effect.data.id} (x${effect.data.quantity})`;
            importance = 0.6;
          }
          break;
        case 'location':
          content = `Moved to ${effect.data.name}: ${effect.data.description}`;
          importance = 0.7;
          break;
      }

      if (!content) continue;

      const memoryId = nanoid();
      const memoryEntry: Omit<GameMemoryEntry, 'id'> = {
        playerId,
        type: effect.type,
        content,
        location: effect.type === 'location' ? effect.data.name : 'unknown',
        importance,
        timestamp: new Date(),
        metadata: {
          source: 'story_generation',
          originalEffect: effect,
          storyContext: storyResponse
        }
      };

      try {
        // Generate embedding for the memory
        const text = `${memoryEntry.location} ${content}`;
        const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: text
        }) as AIEmbeddingResponse;

        if (!embeddingResponse?.data?.[0]) {
          throw new Error('Failed to generate embedding');
        }

        const embedding = Array.from(embeddingResponse.data[0]);

        // Store in vectorize
        const metadata = this.createVectorMetadata(memoryEntry, playerId, memoryId);
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
          memoryEntry.type,
          memoryEntry.content,
          memoryEntry.location,
          memoryEntry.importance,
          JSON.stringify(memoryEntry.metadata),
          JSON.stringify(embedding),
          memoryEntry.timestamp.toISOString()
        ).run();

      } catch (error) {
        console.error('Error storing memory:', error);
      }
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