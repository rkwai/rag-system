# RPG Game API Documentation

## Base URL
```
https://rpg-game.workers.dev
```

## Endpoints

### Game Actions

#### Process Game Action
```http
POST /game/action
Content-Type: application/json

{
  "playerId": string,
  "action": string,
  "context": {
    "currentLocation": string,
    "inventory": InventoryItem[],
    "questStates": QuestState[],
    "gameHistory": GameHistoryEntry[]
  }
}

Response: {
  "story": string,
  "effects": GameEffect[]
}
```

### Memory Management

#### Store Memory
```http
POST /game/memory
Content-Type: application/json

{
  "playerId": string,
  "entry": {
    "type": string,
    "content": string,
    "location": string,
    "timestamp": string,
    "importance": number,
    "metadata": object
  }
}

Response: {
  "success": boolean,
  "memoryId": string
}
```

#### Retrieve Relevant Memories
```http
POST /game/memory/context
Content-Type: application/json

{
  "playerId": string,
  "location": string,
  "action": string,
  "limit": number
}

Response: GameMemoryEntry[]
```

### Game State Management

#### Save Game State
```http
POST /game/state
Content-Type: application/json

{
  "playerId": string,
  "state": {
    "currentScene": string,
    "activeEffects": GameEffect[],
    "temporaryFlags": object,
    "lastAction": string,
    "lastResponse": string
  }
}

Response: {
  "success": boolean
}
```

#### Get Game State
```http
GET /game/state/{playerId}

Response: GameState
```

### Player Management

#### Create Player
```http
POST /players
Content-Type: application/json

{
  "name": string,
  "class": "Warrior" | "Mage" | "Rogue" | "Cleric" | "Ranger",
  "location": string
}

Response: {
  "id": string,
  "name": string,
  "class": string,
  "level": number,
  "experience": number,
  "gold": number,
  "location": string,
  "inventory": {
    "items": Record<string, { item: Item, quantity: number }>,
    "capacity": number
  },
  "stats": PlayerStats
}
```

#### Update Player Location
```http
PUT /players/{playerId}/location
Content-Type: application/json

{
  "location": string
}

Response: Player
```

#### Add Experience
```http
POST /players/{playerId}/experience
Content-Type: application/json

{
  "amount": number,
  "source": string
}

Response: Player
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
  "value": number
}

Response: Item
```

#### Manage Inventory
```http
POST /players/{playerId}/inventory/add
Content-Type: application/json

{
  "itemId": string,
  "quantity": number
}

Response: {
  "success": boolean,
  "inventory": Inventory
}
```

## Types

### Core Types
```typescript
interface GameAction {
  playerId: string;
  action: string;
  timestamp: string;
}

interface GameContext {
  currentLocation: string;
  inventory: InventoryItem[];
  questStates: QuestState[];
  gameHistory: GameHistoryEntry[];
}

interface GameMemoryEntry {
  id: string;
  playerId: string;
  type: string;
  content: string;
  location: string;
  timestamp: Date;
  importance: number;
  metadata: object;
}

interface GameEffect {
  type: string;
  data: object;
}

interface PlayerStats {
  health: number;
  mana: number;
  strength: number;
  intelligence: number;
  dexterity: number;
  constitution: number;
}

interface Item {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity: string;
  properties: object;
  value: number;
}

interface Inventory {
  items: Record<string, {
    item: Item;
    quantity: number;
  }>;
  capacity: number;
}
```

## Error Handling

All endpoints return error responses in the following format:
```typescript
{
  error: string;
  details?: string;
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

## Rate Limits
- 50 requests per minute per player
- Memory operations limited to 20 vector matches per query