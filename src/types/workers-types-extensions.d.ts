import '@cloudflare/workers-types';

declare module '@cloudflare/workers-types' {
  interface Ai {
    run(model: '@cf/mistral/mixtral-8x7b-instruct-v0.1' | '@cf/baai/bge-base-en-v1.5', options: any): Promise<any>;
  }
} 