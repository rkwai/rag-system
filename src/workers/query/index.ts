import { Env } from '../../types/env';
import { processQuery } from './processor';

interface QueryRequest {
  query: string;
  options?: {
    maxResults?: number;
    threshold?: number;
  };
}

export default {
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