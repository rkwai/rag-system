/**
 * Integration tests for the RAG System API endpoints
 */
import { describe, it, expect, vi } from 'vitest';

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
      expect(player.inventory).toBeInstanceOf(Array);
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
      const newItem = {
        name: 'Iron Sword',
        type: 'weapon',
        quantity: 1,
        stats: {
          damage: 10
        }
      };

      const addItemRes = await fetch(`${API_URL}/players/${createdPlayer.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      expect(addItemRes.status).toBe(200);
      const playerWithItem = await addItemRes.json();
      expect(playerWithItem.inventory).toHaveLength(1);
      expect(playerWithItem.inventory[0].name).toBe(newItem.name);
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
}); 