# RPG Game API Documentation

## Base URL
```
https://rpg-game.workers.dev/api/v1
```

## Authentication
All requests require a Bearer token in the Authorization header:
```
Authorization: Bearer <player_token>
```

## Endpoints

### Player Management

#### Create Player
```http
POST /players
Content-Type: application/json

{
  "name": string,
  "class": "Warrior" | "Mage" | "Rogue" | "Cleric" | "Ranger",
  "location": string,
  "inventoryCapacity": number  // Optional, defaults to 20
}

Response: {
  "id": string,
  "name": string,
  "class": string,
  "level": number,
  "experience": number,
  "gold": number,
  "inventory": Inventory,
  "stats": PlayerStats,
  "location": string
}
```

#### Get Player Details
```http
GET /players/{playerId}

Response: {
  "id": string,
  "name": string,
  "class": string,
  "level": number,
  "experience": number,
  "gold": number,
  "inventory": Inventory,
  "stats": PlayerStats,
  "location": string
}
```

#### Update Player Location
```http
PUT /players/{playerId}/location
Content-Type: application/json

{
  "location": string
}

Response: PlayerData
```

#### Add Experience
```http
POST /players/{playerId}/experience
Content-Type: application/json

{
  "amount": number,
  "source": string
}

Response: PlayerData  // Includes updated level and stats if leveled up
```

### Item Management

#### Create Item
```http
POST /items
Content-Type: application/json

{
  "name": string,
  "description": string,
  "type": "weapon" | "armor" | "consumable" | "quest" | "key",
  "rarity": "common" | "uncommon" | "rare" | "epic" | "legendary",
  "properties": object,
  "value": number,
  "questRelated": boolean
}

Response: Item
```

#### Add Item to Inventory
```http
POST /players/{playerId}/inventory/add
Content-Type: application/json

{
  "itemId": string,
  "quantity": number
}

Response: {
  "id": string,
  "inventory": Inventory
}
```

#### Remove Item from Inventory
```http
POST /players/{playerId}/inventory/remove
Content-Type: application/json

{
  "itemId": string,
  "quantity": number
}

Response: {
  "id": string,
  "inventory": Inventory
}
```

#### Get Items by Type
```http
GET /players/{playerId}/inventory/type/{itemType}

Response: {
  "items": [{
    "item": Item,
    "quantity": number
  }]
}
```

### Quest System

#### Generate Quest
```http
POST /quests
Content-Type: application/json

{
  "player": {
    "id": string,
    "level": number,
    "class": string,
    "location": string
  },
  "difficulty": "easy" | "medium" | "hard" | "epic",
  "useHistory": boolean  // Optional
}

Response: {
  "id": string,
  "title": string,
  "description": string,
  "objectives": QuestObjective[],
  "rewards": QuestReward[],
  "requiredLevel": number,
  "requiredClass": string,
  "location": string,
  "difficulty": string,
  "status": string,
  "assignedPlayer": string
}
```

#### Update Quest Progress
```http
PUT /quests/{questId}/progress
Content-Type: application/json

{
  "playerId": string,
  "objectiveId": string,
  "progress": number
}

Response: Quest  // Updated quest state
```

#### Record Quest History
```http
POST /quests/history
Content-Type: application/json

{
  "questId": string,
  "playerId": string,
  "status": string,
  "outcome": string
}

Response: {
  "success": boolean
}
```

## Types

### Core Types
```typescript
interface PlayerStats {
  health: number;
  mana: number;
  strength: number;
  intelligence: number;
  dexterity: number;
  constitution: number;
}

interface Inventory {
  items: {
    [itemId: string]: {
      item: Item;
      quantity: number;
    }
  };
  capacity: number;
}

interface Item {
  id: string;
  name: string;
  description: string;
  type: "weapon" | "armor" | "consumable" | "quest" | "key";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  properties: object;
  value: number;
  questRelated: boolean;
}

interface QuestObjective {
  id: string;
  description: string;
  progress: number;
  required: number;
  type: "kill" | "collect" | "explore" | "interact" | "escort";
  status: "pending" | "in_progress" | "completed";
}

interface QuestReward {
  type: "experience" | "gold" | "item";
  amount: number;
}
```

## Rate Limits
- 30 requests per minute per player
- 5 requests per second for state queries

## Error Responses
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  }
}
```

Common error codes:
- `invalid_request`: Malformed request
- `unauthorized`: Invalid or missing authentication
- `not_found`: Resource not found
- `server_error`: Internal server error