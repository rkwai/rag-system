import { defineConfig } from 'vitest/config';
import { MockAI, MockVectorStore } from './src/mocks/workers';

export default defineConfig({
  test: {
    // Use Miniflare for simulating Workers environment
    environment: 'miniflare',
    environmentOptions: {
      // Enable ES modules support
      modules: true,
      // Configure Worker bindings
      bindings: {
        AI: new MockAI(),
        DB: { type: 'd1' },
        VECTORSTORE: new MockVectorStore(),
        CACHE: { type: 'kv' },
        STORAGE: { type: 'r2' },
        CACHE_TTL: '3600',
      },
      // Load configuration from wrangler.toml
      wranglerConfigPath: './wrangler.toml',
      // Entry point for the worker
      scriptPath: 'src/index.ts',
    },
  },
}); 