/**
 * Integration tests for the RAG System API endpoints
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const API_URL = 'http://localhost:8787';

describe('API Endpoints', () => {
  /**
   * Health check endpoint tests
   */
  describe('GET /', () => {
    it('should return health check message', async () => {
      const res = await fetch(`${API_URL}/`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('RAG System Healthy');
    });
  });

  /**
   * Query endpoint tests
   */
  describe('POST /query', () => {
    it('should process a query request', async () => {
      // First ingest a test document
      await fetch(`${API_URL}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-doc-1',
          content: 'This is a test document for querying.',
          metadata: { title: 'Test Document' }
        }),
      });

      // Then test the query
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is in the test document?',
        }),
      });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('response');
    }, 30000); // 30 second timeout

    it('should handle invalid query request', async () => {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  /**
   * Document ingestion endpoint tests
   */
  describe('POST /document', () => {
    it('should process a document ingestion request', async () => {
      const res = await fetch(`${API_URL}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-doc-1',
          content: 'This is a test document. It has multiple sentences. This should create chunks.',
          metadata: { title: 'Test Document' },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success');
    });

    it('should handle invalid document request', async () => {
      const res = await fetch(`${API_URL}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Missing required fields
      });
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  /**
   * Error handling tests
   */
  describe('Error Handling', () => {
    it('should handle invalid JSON with 400', async () => {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        body: 'invalid json',
      });
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });

    it('should handle internal server errors with 500', async () => {
      // Temporarily suppress console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: 'test',
          options: { maxResults: -1 }
        }),
      });
      
      expect(res.status).toBe(500);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  /**
   * Quest Generation endpoint tests
   */
  describe('POST /quests', () => {
    const testPlayer = {
      id: 'player-1',
      level: 5,
      class: 'Warrior',
      location: 'Dark Forest'
    };

    it('should generate a new quest', async () => {
      const res = await fetch(`${API_URL}/quests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: testPlayer,
          difficulty: 'medium'
        }),
      });
      
      expect(res.status).toBe(200);
      const quest = await res.json();
      
      // Verify quest structure
      expect(quest).toHaveProperty('id');
      expect(quest).toHaveProperty('title');
      expect(quest).toHaveProperty('description');
      expect(quest).toHaveProperty('objectives');
      expect(quest).toHaveProperty('rewards');
      expect(quest.objectives).toBeInstanceOf(Array);
      expect(quest.rewards).toBeInstanceOf(Array);
      expect(quest.assignedPlayer).toBe(testPlayer.id);
    });

    it('should generate quest with context from previous quests', async () => {
      // First create a completed quest for context
      await fetch(`${API_URL}/quests/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questId: 'previous-quest-1',
          playerId: testPlayer.id,
          status: 'completed',
          outcome: 'Player saved the village elder'
        }),
      });

      // Generate new quest that should reference previous quest
      const res = await fetch(`${API_URL}/quests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: {
            ...testPlayer,
            level: 6,
            location: 'Village'
          },
          useHistory: true
        }),
      });

      expect(res.status).toBe(200);
      const quest = await res.json();
      expect(quest).toHaveProperty('previousQuestReference');
    });

    it('should handle invalid quest generation request', async () => {
      const res = await fetch(`${API_URL}/quests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required player fields
          difficulty: 'impossible' // Invalid difficulty
        }),
      });
      
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });

    it('should update quest progress', async () => {
      // First create a quest
      const createRes = await fetch(`${API_URL}/quests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: testPlayer
        }),
      });
      
      const quest = await createRes.json();
      
      // Update quest progress
      const updateRes = await fetch(`${API_URL}/quests/${quest.id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: testPlayer.id,
          objectiveId: quest.objectives[0].id,
          progress: 50,
          details: 'Halfway through the objective'
        }),
      });

      expect(updateRes.status).toBe(200);
      const updatedQuest = await updateRes.json();
      expect(updatedQuest.objectives[0].progress).toBe(50);
      expect(updatedQuest.assignedPlayer).toBe(testPlayer.id);
    });
  });

  /**
   * Player Management endpoint tests
   */
  describe('Player Management', () => {
    const newPlayer = {
      name: 'TestHero',
      class: 'Warrior' as const,
      location: 'Starting Village'
    };

    it('should create a new player', async () => {
      const res = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlayer),
      });

      expect(res.status).toBe(200);
      const player = await res.json();

      // Verify player structure
      expect(player).toHaveProperty('id');
      expect(player.name).toBe(newPlayer.name);
      expect(player.class).toBe(newPlayer.class);
      expect(player.level).toBe(1);
      expect(player.experience).toBe(0);
      expect(player.gold).toBe(100); // Starting gold
      expect(player.location).toBe(newPlayer.location);
      expect(player.inventory).toHaveProperty('items');
      expect(player.inventory).toHaveProperty('capacity');
      expect(player.stats).toMatchObject({
        health: 100,
        mana: 30,
        strength: 12,
        intelligence: 8,
        dexterity: 8,
        constitution: 12
      });
    });

    it('should get player details', async () => {
      // First create a player
      const createRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlayer),
      });
      const createdPlayer = await createRes.json();

      // Then get player details
      const res = await fetch(`${API_URL}/players/${createdPlayer.id}`);
      expect(res.status).toBe(200);
      const player = await res.json();
      expect(player.id).toBe(createdPlayer.id);
    });

    it('should update player location', async () => {
      // First create a player
      const createRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlayer),
      });
      const createdPlayer = await createRes.json();

      // Update location
      const newLocation = 'Dark Forest';
      const res = await fetch(`${API_URL}/players/${createdPlayer.id}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: newLocation }),
      });

      expect(res.status).toBe(200);
      const updatedPlayer = await res.json();
      expect(updatedPlayer.location).toBe(newLocation);
    });

    it('should manage player inventory', async () => {
      // First create a player
      const createRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlayer),
      });
      const createdPlayer = await createRes.json();

      // Add item to inventory
      const createItemRes = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Iron Sword',
          description: 'A sturdy iron sword',
          type: 'weapon',
          rarity: 'common',
          properties: {
            damage: 10
          },
          value: 100
        }),
      });
      const item = await createItemRes.json();

      const addItemRes = await fetch(`${API_URL}/players/${createdPlayer.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 1
        }),
      });

      expect(addItemRes.status).toBe(200);
      const playerWithItem = await addItemRes.json();
      expect(Object.keys(playerWithItem.inventory.items)).toHaveLength(1);
      expect(playerWithItem.inventory.items[item.id]).toBeDefined();
      expect(playerWithItem.inventory.items[item.id].quantity).toBe(1);
    });

    it('should handle player experience and leveling', async () => {
      // First create a player
      const createRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlayer),
      });
      const createdPlayer = await createRes.json();

      // Add experience
      const expGain = {
        amount: 1000,
        source: 'quest_completion'
      };

      const addExpRes = await fetch(`${API_URL}/players/${createdPlayer.id}/experience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expGain),
      });

      expect(addExpRes.status).toBe(200);
      const leveledPlayer = await addExpRes.json();
      expect(leveledPlayer.level).toBeGreaterThan(1);
      expect(leveledPlayer.experience).toBe(expGain.amount);
      expect(leveledPlayer.stats).toMatchObject({
        health: expect.any(Number),
        mana: expect.any(Number),
        strength: expect.any(Number),
        intelligence: expect.any(Number),
        dexterity: expect.any(Number),
        constitution: expect.any(Number)
      });
    });

    it('should handle invalid player creation request', async () => {
      const res = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid',
          class: 'InvalidClass', // Invalid class
          location: 'Test'
        }),
      });

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  /**
   * Item Management endpoint tests
   */
  describe('Item Management', () => {
    const testItem = {
      name: 'Test Sword',
      description: 'A mighty test sword',
      type: 'weapon' as const,
      rarity: 'common' as const,
      properties: {
        damage: 10,
        durability: 100
      },
      value: 100
    };

    it('should create a new item', async () => {
      const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testItem),
      });

      expect(res.status).toBe(200);
      const item = await res.json();

      // Verify item structure
      expect(item).toHaveProperty('id');
      expect(item.name).toBe(testItem.name);
      expect(item.description).toBe(testItem.description);
      expect(item.type).toBe(testItem.type);
      expect(item.rarity).toBe(testItem.rarity);
      expect(item.properties).toMatchObject(testItem.properties);
      expect(item.value).toBe(testItem.value);
      expect(item.questRelated).toBe(false);
    });

    it('should add item to player inventory', async () => {
      // First create a player
      const createPlayerRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TestHero',
          class: 'Warrior',
          location: 'Starting Village'
        }),
      });
      const player = await createPlayerRes.json();

      // Create an item
      const createItemRes = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testItem),
      });
      const item = await createItemRes.json();

      // Add item to inventory
      const res = await fetch(`${API_URL}/players/${player.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 1
        }),
      });

      expect(res.status).toBe(200);
      const updatedPlayer = await res.json();
      const inventoryItem = updatedPlayer.inventory.items[item.id];
      expect(inventoryItem).toBeDefined();
      expect(inventoryItem.quantity).toBe(1);
      expect(inventoryItem.item.id).toBe(item.id);
    });

    it('should remove item from player inventory', async () => {
      // First create a player with an item
      const createPlayerRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TestHero',
          class: 'Warrior',
          location: 'Starting Village'
        }),
      });
      const player = await createPlayerRes.json();

      // Create and add an item
      const createItemRes = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testItem),
      });
      const item = await createItemRes.json();

      await fetch(`${API_URL}/players/${player.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 3
        }),
      });

      // Remove some items
      const res = await fetch(`${API_URL}/players/${player.id}/inventory/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 2
        }),
      });

      expect(res.status).toBe(200);
      const updatedPlayer = await res.json();
      const inventoryItem = updatedPlayer.inventory.items[item.id];
      expect(inventoryItem).toBeDefined();
      expect(inventoryItem.quantity).toBe(1);
    });

    it('should get items by type', async () => {
      // Create a player
      const createPlayerRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TestHero',
          class: 'Warrior',
          location: 'Starting Village'
        }),
      });
      const player = await createPlayerRes.json();

      // Add weapon and armor
      const weapon = await (await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testItem),
      })).json();

      const armor = await (await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Armor',
          description: 'A sturdy armor',
          type: 'armor',
          rarity: 'common',
          properties: { defense: 5 },
          value: 150
        }),
      })).json();

      // Add both to inventory
      await fetch(`${API_URL}/players/${player.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: weapon.id, quantity: 1 }),
      });

      await fetch(`${API_URL}/players/${player.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: armor.id, quantity: 1 }),
      });

      // Get weapons
      const res = await fetch(`${API_URL}/players/${player.id}/inventory/type/weapon`);
      expect(res.status).toBe(200);
      const weapons = await res.json();
      expect(weapons).toHaveLength(1);
      expect(weapons[0].item.type).toBe('weapon');
    });

    it('should handle inventory capacity', async () => {
      // Create a player with small inventory
      const createPlayerRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TestHero',
          class: 'Warrior',
          location: 'Starting Village',
          inventoryCapacity: 1
        }),
      });
      const player = await createPlayerRes.json();

      // Create two items
      const item1 = await (await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testItem,
          name: 'Item1'
        }),
      })).json();

      const item2 = await (await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testItem,
          name: 'Item2'
        }),
      })).json();

      // Add first item (should succeed)
      const res1 = await fetch(`${API_URL}/players/${player.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item1.id, quantity: 1 }),
      });
      expect(res1.status).toBe(200);

      // Try to add second item (should fail)
      const res2 = await fetch(`${API_URL}/players/${player.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item2.id, quantity: 1 }),
      });
      expect(res2.status).toBe(400);
      const error = await res2.json();
      expect(error).toHaveProperty('error');
    });

    it('should handle invalid item creation', async () => {
      const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Item',
          type: 'invalid_type', // Invalid type
          rarity: 'super_rare', // Invalid rarity
        }),
      });

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  /**
   * Game Action Processing endpoint tests
   */
  describe('Game Action Processing', () => {
    const testPlayer = {
      id: 'player-1',
      name: 'TestHero',
      class: 'Warrior',
      level: 5,
      location: 'Dark Forest'
    };

    // Add longer delay between tests to avoid rate limiting
    afterEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('should generate story response', async () => {
      const res = await fetch(`${API_URL}/game/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: testPlayer.id,
          action: 'I look around',  // Simple observation action
          context: {
            currentLocation: testPlayer.location,
            inventory: [],
            questStates: [],
            gameHistory: []
          }
        }),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      
      // Print response for debugging
      if (!response.story) {
        console.log('Unexpected response:', response);
      }

      expect(response).toHaveProperty('story');
      expect(typeof response.story).toBe('string');
      expect(response.story.length).toBeGreaterThan(0);
    }, 60000);  // 60 second timeout

    it('should handle inventory actions', async () => {
      const res = await fetch(`${API_URL}/game/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: testPlayer.id,
          action: 'I check my bag',  // Simple inventory action
          context: {
            currentLocation: testPlayer.location,
            inventory: ['torch', 'map'],
            questStates: [],
            gameHistory: []
          }
        }),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response).toHaveProperty('story');
      expect(typeof response.story).toBe('string');
      expect(response.story.length).toBeGreaterThan(0);
    }, 60000);

    it('should handle quest context', async () => {
      const res = await fetch(`${API_URL}/game/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: testPlayer.id,
          action: 'I check my quest log',  // Simple quest check
          context: {
            currentLocation: testPlayer.location,
            inventory: [],
            questStates: [{
              id: 'find_amulet',
              progress: 0,
              description: 'Find the missing amulet'
            }],
            gameHistory: []
          }
        }),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response).toHaveProperty('story');
      expect(typeof response.story).toBe('string');
      expect(response.story.length).toBeGreaterThan(0);
    }, 60000);
  });

  /**
   * Game State Management endpoint tests
   */
  describe('Game State Management', () => {
    const testPlayer = {
      id: 'player-1',
      name: 'TestHero',
      class: 'Warrior',
      level: 5
    };

    it('should save game state', async () => {
      const res = await fetch(`${API_URL}/game/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: testPlayer.id,
          state: {
            currentScene: 'Dark Forest Entrance',
            activeEffects: [{ type: 'buff', name: 'courage', duration: 3 }],
            temporaryFlags: { discoveredCave: true },
            lastAction: 'Explored the forest path',
            lastResponse: 'You find a hidden cave entrance'
          }
        }),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response).toHaveProperty('success', true);
    });

    it('should retrieve game state', async () => {
      const res = await fetch(`${API_URL}/game/state/${testPlayer.id}`);
      expect(res.status).toBe(200);
      const state = await res.json();
      expect(state).toHaveProperty('currentScene');
      expect(state).toHaveProperty('activeEffects');
      expect(state).toHaveProperty('temporaryFlags');
      expect(state).toHaveProperty('lastAction');
      expect(state).toHaveProperty('lastResponse');
    });
  });

  /**
   * Memory/History Management endpoint tests
   */
  describe('Memory Management', () => {
    const testPlayer = {
      name: 'TestHero',
      class: 'Warrior' as const,
      location: 'Dark Forest'
    };

    let playerId: string;

    // Create player before running memory tests
    beforeEach(async () => {
      // Create the player first
      const createPlayerRes = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPlayer),
      });
      
      const player = await createPlayerRes.json();
      playerId = player.id;

      // Then store test memories
      const memories = [
        {
          type: 'event',
          content: 'Found a mysterious glowing crystal in the Dark Forest',
          location: 'Dark Forest',
          timestamp: new Date().toISOString(),
          importance: 0.8,
          metadata: {
            tags: ['item', 'discovery']
          }
        },
        {
          type: 'event',
          content: 'Encountered a friendly merchant on the road',
          location: 'Forest Road',
          timestamp: new Date().toISOString(),
          importance: 0.5,
          metadata: {
            tags: ['npc', 'merchant']
          }
        },
        {
          type: 'event',
          content: 'Defeated a pack of wolves near the cave',
          location: 'Cave Entrance',
          timestamp: new Date().toISOString(),
          importance: 0.7,
          metadata: {
            tags: ['combat', 'victory']
          }
        }
      ];

      for (const memory of memories) {
        await fetch(`${API_URL}/game/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            entry: memory
          })
        });
      }
    });

    it('should store memory entry', async () => {
      const memory = {
        type: 'event',
        content: 'Found a mysterious glowing crystal in the Dark Forest',
        location: 'Dark Forest',
        timestamp: new Date().toISOString(),
        importance: 0.8,
        metadata: {
          tags: ['item', 'discovery']
        }
      };

      const res = await fetch(`${API_URL}/game/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          entry: memory
        })
      });

      // Print out error response for debugging
      if (res.status !== 200) {
        const errorBody = await res.json();
        console.error('Memory storage failed:', {
          status: res.status,
          error: errorBody
        });
      }

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('memoryId');
    });

    it('should retrieve relevant memories for context', async () => {
      const res = await fetch(`${API_URL}/game/memory/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          location: 'Dark Forest',
          action: 'I look around for more crystals',
          limit: 2
        })
      });

      // Print out error response for debugging
      if (res.status !== 200) {
        const errorBody = await res.json();
        console.error('Memory retrieval failed:', {
          status: res.status,
          error: errorBody
        });
      }

      expect(res.status).toBe(200);
      const memories = await res.json();
      expect(memories).toBeInstanceOf(Array);
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0]).toHaveProperty('content');
      expect(memories[0]).toHaveProperty('importance');
      expect(memories[0].content).toMatch(/crystal/i);
    });

    it('should handle memory importance scoring', async () => {
      const res = await fetch(`${API_URL}/game/memory/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          location: 'Dark Forest',
          action: 'I search the area',
          limit: 2
        })
      });

      // Print out error response for debugging
      if (res.status !== 200) {
        const errorBody = await res.json();
        console.error('Memory importance scoring failed:', {
          status: res.status,
          error: errorBody
        });
      }

      expect(res.status).toBe(200);
      const topMemories = await res.json();
      expect(topMemories).toHaveLength(2);
      // Should return the two most important memories
      expect(topMemories[0].importance).toBeGreaterThanOrEqual(topMemories[1].importance);
    });
  });
}); 