/**
 * Integration tests for the RAG System API endpoints
 */
import { describe, it, expect } from 'vitest';

const API_URL = 'http://localhost:8787';

describe('API Endpoints', () => {
  /**
   * Health check endpoint tests
   */
  describe('GET /', () => {
    it('should return health check message', async () => {
      const res = await fetch(`${API_URL}/`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('RAG System Healthy');
    });
  });

  /**
   * Query endpoint tests
   */
  describe('POST /query', () => {
    it('should process a query request', async () => {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test query',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('response');
    });

    it('should handle invalid query request', async () => {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
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
      const res = await fetch(`${API_URL}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-doc-1',
          content: 'test document content',
          metadata: { title: 'Test Document' },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success');
    });

    it('should handle invalid document request', async () => {
      const res = await fetch(`${API_URL}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Missing required fields
      });
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
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      expect(res.status).toBe(500);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('message');
    });
  });
}); 