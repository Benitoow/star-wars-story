/* ═══════════════════════════════════════════════
   Memory retrieval service — assembles the pieces:
   lexical scoring (always available) fused with
   semantic embeddings (when enabled) via the
   IndexedDB cache. Semantic failure degrades to
   lexical automatically: memory retrieval never
   blocks a turn.
══════════════════════════════════════════════ */
import { embedTexts, getOrCreateVectors } from './embedding';
import {
  buildMemoryQuery,
  mergeScores,
  scoreFacts,
  selectFromScores,
  semanticScores
} from './retrieval';
import type { MemoryFact, StoryProviderConfig } from './types';

export interface MemoryRetrievalInput {
  provider: StoryProviderConfig;
  enableEmbeddings?: boolean;
  currentTurn?: number;
  topK?: number;
  cache?: import('./embedding').EmbeddingCache;
}

/** Retain only the most relevant facts for the current scene. */
export async function retrieveMemory(
  facts: MemoryFact[],
  query: string,
  input: MemoryRetrievalInput
): Promise<MemoryFact[]> {
  if (!facts.length) return facts;
  const options = { currentTurn: input.currentTurn, topK: input.topK };

  // Semantic path — enhanced recall when embeddings are enabled.
  if (input.enableEmbeddings && input.provider.apiKey) {
    // Facts are cached (they repeat across turns); the query is not — it changes
    // every turn and would otherwise grow the IndexedDB table by one row per turn.
    const factVectors = await getOrCreateVectors(facts.map((f) => f.text), input.provider, input.cache);
    if (factVectors) {
      const queryVector = await embedTexts([query], input.provider)
        .then((vectors) => vectors[0])
        .catch(() => undefined);
      if (queryVector) {
        const semantic = semanticScores(facts, queryVector, factVectors, options);
        const lexical = scoreFacts(facts, query, options);
        const merged = mergeScores(semantic, lexical).sort((a, b) => b.score - a.score);
        return selectFromScores(merged, facts, options);
      }
    }
  }
  // Lexical fallback — always available, no network.
  const lexical = scoreFacts(facts, query, options).sort((a, b) => b.score - a.score);
  return selectFromScores(lexical, facts, options);
}

export { buildMemoryQuery };
