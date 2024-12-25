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

      // Construct prompt with essential context and structured format
      const prompt = {
        role: 'system',
        content: `You are a game master for an RPG. Generate engaging story responses in a structured format.

Current Context:
- Location: ${context.currentLocation}
- Recent Actions: ${context.gameHistory.slice(-2).map((h) => h.action).join(', ')}
- Relevant Memories: ${memories.map(m => m.content).join(', ')}

Respond in this exact format:
[NARRATIVE]
{Write an engaging story response here using only ASCII characters. Keep it concise but immersive.}
[/NARRATIVE]

[EFFECTS]
- INVENTORY: {List item changes as +/- ItemName}
- LOCATION: {Current location name}
- ATTRIBUTES: {List attribute changes as Name +/- Value}
- STATUS: {List status effects gained/lost}
[/EFFECTS]

Important:
1. Keep responses concise and use only ASCII characters
2. Always include both NARRATIVE and EFFECTS sections
3. Make effects clear and unambiguous
4. Ensure effects logically follow from the narrative`
      };

      const userPrompt = {
        role: 'user',
        content: action.action
      };

      // Generate story response
      const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1', {
        messages: [prompt, userPrompt],
        max_tokens: 200,
        temperature: 0.8
      }) as AITextResponse;

      if (!response?.response) {
        throw new Error('Failed to generate story response');
      }

      // Clean the response
      const story = response.response
        .replace(/[\u0000-\u001F\u007F-\u009F]+/g, '') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Extract effects from the story
      const effects = await this.interpretEffects(action, story, env);

      return {
        story,
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
        content: `You are a game state manager. Parse the story output and extract all state changes.
Parse the [EFFECTS] section and return only concrete changes that should be applied to the game state.

Return a valid JSON array of effects in this format:
[
  {
    "type": "item",
    "action": "add|remove",
    "data": {
      "id": "simple_lowercase_id",
      "name": "Display Name",
      "type": "weapon|armor|consumable|quest|key",
      "rarity": "common|uncommon|rare|epic|legendary",
      "quantity": number,
      "value": number,
      "properties": {
        "damage": number,
        "defense": number,
        "healing": number,
        "durability": number,
        "uses": number,
        "effects": string[]
      }
    }
  },
  {
    "type": "quest",
    "action": "add|update|complete",
    "data": {
      "id": "simple_lowercase_id",
      "title": "Quest Title",
      "description": "Quest Description",
      "difficulty": "easy|medium|hard|epic",
      "objectives": [
        {
          "id": "objective_id",
          "description": "Objective Description",
          "type": "kill|collect|explore|interact|escort",
          "progress": number,
          "required": number,
          "status": "pending|in_progress|completed"
        }
      ],
      "rewards": [
        {
          "type": "experience|gold|item",
          "amount": number,
          "item": string
        }
      ]
    }
  },
  {
    "type": "location",
    "action": "update",
    "data": {
      "name": "Location Name",
      "description": "Location Description"
    }
  },
  {
    "type": "status",
    "action": "add|remove|update",
    "data": {
      "id": "simple_lowercase_id",
      "name": "Status Effect Name",
      "value": number,
      "duration": number
    }
  },
  {
    "type": "attribute",
    "action": "update",
    "data": {
      "name": "health|mana|strength|intelligence|dexterity|constitution",
      "value": number,
      "isTemporary": boolean
    }
  }
]

Rules:
1. Use only ASCII characters in all strings
2. Keep IDs simple and lowercase
3. Convert narrative descriptions into concrete game state changes
4. Ensure all numbers are valid integers
5. Return valid JSON array only
6. All effects must follow the exact structure for their type
7. Item effects must include valid type and rarity
8. Quest effects must include valid difficulty and objective types
9. Status effects must include duration in seconds
10. Attribute changes must be one of the defined stats`
      };

      const userPrompt = {
        role: 'user',
        content: `Action: ${action.action}\nStory Output: ${response}`
      };

      const effectsResponse = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1', {
        messages: [prompt, userPrompt],
        max_tokens: 200,
        temperature: 0.2
      }) as AITextResponse;

      if (!effectsResponse?.response) return [];

      try {
        // Clean and parse the response
        const cleanedResponse = effectsResponse.response
          .replace(/[\u0000-\u001F\u007F-\u009F]+/g, '') // Remove control characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\\/g, '\\\\') // Escape backslashes
          .replace(/(?<!\\)"/g, '\\"') // Escape unescaped quotes
          .replace(/\\{3,}/g, '\\\\') // Fix multiple backslashes
          .trim();

        // Try to extract JSON array from response
        const match = cleanedResponse.match(/\[[\s\S]*\]/);
        if (!match) {
          console.log('No JSON array found in response:', cleanedResponse);
          return [];
        }
        
        let jsonStr = match[0];
        
        // Additional JSON cleaning
        jsonStr = jsonStr
          .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1$2') // Remove invalid escapes
          .replace(/\\+"/g, '\\"') // Fix quote escaping
          .replace(/\t/g, ' '); // Replace tabs with spaces

        try {
          const parsedEffects = JSON.parse(jsonStr);
          return this.validateAndProcessEffects(parsedEffects);
        } catch (jsonError) {
          console.error('JSON parse error:', jsonError, '\nAttempted to parse:', jsonStr);
          return [];
        }
      } catch (parseError) {
        console.error('Failed to parse effects:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Failed to interpret effects:', error);
      return [];
    }
  }

  private validateAndProcessEffects(parsedEffects: any[]): GameEffect[] {
    if (!Array.isArray(parsedEffects)) return [];

    const validItemTypes = ['weapon', 'armor', 'consumable', 'quest', 'key'];
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const validQuestDifficulties = ['easy', 'medium', 'hard', 'epic'];
    const validObjectiveTypes = ['kill', 'collect', 'explore', 'interact', 'escort'];
    const validObjectiveStatuses = ['pending', 'in_progress', 'completed'];
    const validRewardTypes = ['experience', 'gold', 'item'];
    const validAttributes = ['health', 'mana', 'strength', 'intelligence', 'dexterity', 'constitution'];

    interface QuestObjective {
      id: string;
      description: string;
      type: string;
      progress: number;
      required: number;
      status: string;
    }

    interface QuestReward {
      type: string;
      amount: number;
      item?: string;
    }

    return parsedEffects.filter(effect => {
      if (!effect || typeof effect !== 'object') return false;
      if (!effect.type || !effect.action || !effect.data) return false;

      // Validate based on effect type
      switch (effect.type) {
        case 'item':
          if (!['add', 'remove'].includes(effect.action)) return false;
          if (!effect.data.id || !effect.data.name) return false;
          if (!validItemTypes.includes(effect.data.type)) return false;
          if (!validRarities.includes(effect.data.rarity)) return false;
          if (typeof effect.data.quantity !== 'number' || effect.data.quantity <= 0) return false;
          if (typeof effect.data.value !== 'number' || effect.data.value < 0) return false;
          
          // Ensure properties object exists with correct structure
          effect.data.properties = effect.data.properties || {};
          ['damage', 'defense', 'healing', 'durability', 'uses'].forEach(prop => {
            if (effect.data.properties[prop] !== undefined && typeof effect.data.properties[prop] !== 'number') {
              effect.data.properties[prop] = 0;
            }
          });
          if (!Array.isArray(effect.data.properties.effects)) {
            effect.data.properties.effects = [];
          }
          break;

        case 'quest':
          if (!['add', 'update', 'complete'].includes(effect.action)) return false;
          if (!effect.data.id || !effect.data.title || !effect.data.description) return false;
          if (!validQuestDifficulties.includes(effect.data.difficulty)) return false;
          
          // Validate objectives
          if (!Array.isArray(effect.data.objectives)) return false;
          effect.data.objectives = effect.data.objectives.filter((obj: QuestObjective) => 
            obj.id &&
            obj.description &&
            validObjectiveTypes.includes(obj.type) &&
            typeof obj.progress === 'number' &&
            typeof obj.required === 'number' &&
            validObjectiveStatuses.includes(obj.status)
          );
          if (effect.data.objectives.length === 0) return false;

          // Validate rewards
          if (!Array.isArray(effect.data.rewards)) return false;
          effect.data.rewards = effect.data.rewards.filter((reward: QuestReward) =>
            validRewardTypes.includes(reward.type) &&
            typeof reward.amount === 'number' &&
            reward.amount > 0 &&
            (reward.type !== 'item' || typeof reward.item === 'string')
          );
          if (effect.data.rewards.length === 0) return false;
          break;

        case 'location':
          if (effect.action !== 'update') return false;
          if (!effect.data.name || !effect.data.description) return false;
          break;

        case 'status':
          if (!['add', 'remove', 'update'].includes(effect.action)) return false;
          if (!effect.data.id || !effect.data.name) return false;
          if (typeof effect.data.value !== 'number') return false;
          if (typeof effect.data.duration !== 'number' || effect.data.duration <= 0) return false;
          break;

        case 'attribute':
          if (effect.action !== 'update') return false;
          if (!validAttributes.includes(effect.data.name)) return false;
          if (typeof effect.data.value !== 'number') return false;
          if (typeof effect.data.isTemporary !== 'boolean') {
            effect.data.isTemporary = false;
          }
          break;

        default:
          return false;
      }

      return true;
    }).map(effect => {
      // Ensure all IDs are lowercase and alphanumeric
      if (effect.data.id) {
        effect.data.id = effect.data.id.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      }
      
      // Clean up any string fields to ensure they're ASCII only
      Object.keys(effect.data).forEach(key => {
        if (typeof effect.data[key] === 'string') {
          effect.data[key] = effect.data[key]
            .replace(/[^\x20-\x7E]/g, '') // Keep only ASCII printable characters
            .trim();
        }
      });

      return effect;
    });
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