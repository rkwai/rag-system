/**
 * Integration tests for the RAG System API endpoints
 */
import { describe, it, expect, beforeAll } from 'vitest';
import app from './index';
import { Env } from './types/env';
import { MockAI, MockVectorStore, MockKV, MockR2, MockD1 } from './mocks/workers';

describe('API Endpoints', () => {
  let testApp: typeof app;
  let env: Env;

  beforeAll(() => {
    testApp = app;
    // Setup test environment with mocks
    env = {
      AI: new MockAI(),
      DB: new MockD1(),
      VECTORSTORE: new MockVectorStore(),
      CACHE: new MockKV(),
      STORAGE: new MockR2(),
      CACHE_TTL: '3600',
    } as Env;
  });

  /**
   * Health check endpoint tests
   */
  describe('GET /', () => {
    it('should return health check message', async () => {
      const req = new Request('http://localhost/');
      const res = await testApp.fetch(req, env);
      
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('RAG System Healthy');
    });
  });

  /**
   * Query endpoint tests
   */
  describe('POST /query', () => {
    it('should process a query request', async () => {
      const req = new Request('http://localhost/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test query',
          filters: {},
        }),
      });

      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('result');
    });

    it('should handle invalid query request', async () => {
      const req = new Request('http://localhost/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Missing required fields
      });

      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  /**
   * Document ingestion endpoint tests
   */
  describe('POST /document', () => {
    it('should process a document ingestion request', async () => {
      const req = new Request('http://localhost/document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'test document content',
          metadata: {
            title: 'Test Document',
          },
        }),
      });

      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success');
    });

    it('should handle invalid document request', async () => {
      const req = new Request('http://localhost/document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Missing required fields
      });

      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  /**
   * Error handling tests
   */
  describe('Error Handling', () => {
    it('should handle internal server errors', async () => {
      // Simulate an error by passing malformed request
      const req = new Request('http://localhost/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });
      
      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(500);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('message');
    });
  });
}); 