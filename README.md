# Edge RAG System

An edge-first RAG (Retrieval-Augmented Generation) system leveraging Cloudflare's infrastructure for a serverless, globally distributed architecture.

## Features

- Edge-first architecture using Cloudflare Workers
- Vector search with Cloudflare Vectorize
- LLM integration with Workers AI (Mixtral 8x7B)
- Document embedding with BGE-large-en-v1.5
- Relational storage with D1
- Object storage with R2
- Caching with KV

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Cloudflare credentials:
```bash
wrangler login
```

3. Start local development:
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