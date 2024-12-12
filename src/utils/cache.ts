import type { KVNamespace } from '@cloudflare/workers-types';

export async function getCached<T>(
  key: string,
  namespace: KVNamespace,
  generator: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await namespace.get(key);
  if (cached) return JSON.parse(cached);
  
  const fresh = await generator();
  await namespace.put(key, JSON.stringify(fresh), { expirationTtl: ttl });
  
  return fresh;
}

export async function invalidateCache(
  pattern: string,
  namespace: KVNamespace
): Promise<void> {
  const keys = await namespace.list({ prefix: pattern });
  await Promise.all(
    keys.keys.map(key => namespace.delete(key.name))
  );
} 