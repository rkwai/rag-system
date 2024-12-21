import { Player, PlayerClass } from './player';

export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  previousQuestReference?: string;
  requiredLevel: number;
  requiredClass?: PlayerClass;
  location: string;
  difficulty: QuestDifficulty;
  status: QuestStatus;
  createdAt: Date;
  updatedAt: Date;
  assignedPlayer?: string; // Player ID
}

export interface QuestObjective {
  id: string;
  description: string;
  progress: number;
  required: number;
  type: ObjectiveType;
  status: ObjectiveStatus;
}

export interface QuestReward {
  type: RewardType;
  amount: number;
  item?: string;
}

export type QuestDifficulty = 'easy' | 'medium' | 'hard' | 'epic';
export type QuestStatus = 'active' | 'completed' | 'failed';
export type ObjectiveType = 'kill' | 'collect' | 'explore' | 'interact' | 'escort';
export type ObjectiveStatus = 'pending' | 'in_progress' | 'completed';
export type RewardType = 'experience' | 'gold' | 'item';

export interface QuestGenerationRequest {
  player: {
    id: string;
    level: number;
    class: PlayerClass;
    location: string;
  };
  difficulty?: QuestDifficulty;
  useHistory?: boolean;
}

export interface QuestProgressUpdate {
  playerId: string;
  objectiveId: string;
  progress: number;
  details?: string;
}

export interface QuestHistoryEntry {
  questId: string;
  playerId: string;
  status: QuestStatus;
  outcome: string;
  completedAt?: Date;
} 