import { Env } from '../types/env';
import { Item, ItemType, ItemRarity, Inventory } from '../types/items';
import { v4 as uuidv4 } from 'uuid';

class ItemWorker {
  private validateItem(item: Partial<Item>): { isValid: boolean; error?: string } {
    const validTypes: ItemType[] = ['weapon', 'armor', 'consumable', 'quest', 'key'];
    const validRarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    if (!item.name) {
      return { isValid: false, error: 'Item name is required' };
    }
    if (!item.type || !validTypes.includes(item.type as ItemType)) {
      return { isValid: false, error: 'Invalid item type' };
    }
    if (!item.rarity || !validRarities.includes(item.rarity as ItemRarity)) {
      return { isValid: false, error: 'Invalid item rarity' };
    }
    if (typeof item.value !== 'number' || item.value < 0) {
      return { isValid: false, error: 'Invalid item value' };
    }

    return { isValid: true };
  }

  private async createItem(request: Request, env: Env): Promise<Response> {
    try {
      const itemData = await request.json();
      const validation = this.validateItem(itemData);

      if (!validation.isValid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const item: Item = {
        id: uuidv4(),
        name: itemData.name,
        description: itemData.description || '',
        type: itemData.type,
        rarity: itemData.rarity,
        properties: itemData.properties || {},
        value: itemData.value,
        questRelated: itemData.questRelated || false
      };

      await env.DB.prepare(
        `INSERT INTO items (id, name, description, type, rarity, properties, value, quest_related)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        item.id,
        item.name,
        item.description,
        item.type,
        item.rarity,
        JSON.stringify(item.properties),
        item.value,
        item.questRelated ? 1 : 0
      ).run();

      return new Response(JSON.stringify(item), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Failed to create item:', error);
      return new Response(JSON.stringify({ error: 'Failed to create item' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async addItemToInventory(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const playerId = url.pathname.split('/')[2];
      const { itemId, quantity } = await request.json();

      if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid item ID or quantity' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const playerInventory = await env.DB.prepare(
        `SELECT inventory FROM players WHERE id = ?`
      ).bind(playerId).first<{ inventory: string }>();

      if (!playerInventory) {
        return new Response(JSON.stringify({ error: 'Player not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const inventory: Inventory = JSON.parse(playerInventory.inventory);

      if (Object.keys(inventory.items).length >= inventory.capacity && !inventory.items[itemId]) {
        return new Response(JSON.stringify({ error: 'Inventory is full' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const item = await env.DB.prepare(
        `SELECT * FROM items WHERE id = ?`
      ).bind(itemId).first<Item>();

      if (!item) {
        return new Response(JSON.stringify({ error: 'Item not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (inventory.items[itemId]) {
        inventory.items[itemId].quantity += quantity;
      } else {
        inventory.items[itemId] = { item, quantity };
      }

      await env.DB.prepare(
        `UPDATE players SET inventory = ? WHERE id = ?`
      ).bind(JSON.stringify(inventory), playerId).run();

      return new Response(JSON.stringify({ id: playerId, inventory }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Failed to add item to inventory:', error);
      return new Response(JSON.stringify({ error: 'Failed to add item to inventory' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async removeItemFromInventory(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const playerId = url.pathname.split('/')[2];
      const { itemId, quantity } = await request.json();

      if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid item ID or quantity' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const playerInventory = await env.DB.prepare(
        `SELECT inventory FROM players WHERE id = ?`
      ).bind(playerId).first<{ inventory: string }>();

      if (!playerInventory) {
        return new Response(JSON.stringify({ error: 'Player not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const inventory: Inventory = JSON.parse(playerInventory.inventory);

      if (!inventory.items[itemId] || inventory.items[itemId].quantity < quantity) {
        return new Response(JSON.stringify({ error: 'Not enough items to remove' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      inventory.items[itemId].quantity -= quantity;
      if (inventory.items[itemId].quantity <= 0) {
        delete inventory.items[itemId];
      }

      await env.DB.prepare(
        `UPDATE players SET inventory = ? WHERE id = ?`
      ).bind(JSON.stringify(inventory), playerId).run();

      return new Response(JSON.stringify({ id: playerId, inventory }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Failed to remove item from inventory:', error);
      return new Response(JSON.stringify({ error: 'Failed to remove item from inventory' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async getItemsByType(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const playerId = pathParts[2];
      const type = pathParts[5];

      const validTypes: ItemType[] = ['weapon', 'armor', 'consumable', 'quest', 'key'];
      if (!validTypes.includes(type as ItemType)) {
        return new Response(JSON.stringify({ error: 'Invalid item type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const playerInventory = await env.DB.prepare(
        `SELECT inventory FROM players WHERE id = ?`
      ).bind(playerId).first<{ inventory: string }>();

      if (!playerInventory) {
        return new Response(JSON.stringify({ error: 'Player not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const inventory: Inventory = JSON.parse(playerInventory.inventory);
      const itemsByType = Object.values(inventory.items)
        .filter(({ item }) => item.type === type);

      return new Response(JSON.stringify(itemsByType), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Failed to get items by type:', error);
      return new Response(JSON.stringify({ error: 'Failed to get items by type' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/items' && request.method === 'POST') {
        return this.createItem(request, env);
      }

      if (path.match(/^\/players\/[^\/]+\/inventory\/add$/) && request.method === 'POST') {
        return this.addItemToInventory(request, env);
      }

      if (path.match(/^\/players\/[^\/]+\/inventory\/remove$/) && request.method === 'POST') {
        return this.removeItemFromInventory(request, env);
      }

      if (path.match(/^\/players\/[^\/]+\/inventory\/type\/[^\/]+$/) && request.method === 'GET') {
        return this.getItemsByType(request, env);
      }

      return new Response('Not Found', { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Item worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

export default new ItemWorker(); 