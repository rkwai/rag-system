# RPG Game with Edge RAG System

An AI-powered role-playing game where stories, items, and quests are dynamically generated and remembered using a RAG (Retrieval-Augmented Generation) system. Built on Cloudflare's edge infrastructure for global, low-latency gameplay.

## Features

- Dynamic story generation using Mixtral 7B Instruct
- Contextual memory system using vector embeddings
- Persistent game state with memory of past actions, items, and quests
- Edge-first architecture using Cloudflare Workers
- Vector search with Cloudflare Vectorize for memory retrieval
- Document embedding with BGE-base-en-v1.5
- Game state storage with D1 (SQL) and KV (cache)
- Performance optimization with memory importance scoring

## Gameplay Mechanics

- Natural language interaction with the game master
- Contextual story generation based on player's history
- Automatic game effect detection from story responses
- Dynamic quest generation based on player state
- Inventory and item management system
- Location-based memory retrieval
- Experience and leveling system

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Cloudflare credentials:
```bash
wrangler login
```

3. Create required Cloudflare resources:
```bash
npm run setup
```

4. Update wrangler.toml with the created resource IDs

5. Start development:
```bash
npm run dev
```

## Testing

```bash
npm test
```

Tests cover:
- API endpoints functionality
- Game action processing
- Memory management
- Quest generation
- Player management
- Item management
- Game state persistence

## System Requirements

- Node.js 18+
- Cloudflare account with:
  - Workers AI access (for Mixtral and BGE models)
  - D1 database (for game state)
  - KV namespace (for caching)
  - Vectorize instance (for memory search)

## Architecture

See `spec.md` for detailed technical architecture documentation.
See `API.md` for API endpoint documentation.
  