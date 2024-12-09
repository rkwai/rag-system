export const mockAI = {
  async run(model: string, input: any) {
    if (model.includes('bge')) {
      // Mock embedding
      return new Float32Array(1024).fill(0.1);
    } else {
      // Mock LLM response
      return {
        response: "This is a mock response from the AI model."
      };
    }
  }
}; 