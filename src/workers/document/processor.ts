import { Env } from '../../types/env';
import { Document, ProcessedDocument } from '../../types/document';
import { VECTOR_DIMENSION } from '../../utils/environment';

async function generateEmbedding(text: string, env: Env): Promise<Float32Array> {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: text,
    type: 'passage'
  });
  const valuesIterable = response.data[0].values();
  const values = Array.from(valuesIterable) as number[];
  return Float32Array.from(values);
}

export async function processDocument(
  document: Document,
  env: Env
): Promise<ProcessedDocument> {
  if (!document.content || !document.id) {
    throw new Error('Document must include content and id');
  }
  try {
    console.log('Processing document:', document.id);

    // Split document into chunks
    console.log('Splitting document into chunks...');
    const chunks = await splitIntoChunks(document.content);
    console.log(`Created ${chunks.length} chunks`);
    
    // Generate embeddings for each chunk
    console.log('Generating embeddings for chunks...');
    const embeddedChunks = await Promise.all(
      chunks.map(async (chunk, index) => {
        try {
          return {
            id: `${document.id}-${index}`,
            content: chunk,
            embedding: await generateEmbedding(chunk, env),
            position: index,
            documentId: document.id
          };
        } catch (error) {
          console.error(`Error processing chunk ${index}:`, error);
          throw error;
        }
      })
    );
    
    // Store document metadata in D1
    console.log('Storing document metadata...');
    await storeDocumentMetadata(document, env);
    
    // Store chunks and embeddings in Vectorize
    console.log('Storing chunks and embeddings...');
    await storeEmbeddings(embeddedChunks, env);
    
    // Store original document in R2
    console.log('Storing original document...');
    await storeOriginalDocument(document, env);
    
    console.log('Document processing completed successfully');
    return {
      id: document.id,
      chunks: embeddedChunks,
      metadata: {
        title: document.title,
        processedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Document processing error:', error);
    throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function splitIntoChunks(text: string, maxChunkSize = 512): string[] {
  // If text is shorter than max size, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }

  // Split by sentences if possible
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

async function storeDocumentMetadata(document: Document, env: Env) {
  try {
    // Optionally use INSERT OR REPLACE to handle upserts
    await env.DB.prepare(`
      INSERT OR REPLACE INTO documents (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      document.id,
      document.title,
      Date.now(),
      Date.now()
    ).run();
  } catch (error) {
    console.error('Error storing document metadata:', error);
    throw new Error(`Failed to store document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function storeEmbeddings(chunks: any[], env: Env) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    console.log('No chunks to store');
    return;
  }

  if (VECTOR_DIMENSION !== 384) {
    throw new Error(`Embedding dimension mismatch: expected ${VECTOR_DIMENSION}, got ${VECTOR_DIMENSION}`);
  }

  // Add environment prefix to IDs and metadata
  const vectors = chunks.map(chunk => {
    if (!chunk.id || !chunk.documentId || !chunk.embedding) {
      throw new Error(`Missing required chunk properties: ${JSON.stringify(chunk)}`);
    }
    return {
      id: `${env.ENVIRONMENT}_${chunk.id}`,
      values: Array.from(chunk.embedding) as number[],
      metadata: {
        content: chunk.content,
        position: chunk.position,
        environment: env.ENVIRONMENT
      }
    };
  });

  await env.VECTORSTORE.upsert(vectors);
  
  // Store in D1 with environment prefix
  for (const chunk of chunks) {
    if (!chunk.documentId || !chunk.content || !chunk.embedding || chunk.position === undefined) {
      throw new Error(`Missing required chunk properties: ${JSON.stringify(chunk)}`);
    }
    await env.DB.prepare(`
      INSERT OR REPLACE INTO chunks (id, document_id, content, embedding, position)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      `${env.ENVIRONMENT}_${chunk.id}`,
      chunk.documentId,
      chunk.content,
      JSON.stringify(Array.from(chunk.embedding)),
      chunk.position
    ).run();
  }
}

async function storeOriginalDocument(document: Document, env: Env) {
  try {
    await env.STORAGE.put(
      `documents/${document.id}`,
      JSON.stringify(document),
      {
        customMetadata: {
          title: document.title,
          timestamp: new Date().toISOString()
        }
      }
    );
  } catch (error) {
    console.error('Error storing original document:', error);
    throw new Error(`Failed to store original document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 