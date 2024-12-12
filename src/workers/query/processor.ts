import { Env } from '../../types/env';
import { VECTOR_DIMENSION } from '../../utils/environment';

async function generateEmbedding(text: string, env: Env): Promise<Float32Array> {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: text,
    type: 'query'  // Note: Use 'query' type for queries
  });
  const valuesIterable = response.data[0].values();
  const values = Array.from(valuesIterable) as number[];
  return Float32Array.from(values);
}

export async function processQuery(
  query: string, 
  options: { maxResults?: number; threshold?: number } = {}, 
  env: Env
) {
  try {
    if (options.maxResults && options.maxResults < 0) {
      throw new Error('maxResults must be a positive number');
    }
    const queryEmbedding = await generateEmbedding(query, env);
    
    const results = await env.VECTORSTORE.query(Array.from(queryEmbedding), {
      topK: options.maxResults || 3
    });

    if (!results.matches || results.matches.length === 0) {
      return {
        response: "No relevant information found."
      };
    }

    const response = await generateResponse(results.matches, query, env);
    return { response };
  } catch (error) {
    console.error('Query processing error:', error);
    throw new Error(`Failed to process query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateResponse(matches: any[], query: string, env: Env) {
  const context = matches
    .filter(match => match?.metadata?.content)
    .map(match => match.metadata.content)
    .join('\n');

  if (!context) {
    return "No relevant context found for the query.";
  }

  const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Use the provided context to answer questions accurately and concisely.'
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nQuestion: ${query}`
      }
    ],
    stream: false // Ensure we get a complete response, not a stream
  });

  // Cast the response to the expected type
  const result = response as unknown as { response: string };
  return result.response;
}
