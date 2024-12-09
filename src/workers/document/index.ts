import { Env } from '../../types/env';
import { Document } from '../../types/document';
import { processDocument } from './processor';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const data = await request.json();
      const document = data as Document;
      
      if (!document.id || !document.content) {
        return new Response(JSON.stringify({
          error: 'Invalid document format',
          details: 'Document must include id and content fields'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await processDocument(document, env);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Document processing error:', error);
      return new Response(JSON.stringify({ 
        error: 'Document processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 