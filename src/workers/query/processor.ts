import { Env } from '../../types/env';
import { SearchResult } from '../../types/search';

export async function processQuery(
  query: string,
  options: { maxResults?: number; threshold?: number } = {},
  env: Env
): Promise<SearchResult> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query, env);
    
    // Search for relevant context
    const context = await searchVectorStore(embedding, options, env);
    
    // Generate response using context
    const response = await generateResponse(query, context, env);
    
    return {
      query,
      response,
      context,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'mixtral-8x7b'
      }
    };
  } catch (error) {
    console.error('Query processing error:', error);
    throw new Error('Failed to process query');
  }
}

async function generateEmbedding(text: string, env: Env): Promise<Float32Array> {
  const response = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
    text: text
  });
  return response;
}

async function searchVectorStore(
  embedding: Float32Array,
  options: { maxResults?: number; threshold?: number },
  env: Env
) {
  const { maxResults = 3, threshold = 0.7 } = options;
  
  const results = await env.VECTORSTORE.query('documents', {
    vector: embedding,
    topK: maxResults,
    filter: { threshold }
  });
  
  return results;
}

async function generateResponse(
  query: string,
  context: any[],
  env: Env
): Promise<string> {
  const prompt = `
    Context: ${context.map(c => c.text).join('\n')}
    
    Question: ${query}
    
    Please provide a detailed answer based on the context above.
  `;
  
  const response = await env.AI.run('@cf/mistral/mixtral-8x7b-instruct-v0.1', {
    messages: [{ role: 'user', content: prompt }]
  });
  
  return response.response;
} 