# RPG Game with Edge RAG System

An AI-powered role-playing game where stories, items, and quests are dynamically generated and remembered using a RAG (Retrieval-Augmented Generation) system. Built on Cloudflare's edge infrastructure for global, low-latency gameplay.

## Features

- Dynamic story generation using Mixtral 8x7B
- Persistent game state with memory of items and quests
- Edge-first architecture using Cloudflare Workers
- Vector search with Cloudflare Vectorize for memory retrieval
- Document embedding with BGE-large-en-v1.5
- Game state storage with D1 (SQL) and R2 (objects)
- Performance optimization with KV caching

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Cloudflare credentials:
```bash
wrangler login
```

3. Start development (uses remote infrastructure):
```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## Testing

```bash
npm test
```

## Architecture

See `spec.md` for detailed technical architecture documentation.

## System Requirements

- Node.js 18+
- Cloudflare account with:
  - Workers AI access
  - D1 database
  - R2 storage
  - KV namespace
  - Vectorize instance
  