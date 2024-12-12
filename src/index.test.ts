/**
 * Integration tests for the RAG System API endpoints
 */
import { describe, it, expect, vi } from 'vitest';

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
      // First ingest a test document
      await fetch(`${API_URL}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-doc-1',
          content: 'This is a test document for querying.',
          title: 'Test Document'
        }),
      });

      // Then test the query
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is in the test document?',
        }),
      });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('response');
    }, 30000); // 30 second timeout

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
          content: 'This is a test document. It has multiple sentences. This should create chunks.',
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
    it('should handle invalid JSON with 400', async () => {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        body: 'invalid json',
      });
      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });

    it('should handle internal server errors with 500', async () => {
      // Temporarily suppress console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: 'test',
          options: { maxResults: -1 }
        }),
      });
      
      expect(res.status).toBe(500);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
}); 