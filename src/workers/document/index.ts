import { Env } from '../../types/env';
import { Document } from '../../types/document';
import { processDocument } from './processor';

export default {
  /**
   * Handles incoming document ingestion requests
   * @param request - The incoming HTTP request
   * @param env - Environment bindings
   * @returns Response with processing result or error
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Verify HTTP method
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const data = await request.json() as Partial<Document>;
      
      // Validate required fields
      if (!data.content || !data.id) {
        return new Response(JSON.stringify({
          error: 'Document must include content and id'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Process and store document
      const result = await processDocument({
        id: data.id,
        content: data.content,
        title: data.title || data.id,  // Use id as fallback title
        metadata: data.metadata
      } as Document, env);
      
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Document processing error:', error);
      return new Response(JSON.stringify({ 
        error: 'Document processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 