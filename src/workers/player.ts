import { Env } from '../types/env';
import { Player, PlayerClass, PlayerStats } from '../types/player';
import { Inventory, ItemType, ItemRarity } from '../types/items';
import { nanoid } from 'nanoid';

interface CreatePlayerRequest {
  name: string;
  class: PlayerClass;
  location: string;
  inventoryCapacity?: number;
}

interface UpdateLocationRequest {
  location: string;
}

interface AddExperienceRequest {
  amount: number;
  source: string;
}

interface PlayerRow {
  id: string;
  name: string;
  class: PlayerClass;
  level: number;
  experience: number;
  gold: number;
  inventory: string;
  stats: string;
  location: string;
}

interface ItemRow {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity: string;
  properties: string;
  value: number;
  quest_related: number;
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
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Validate player class
        if (!['Warrior', 'Mage', 'Rogue', 'Cleric', 'Ranger'].includes(body.class)) {
          return new Response(JSON.stringify({ 
            error: 'Invalid player class' 
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const initialStats = this.getInitialStats(body.class);
        const initialInventory: Inventory = {
          items: {},
          capacity: body.inventoryCapacity || 20
        };

        const player = {
          id: nanoid(),
          name: body.name,
          class: body.class,
          level: 1,
          experience: 0,
          gold: 100, // Starting gold
          inventory: initialInventory,
          stats: initialStats,
          location: body.location
        };

        await env.DB.prepare(
          `INSERT INTO players (id, name, class, level, experience, gold, inventory, stats, location)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          player.id,
          player.name,
          player.class,
          player.level,
          player.experience,
          player.gold,
          JSON.stringify(player.inventory),
          JSON.stringify(player.stats),
          player.location
        ).run();

        return new Response(JSON.stringify(player), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get player details
      if (request.method === 'GET' && playerId) {
        const player = await env.DB.prepare(
          `SELECT * FROM players WHERE id = ?`
        ).bind(playerId).first<PlayerRow>();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ...player,
          inventory: JSON.parse(player.inventory),
          stats: JSON.parse(player.stats)
        }), {
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
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const player = await env.DB.prepare(
          `SELECT * FROM players WHERE id = ?`
        ).bind(playerId).first<PlayerRow>();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare(
          `UPDATE players SET location = ? WHERE id = ?`
        ).bind(body.location, playerId).run();

        return new Response(JSON.stringify({
          ...player,
          location: body.location,
          inventory: JSON.parse(player.inventory),
          stats: JSON.parse(player.stats)
        }), {
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
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const player = await env.DB.prepare(
          `SELECT * FROM players WHERE id = ?`
        ).bind(playerId).first<PlayerRow>();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const newExperience = player.experience + body.amount;
        const newLevel = this.calculateLevel(newExperience);
        const baseStats = this.getInitialStats(player.class);
        const updatedStats = this.getStatsForLevel(baseStats, newLevel);

        await env.DB.prepare(
          `UPDATE players SET experience = ?, level = ?, stats = ? WHERE id = ?`
        ).bind(
          newExperience,
          newLevel,
          JSON.stringify(updatedStats),
          playerId
        ).run();

        return new Response(JSON.stringify({
          ...player,
          experience: newExperience,
          level: newLevel,
          stats: updatedStats,
          inventory: JSON.parse(player.inventory)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add item to inventory
      if (request.method === 'POST' && path.endsWith('/inventory')) {
        const body = await request.json();

        if (!body.itemId || !body.quantity) {
          return new Response(JSON.stringify({ 
            error: 'Missing required item fields' 
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const player = await env.DB.prepare(
          `SELECT * FROM players WHERE id = ?`
        ).bind(playerId).first<PlayerRow>();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const item = await env.DB.prepare(
          `SELECT * FROM items WHERE id = ?`
        ).bind(body.itemId).first<ItemRow>();

        if (!item) {
          return new Response(JSON.stringify({ error: 'Item not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const parsedItem = {
          id: item.id,
          name: item.name,
          description: item.description,
          type: item.type as ItemType,
          rarity: item.rarity as ItemRarity,
          properties: JSON.parse(item.properties),
          value: item.value,
          questRelated: item.quest_related === 1
        };

        const inventory: Inventory = JSON.parse(player.inventory);

        if (Object.keys(inventory.items).length >= inventory.capacity && !inventory.items[body.itemId]) {
          return new Response(JSON.stringify({ error: 'Inventory is full' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (inventory.items[body.itemId]) {
          inventory.items[body.itemId].quantity += body.quantity;
        } else {
          inventory.items[body.itemId] = {
            item: parsedItem,
            quantity: body.quantity
          };
        }

        await env.DB.prepare(
          `UPDATE players SET inventory = ? WHERE id = ?`
        ).bind(JSON.stringify(inventory), playerId).run();

        return new Response(JSON.stringify({
          ...player,
          inventory,
          stats: JSON.parse(player.stats)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Player worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

export default new PlayerWorker(); 