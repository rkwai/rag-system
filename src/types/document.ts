/**
 * Represents a raw document before processing
 */
export interface Document {
  /** Unique identifier for the document */
  id: string;
  /** Document title */
  title: string;
  /** Raw document content */
  content: string;
  /** Optional metadata key-value pairs */
  metadata?: Record<string, any>;
}

/**
 * Represents a document after processing and chunking
 */
export interface ProcessedDocument {
  /** Original document ID */
  id: string;
  /** Array of processed content chunks */
  chunks: {
    /** Unique chunk identifier */
    id: string;
    /** Chunk text content */
    content: string;
    /** Vector embedding of chunk content */
    embedding: Float32Array;
    /** Position of chunk in original document */
    position: number;
  }[];
  /** Document metadata */
  metadata: {
    /** Original document title */
    title: string;
    /** Timestamp of processing */
    processedAt: string;
  };
}

/**
 * Represents a search query result
 */
export interface SearchResult {
  /** Original search query */
  query: string;
  /** Generated response */
  response: string;
  /** Relevant context chunks used */
  context: any[];
  /** Result metadata */
  metadata: {
    /** Timestamp of search */
    timestamp: string;
    /** Model used for generation */
    model: string;
  };
} 