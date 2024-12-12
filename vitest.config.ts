import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests will hit the local wrangler dev server
    environment: 'node',
    testTimeout: 10000,
  },
}); 