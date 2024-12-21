export type PlayerClass = 'Warrior' | 'Mage' | 'Rogue' | 'Cleric' | 'Ranger';

export interface Player {
  id: string;
  name: string;
  level: number;
  class: PlayerClass;
  experience: number;
  gold: number;
  inventory: InventoryItem[];
  stats: PlayerStats;
  location: string;
}

export interface PlayerStats {
  health: number;
  mana: number;
  strength: number;
  intelligence: number;
  dexterity: number;
  constitution: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: ItemType;
  quantity: number;
  stats?: ItemStats;
}

export interface ItemStats {
  damage?: number;
  armor?: number;
  healing?: number;
  effects?: string[];
}

export type ItemType = 'weapon' | 'armor' | 'potion' | 'quest' | 'material'; 