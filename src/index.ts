import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types/env';
import queryWorker from './workers/query';
import documentWorker from './workers/document';
import questWorker from './workers/quest';
import playerWorker from './workers/player';
import itemWorker from './workers/items';

const app = new Hono<{ Bindings: Env & { [key: string]: unknown } }>();

// Use Hono's built-in CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type']
}));

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

// Quest endpoints
app.post('/quests', async (c) => {
  const response = await questWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.post('/quests/history', async (c) => {
  const response = await questWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.put('/quests/:id/progress', async (c) => {
  const response = await questWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

// Player endpoints
app.post('/players', async (c) => {
  const response = await playerWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.get('/players/:id', async (c) => {
  const response = await playerWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.put('/players/:id/location', async (c) => {
  const response = await playerWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.post('/players/:id/inventory', async (c) => {
  const response = await playerWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.post('/players/:id/experience', async (c) => {
  const response = await playerWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

// Item Management endpoints
app.post('/items', async (c) => {
  const response = await itemWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.post('/players/:id/inventory/add', async (c) => {
  const response = await itemWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.post('/players/:id/inventory/remove', async (c) => {
  const response = await itemWorker.fetch(c.req.raw, c.env as Env);
  return response;
});

app.get('/players/:id/inventory/type/:type', async (c) => {
  const response = await itemWorker.fetch(c.req.raw, c.env as Env);
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