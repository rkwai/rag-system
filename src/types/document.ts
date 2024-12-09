export interface Document {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ProcessedDocument {
  id: string;
  chunks: {
    id: string;
    content: string;
    embedding: Float32Array;
    position: number;
  }[];
  metadata: {
    title: string;
    processedAt: string;
  };
}

export interface SearchResult {
  query: string;
  response: string;
  context: any[];
  metadata: {
    timestamp: string;
    model: string;
  };
} 