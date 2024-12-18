import type { Ai, D1Database, KVNamespace, R2Bucket, VectorizeIndex } from '@cloudflare/workers-types';

export interface Env {
  AI: Ai;
  DB: D1Database;
  VECTORSTORE: VectorizeIndex;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
  CACHE_TTL: string;
  ENVIRONMENT: string;
}

export interface GenerationInput {
  prompt: string;
  parameters?: {
    maxTokens?: number;
    temperature?: number;
  };
}

export interface EmbeddingInput {
  text: string;
}

export interface ChatInput {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
} 