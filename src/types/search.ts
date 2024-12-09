export interface SearchResult {
  query: string;
  response: string;
  context: any[];
  metadata: {
    timestamp: string;
    model: string;
  };
} 