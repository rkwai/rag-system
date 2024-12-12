import { Env } from '../../types/env';
import { processQuery } from './processor';

/**
 * Structure of an incoming query request
 */
interface QueryRequest {
  /** Search query text */
  query: string;
  /** Optional search parameters */
  options?: {
    /** Maximum number of results to return */
    maxResults?: number;
    /** Similarity threshold for vector search */
    threshold?: number;
  };
}

export default {
  /**
   * Handles incoming query requests
   * @param request - The incoming HTTP request
   * @param env - Environment bindings
   * @returns Response with search results or error
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      let data: Partial<QueryRequest>;
      try {
        data = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate input
      if (!data.query) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request',
          message: 'Query is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await processQuery(data.query, data.options || {}, env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Query processing error:', error);
      return new Response(JSON.stringify({ 
        error: 'Query processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 