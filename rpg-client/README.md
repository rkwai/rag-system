# RPG Game Client

A rich terminal-based client for interacting with the AI-powered RPG game system. Features a beautiful command-line interface with colored output, interactive prompts, and persistent game state management.

## ✨ Features

- Interactive command-line interface with rich text formatting
- Character creation and management
- Real-time game state persistence
- Inventory system with multiple item types
- Location-based gameplay
- Experience and leveling system
- Memory system for contextual storytelling

## 🎮 Game Elements

### Character Classes
- Warrior
- Mage
- Rogue
- Cleric
- Ranger

### Item Types
- Weapons
- Armor
- Consumables
- Quest Items
- Keys

## 🚀 Getting Started

1. Set up the environment:
```bash
./setup.sh
```

2. Activate the virtual environment:
```bash
source .venv/bin/activate
```

3. Start the game:
```bash
python rpg_client.py start
```

## 🎯 Game Commands

- `act`: Perform an action in the game world
- `status`: View your character's current status
- `move`: Travel to a different location
- `save`: Save your current game state
- `quit`: Save and exit the game

## 📦 Dependencies

- requests >= 2.31.0: HTTP client for API communication
- rich >= 13.7.0: Terminal formatting and UI
- typer >= 0.9.0: Command-line interface framework

## 🔧 Configuration

The client connects to the game server at `http://localhost:8787` by default. To use a different server:

1. Set the `RPG_SERVER_URL` environment variable:
```bash
export RPG_SERVER_URL="http://your-server-url"
```

2. Or modify the `base_url` in `RPGClient` class initialization.

## 🎨 UI Features

- Colored output for different message types
- Formatted tables for inventory display
- Interactive prompts for user input
- Progress indicators for actions
- Error messages with detailed feedback 