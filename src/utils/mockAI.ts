import { VECTOR_DIMENSION } from './environment';

export const mockAI = {
  async run(model: string, input: any) {
    if (model.includes('bge')) {
      // Mock embedding with correct dimension (384)
      return {
        data: [
          {
            values: () => Array.from({ length: VECTOR_DIMENSION }, () => Math.random())
          }
        ]
      };
    } else {
      // Mock LLM response
      return {
        response: "This is a mock response from the AI model."
      };
    }
  }
}; 