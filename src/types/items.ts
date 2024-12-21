export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'quest' | 'key';

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  properties: {
    damage?: number;
    defense?: number;
    healing?: number;
    durability?: number;
    uses?: number;
    effects?: string[];
  };
  value: number;
  questRelated?: boolean;
}

export interface Inventory {
  items: {
    [itemId: string]: {
      item: Item;
      quantity: number;
    };
  };
  capacity: number;
} 