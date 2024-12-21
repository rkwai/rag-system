import { Env } from '../types/env';
import { Player, PlayerClass, PlayerStats, InventoryItem } from '../types/player';
import { nanoid } from 'nanoid';

interface CreatePlayerRequest {
  name: string;
  class: PlayerClass;
  location: string;
}

interface UpdateLocationRequest {
  location: string;
}

interface AddExperienceRequest {
  amount: number;
  source: string;
}

class PlayerWorker {
  private getInitialStats(playerClass: PlayerClass): PlayerStats {
    const baseStats = {
      health: 100,
      mana: 50,
      strength: 10,
      intelligence: 8,
      dexterity: 8,
      constitution: 10
    };

    switch (playerClass) {
      case 'Warrior':
        return {
          ...baseStats,
          strength: 12,
          constitution: 12,
          mana: 30
        };
      case 'Mage':
        return {
          ...baseStats,
          intelligence: 12,
          mana: 100,
          health: 80
        };
      case 'Rogue':
        return {
          ...baseStats,
          dexterity: 12,
          strength: 11,
          health: 90
        };
      case 'Cleric':
        return {
          ...baseStats,
          intelligence: 10,
          constitution: 11,
          mana: 80
        };
      case 'Ranger':
        return {
          ...baseStats,
          dexterity: 12,
          constitution: 9,
          strength: 11
        };
      default:
        return baseStats;
    }
  }

  private calculateLevel(experience: number): number {
    // Simple leveling formula: level = 1 + floor(sqrt(experience / 100))
    return 1 + Math.floor(Math.sqrt(experience / 100));
  }

  private getStatsForLevel(baseStats: PlayerStats, level: number): PlayerStats {
    const multiplier = 1 + (level - 1) * 0.1; // 10% increase per level
    return {
      health: Math.floor(baseStats.health * multiplier),
      mana: Math.floor(baseStats.mana * multiplier),
      strength: Math.floor(baseStats.strength * multiplier),
      intelligence: Math.floor(baseStats.intelligence * multiplier),
      dexterity: Math.floor(baseStats.dexterity * multiplier),
      constitution: Math.floor(baseStats.constitution * multiplier)
    };
  }

  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const playerId = path.split('/')[2];

      // Create new player
      if (request.method === 'POST' && path === '/players') {
        const body: CreatePlayerRequest = await request.json();

        if (!body.name || !body.class || !body.location) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields' 
          }), { 
            status: 400 
          });
        }

        // Validate player class
        if (!['Warrior', 'Mage', 'Rogue', 'Cleric', 'Ranger'].includes(body.class)) {
          return new Response(JSON.stringify({ 
            error: 'Invalid player class' 
          }), { 
            status: 400 
          });
        }

        const initialStats = this.getInitialStats(body.class);
        const player: Player = {
          id: nanoid(),
          name: body.name,
          class: body.class,
          level: 1,
          experience: 0,
          gold: 100, // Starting gold
          inventory: [],
          stats: initialStats,
          location: body.location
        };

        return new Response(JSON.stringify(player), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get player details
      if (request.method === 'GET' && playerId) {
        // Mock player retrieval
        const player: Player = {
          id: playerId,
          name: 'Retrieved Player',
          class: 'Warrior',
          level: 1,
          experience: 0,
          gold: 100,
          inventory: [],
          stats: this.getInitialStats('Warrior'),
          location: 'Starting Village'
        };

        return new Response(JSON.stringify(player), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update player location
      if (request.method === 'PUT' && path.endsWith('/location')) {
        const body: UpdateLocationRequest = await request.json();

        if (!body.location) {
          return new Response(JSON.stringify({ 
            error: 'Missing location' 
          }), { 
            status: 400 
          });
        }

        // Mock player update
        const player: Player = {
          id: playerId,
          name: 'Updated Player',
          class: 'Warrior',
          level: 1,
          experience: 0,
          gold: 100,
          inventory: [],
          stats: this.getInitialStats('Warrior'),
          location: body.location
        };

        return new Response(JSON.stringify(player), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add item to inventory
      if (request.method === 'POST' && path.endsWith('/inventory')) {
        const body: InventoryItem = await request.json();

        if (!body.name || !body.type || !body.quantity) {
          return new Response(JSON.stringify({ 
            error: 'Missing required item fields' 
          }), { 
            status: 400 
          });
        }

        // Mock inventory update
        const player: Player = {
          id: playerId,
          name: 'Player with Item',
          class: 'Warrior',
          level: 1,
          experience: 0,
          gold: 100,
          inventory: [{
            ...body,
            id: nanoid()
          }],
          stats: this.getInitialStats('Warrior'),
          location: 'Starting Village'
        };

        return new Response(JSON.stringify(player), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add experience
      if (request.method === 'POST' && path.endsWith('/experience')) {
        const body: AddExperienceRequest = await request.json();

        if (typeof body.amount !== 'number' || !body.source) {
          return new Response(JSON.stringify({ 
            error: 'Invalid experience data' 
          }), { 
            status: 400 
          });
        }

        // Mock experience gain and leveling
        const baseStats = this.getInitialStats('Warrior');
        const newLevel = this.calculateLevel(body.amount);
        const updatedStats = this.getStatsForLevel(baseStats, newLevel);

        const player: Player = {
          id: playerId,
          name: 'Leveled Player',
          class: 'Warrior',
          level: newLevel,
          experience: body.amount,
          gold: 100,
          inventory: [],
          stats: updatedStats,
          location: 'Starting Village'
        };

        return new Response(JSON.stringify(player), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Player worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error' 
      }), { 
        status: 500 
      });
    }
  }
}

export default new PlayerWorker(); 