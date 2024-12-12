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
      const data = await request.json();
      const { query, options } = data as QueryRequest;
      
      const result = await processQuery(query, options, env);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 