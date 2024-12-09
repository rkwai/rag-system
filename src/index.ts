import { Hono } from 'hono';
import { Env } from './types/env';
import queryWorker from './workers/query';
import documentWorker from './workers/document';

const app = new Hono<{ Bindings: Env & { [key: string]: unknown } }>();

// Health check endpoint
app.get('/', (c) => c.text('RAG System Healthy'));

// Query endpoint
app.post('/query', async (c) => {
  const response = await queryWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

// Document ingestion endpoint
app.post('/document', async (c) => {
  const response = await documentWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

// Error handling
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'Unknown error'
    },
    500
  );
});

export default app; 