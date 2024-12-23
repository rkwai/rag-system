import type { Ai, D1Database, KVNamespace, R2Bucket, VectorizeIndex } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  AI: {
    run(model: string, options: AIInput): Promise<AIResponse>;
  };
  VECTORSTORE: VectorizeIndex;
  VECTORIZE: {
    insert(collection: string, data: VectorizeInsert): Promise<void>;
    query(collection: string, query: VectorizeQuery): Promise<VectorizeResult[]>;
  };
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
  CACHE_TTL: string;
  ENVIRONMENT: string;
}

export interface AIInput {
  messages?: Array<{
    role: string;
    content: string;
  }>;
  text?: string;
  model?: string;
  dimensions?: number;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIResponse {
  response?: string;
  embedding?: number[];
}

export interface VectorizeInsert {
  id: string;
  metadata: Record<string, any>;
  vector: number[];
}

export interface VectorizeQuery {
  vector: number[];
  topK?: number;
}

export interface VectorizeResult {
  id: string;
  metadata: Record<string, any>;
  score: number;
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

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
} 