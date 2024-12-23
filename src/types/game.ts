import { Player } from './player';
import { Quest } from './quest';
import { InventoryItem } from './player';

export interface GameHistoryEntry {
  timestamp: Date;
  action: string;
  response: string;
  effects: GameEffect[];
  location: string;
}

export interface GameAction {
  playerId: string;
  action: string;
  timestamp?: string;
}

export interface GameContext {
  currentLocation: string;
  inventory: string[];
  questStates: Array<{
    id: string;
    status: string;
    progress: number;
  }>;
  gameHistory: Array<{
    action: string;
    response: string;
    timestamp: string;
  }>;
}

export interface GameResponse {
  story: string;
  effects: GameEffect[];
}

export interface GameEffect {
  type: 'item' | 'location' | 'quest' | 'status';
  action: string;
  data: Record<string, any>;
}

export interface GameState {
  currentScene: string;
  activeEffects: GameEffect[];
  temporaryFlags: Record<string, any>;
  lastAction?: string;
  lastResponse?: string;
}

export interface GameMemoryEntry {
  id: string;
  playerId: string;
  type: string;
  content: string;
  timestamp: Date;
  location: string;
  importance: number;
  metadata?: Record<string, any>;
}

export interface MemoryContextRequest {
  playerId: string;
  location: string;
  action: string;
  limit?: number;
}

export interface GameStateRequest {
  playerId: string;
  gameState: Omit<GameState, 'playerId'>;
} 