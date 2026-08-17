import { db, type StoredEmbedding } from './db';
import type { EmbeddingCache } from '$lib/engine/embedding';

/** IndexedDB-backed embedding cache — vectors persist across sessions. */
export const embeddingCache: EmbeddingCache = {
  async get(key: string): Promise<number[] | null> {
    const row = await db.embeddings.get(key);
    return row?.vector ?? null;
  },
  async set(key: string, vector: number[]): Promise<void> {
    const row: StoredEmbedding = { key, vector, createdAt: Date.now() };
    await db.embeddings.put(row);
  }
};
