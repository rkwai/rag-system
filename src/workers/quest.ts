import { Env } from '../types/env';
import { 
  Quest, 
  QuestGenerationRequest, 
  QuestProgressUpdate, 
  QuestHistoryEntry,
  QuestObjective,
  QuestReward,
  ObjectiveType,
  RewardType
} from '../types/quest';
import { PlayerClass } from '../types/player';
import { nanoid } from 'nanoid';

class QuestWorker {
  private generateObjectives(location: string, difficulty: string): QuestObjective[] {
    const objectiveTypes: ObjectiveType[] = ['kill', 'collect', 'explore', 'interact', 'escort'];
    const numObjectives = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    
    return Array(numObjectives).fill(null).map(() => ({
      id: nanoid(),
      description: `Generated objective for ${location}`,
      progress: 0,
      required: Math.floor(Math.random() * 5) + 1,
      type: objectiveTypes[Math.floor(Math.random() * objectiveTypes.length)],
      status: 'pending'
    }));
  }

  private generateRewards(playerLevel: number, difficulty: string): QuestReward[] {
    const baseReward = playerLevel * 100;
    const multiplier = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    
    return [
      {
        type: 'experience',
        amount: baseReward * multiplier
      },
      {
        type: 'gold',
        amount: Math.floor(baseReward * multiplier * 0.5)
      }
    ];
  }

  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Handle quest generation
      if (request.method === 'POST' && path === '/quests') {
        const body: QuestGenerationRequest = await request.json();
        
        if (!body.player || !body.player.level || !body.player.class || !body.player.location) {
          return new Response(JSON.stringify({ 
            error: 'Missing required player fields' 
          }), { 
            status: 400 
          });
        }

        const difficulty = body.difficulty || 'medium';
        if (!['easy', 'medium', 'hard', 'epic'].includes(difficulty)) {
          return new Response(JSON.stringify({ 
            error: 'Invalid difficulty level' 
          }), { 
            status: 400 
          });
        }

        const quest: Quest = {
          id: nanoid(),
          title: `Quest in ${body.player.location}`,
          description: `A generated quest for a level ${body.player.level} ${body.player.class}`,
          objectives: this.generateObjectives(body.player.location, difficulty),
          rewards: this.generateRewards(body.player.level, difficulty),
          requiredLevel: body.player.level,
          requiredClass: body.player.class,
          location: body.player.location,
          difficulty: difficulty,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignedPlayer: body.player.id
        };

        if (body.useHistory) {
          quest.previousQuestReference = 'previous-quest-reference';
        }

        return new Response(JSON.stringify(quest), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Handle quest history
      if (request.method === 'POST' && path === '/quests/history') {
        const body: QuestHistoryEntry = await request.json();
        
        if (!body.questId || !body.playerId || !body.status || !body.outcome) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields' 
          }), { 
            status: 400 
          });
        }

        // Store quest history (mock implementation)
        return new Response(JSON.stringify({ 
          success: true 
        }), { 
          status: 200 
        });
      }

      // Handle quest progress updates
      if (request.method === 'PUT' && path.match(/^\/quests\/[\w-]+\/progress$/)) {
        const body: QuestProgressUpdate = await request.json();
        
        if (!body.playerId || !body.objectiveId || typeof body.progress !== 'number') {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields' 
          }), { 
            status: 400 
          });
        }

        // Mock quest update
        const updatedQuest: Quest = {
          id: path.split('/')[2],
          title: 'Updated Quest',
          description: 'Quest description',
          objectives: [{
            id: body.objectiveId,
            description: 'Test objective',
            progress: body.progress,
            required: 100,
            type: 'kill',
            status: 'in_progress'
          }],
          rewards: [],
          requiredLevel: 1,
          requiredClass: 'Warrior',
          location: 'Test Location',
          difficulty: 'medium',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignedPlayer: body.playerId
        };

        return new Response(JSON.stringify(updatedQuest), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Quest worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error' 
      }), { 
        status: 500 
      });
    }
  }
}

export default new QuestWorker(); 