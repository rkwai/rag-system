export interface Env {
  AI: any; // Workers AI binding
  DB: D1Database;
  VECTORSTORE: any; // Vectorize binding
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
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