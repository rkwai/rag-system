/**
 * Represents a search query result
 */
export interface SearchResult {
  /** Original search query text */
  query: string;
  /** AI-generated response based on context */
  response: string;
  /** Array of relevant context chunks used for generation */
  context: any[];
  /** Result metadata */
  metadata: {
    /** When the search was performed */
    timestamp: string;
    /** AI model used for generation */
    model: string;
  };
} 