import { mockAI } from './mockAI';

export function isProduction(env: Record<string, any>): boolean {
  return env.ENVIRONMENT === 'production';
}

export function getAI(env: Record<string, any>) {
  if (isProduction(env)) {
    return env.AI;
  }
  return mockAI;
} 