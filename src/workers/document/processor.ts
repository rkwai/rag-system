import { Env } from '../../types/env';
import { Document, ProcessedDocument } from '../../types/document';
import { getAI } from '../../utils/environment';

async function generateEmbedding(text: string, env: Env): Promise<Float32Array> {
  try {
    const ai = getAI(env);
    console.log('Generating embedding for text:', text.substring(0, 50) + '...');
    const embedding = await ai.run('@cf/baai/bge-large-en-v1.5', {
      text: text
    });
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function processDocument(
  document: Document,
  env: Env
): Promise<ProcessedDocument> {
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
            position: index
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
  // Simple sentence-based chunking
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
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
    await env.DB.prepare(`
      INSERT INTO documents (id, title, created_at, updated_at)
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
  try {
    // Store in Vectorize
    await env.VECTORSTORE.upsert('documents', chunks.map(chunk => ({
      id: chunk.id,
      values: chunk.embedding,
      metadata: {
        content: chunk.content,
        position: chunk.position
      }
    })));
    
    // Store in D1 for reference
    for (const chunk of chunks) {
      await env.DB.prepare(`
        INSERT INTO chunks (id, document_id, content, embedding, position)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        chunk.id,
        chunk.documentId,
        chunk.content,
        JSON.stringify(chunk.embedding),
        chunk.position
      ).run();
    }
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw new Error(`Failed to store embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
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