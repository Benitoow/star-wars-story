import { db, type StoredEmbedding } from './db';
import type { EmbeddingCache } from '$lib/engine/embedding';

/**
 * How many fact vectors to keep. A qwen3-embedding-8b vector is 4096 floats,
 * so each row costs roughly 32 KB in IndexedDB — unbounded growth across every
 * story a player ever ran was adding up to tens of megabytes, and consolidation
 * orphans old vectors that nothing will ever read again.
 */
export const EMBEDDING_CACHE_MAX = 400;
/** Drop this many extra rows per pass so pruning is rare, not once-per-write. */
const PRUNE_SLACK = 80;

let writesSincePrune = 0;

/** Evict the oldest rows once the table grows past its ceiling. */
export async function pruneEmbeddings(max = EMBEDDING_CACHE_MAX): Promise<number> {
  const count = await db.embeddings.count();
  if (count <= max) return 0;
  const excess = count - max + PRUNE_SLACK;
  // createdAt is not indexed, so sort in memory over keys only — the table is
  // bounded by design and this runs at most once every PRUNE_SLACK writes.
  const rows = await db.embeddings.toArray();
  const doomed = rows
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.min(excess, rows.length))
    .map((r) => r.key);
  if (!doomed.length) return 0;
  await db.embeddings.bulkDelete(doomed);
  return doomed.length;
}

/** IndexedDB-backed embedding cache — vectors persist across sessions. */
export const embeddingCache: EmbeddingCache = {
  async get(key: string): Promise<number[] | null> {
    const row = await db.embeddings.get(key);
    return row?.vector ?? null;
  },
  async set(key: string, vector: number[]): Promise<void> {
    const row: StoredEmbedding = { key, vector, createdAt: Date.now() };
    await db.embeddings.put(row);
    writesSincePrune += 1;
    if (writesSincePrune >= PRUNE_SLACK) {
      writesSincePrune = 0;
      // Never let cache maintenance break a turn.
      await pruneEmbeddings().catch(() => 0);
    }
  }
};
