import { vi } from 'vitest';

/**
 * Mock implementation of Workers AI
 * Matches @cloudflare/workers-ai API
 */
export class MockAI {
  async run(model: string, input: { text: string[] | string }) {
    return { response: { text: 'mocked response' } };
  }
  async generateEmbeddings(input: { text: string[] }) {
    return { data: [{ values: new Float32Array(1024).fill(0) }] };
  }
}

/**
 * Mock implementation of Vectorize
 * Matches Cloudflare Vectorize API
 */
export class MockVectorStore {
  async query(vector: number[], options?: { topK?: number }) {
    return { matches: [] };
  }
  async upsert(vectors: Array<{ id: string, values: number[], metadata?: any }>) {
    return { success: true };
  }
}

/**
 * Mock implementation of KV namespace
 * Matches Cloudflare KV API
 */
export class MockKV implements KVNamespace {
  async get(key: string, options?: any): Promise<any> {
    return null;
  }
  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number, expirationTtl?: number }) { 
    return undefined; 
  }
  async delete(key: string) { 
    return undefined; 
  }
  async list<Metadata = unknown>(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<Metadata>> {
    return {
      keys: [],
      list_complete: true,
      cacheStatus: null
    };
  }
  async getWithMetadata(key: string, options?: any): Promise<any> {
    return { value: null, metadata: null, cacheStatus: null };
  }
}

/**
 * Mock implementation of R2 bucket
 * Matches Cloudflare R2 API
 */
export class MockR2 implements R2Bucket {
  async head(key: string) { return null; }
  async get(key: string) { return null; }
  async put(key: string, value: string | ArrayBuffer | ReadableStream | ArrayBufferView | Blob | null, options?: R2PutOptions): Promise<R2Object> {
    return {
      key,
      version: "v1",
      size: 0,
      etag: "etag",
      httpEtag: "etag",
      checksums: {
        md5: new ArrayBuffer(0),
        toJSON: () => ({ md5: "md5" })
      },
      uploaded: new Date(),
      httpMetadata: {},
      customMetadata: {},
      storageClass: "STANDARD",
      writeHttpMetadata: async () => {}
    };
  }
  async delete(key: string) { return undefined; }
  async list(options?: R2ListOptions): Promise<R2Objects> {
    return {
      objects: [],
      delimitedPrefixes: [],
      truncated: false
    };
  }
  async createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload> {
    return {
      key,
      uploadId: "upload-id",
      uploadPart: async (partNumber: number) => ({ 
        etag: "etag",
        partNumber
      }),
      abort: async () => {},
      complete: async () => ({
        key,
        version: "v1",
        size: 0,
        etag: "etag",
        httpEtag: "etag",
        checksums: { md5: new ArrayBuffer(0), toJSON: () => ({ md5: "md5" }) },
        uploaded: new Date(),
        httpMetadata: {},
        customMetadata: {},
        storageClass: "STANDARD",
        writeHttpMetadata: async () => {}
      })
    };
  }
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return {
      key,
      uploadId,
      uploadPart: async (partNumber: number) => ({ 
        etag: "etag",
        partNumber
      }),
      abort: async () => {},
      complete: async () => ({
        key,
        version: "v1",
        size: 0,
        etag: "etag",
        httpEtag: "etag",
        checksums: { md5: new ArrayBuffer(0), toJSON: () => ({ md5: "md5" }) },
        uploaded: new Date(),
        httpMetadata: {},
        customMetadata: {},
        storageClass: "STANDARD",
        writeHttpMetadata: async () => {}
      })
    };
  }
}

/**
 * Mock implementation of D1 database
 * Matches Cloudflare D1 API
 */
export class MockD1 implements D1Database {
  prepare(query: string): D1PreparedStatement {
    const statement = {
      bind: (...values: any[]) => statement,
      first: async <T = any>() => null as T,
      all: async <T = any>() => [] as T[],
      raw: async <T = any>() => [] as T[],
      run: async () => ({ meta: { duration: 0, last_row_id: 0, rows_written: 0, changed_db: false } })
    };
    return statement as unknown as D1PreparedStatement;
  }
  async dump() { return new Uint8Array(); }
  async batch<T = any>(statements: D1PreparedStatement[]) { return [] as D1Result<T>[]; }
  async exec(query: string): Promise<D1ExecResult> {
    return { count: 0, duration: 0 };
  }
} 