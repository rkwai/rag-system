import { Item, Inventory, ItemType, ItemRarity } from '../types/items';
import { v4 as uuidv4 } from 'uuid';

export class ItemManager {
  static createItem(
    name: string,
    description: string,
    type: ItemType,
    rarity: ItemRarity,
    properties: Item['properties'],
    value: number,
    questRelated: boolean = false
  ): Item {
    return {
      id: uuidv4(),
      name,
      description,
      type,
      rarity,
      properties,
      value,
      questRelated
    };
  }

  static createInventory(capacity: number = 20): Inventory {
    return {
      items: {},
      capacity
    };
  }

  static addItemToInventory(inventory: Inventory, item: Item, quantity: number = 1): boolean {
    const currentSize = Object.keys(inventory.items).length;
    
    if (currentSize >= inventory.capacity && !inventory.items[item.id]) {
      return false;
    }

    if (inventory.items[item.id]) {
      inventory.items[item.id].quantity += quantity;
    } else {
      inventory.items[item.id] = {
        item,
        quantity
      };
    }

    return true;
  }

  static removeItemFromInventory(inventory: Inventory, itemId: string, quantity: number = 1): boolean {
    if (!inventory.items[itemId] || inventory.items[itemId].quantity < quantity) {
      return false;
    }

    inventory.items[itemId].quantity -= quantity;
    
    if (inventory.items[itemId].quantity <= 0) {
      delete inventory.items[itemId];
    }

    return true;
  }

  static getInventoryItems(inventory: Inventory): Array<{ item: Item; quantity: number }> {
    return Object.values(inventory.items);
  }

  static getItemsByType(inventory: Inventory, type: ItemType): Array<{ item: Item; quantity: number }> {
    return Object.values(inventory.items).filter(({ item }) => item.type === type);
  }

  static getInventoryWeight(inventory: Inventory): number {
    return Object.values(inventory.items).reduce((total, { item, quantity }) => {
      return total + (item.value * quantity);
    }, 0);
  }
} 