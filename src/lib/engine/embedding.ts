/* ═══════════════════════════════════════════════
   Semantic embeddings — OpenRouter /embeddings
   transport with a pluggable cache (IndexedDB in
   the app, in-memory in tests). Any failure returns
   null so callers fall back to lexical retrieval:
   semantic memory is an enhancement, never a
   hard dependency.
══════════════════════════════════════════════ */
import { buildAuthHeaders, getProviderBaseUrl, getProviderDisplayName } from '$lib/content/providers';
import { foldText, cleanText } from './text';
import type { StoryProviderConfig } from './types';

export const DEFAULT_EMBEDDING_MODEL = 'qwen/qwen3-embedding-8b';

export interface EmbeddingCache {
  get(key: string): Promise<number[] | null>;
  set(key: string, vector: number[]): Promise<void>;
}

const REQUEST_TIMEOUT_MS = 30000;

function parseError(rawBody: string, fallback: string): string {
  try {
    const data = JSON.parse(rawBody) as Record<string, unknown>;
    const nested = data.error as Record<string, unknown> | undefined;
    if (nested && typeof nested.message === 'string') return cleanText(nested.message, 240);
    if (typeof data.message === 'string') return cleanText(data.message, 240);
  } catch { /* plain text */ }
  return cleanText(rawBody, 240) || fallback;
}

/** Embed a batch of texts via the provider's /embeddings endpoint. */
export async function embedTexts(
  texts: string[],
  config: StoryProviderConfig,
  signal?: AbortSignal
): Promise<number[][]> {
  const providerId = String(config.providerId || '').toLowerCase();
  if (providerId === 'mimo') throw new Error('Embeddings indisponibles pour MiMo — repli sur la recherche lexicale.');
  if (!config.apiKey) throw new Error('Clé API manquante pour les embeddings.');

  const baseUrl = getProviderBaseUrl(providerId);
  const headers = buildAuthHeaders(providerId, config.apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: DEFAULT_EMBEDDING_MODEL,
        input: texts
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const message = parseError(await response.text().catch(() => ''), `HTTP ${response.status}`);
      throw new Error(`${getProviderDisplayName(providerId)} : ${message}`);
    }
    const payload = (await response.json().catch(() => null)) as { data?: Array<{ embedding?: number[] }> } | null;
    const vectors = (payload?.data ?? []).map((entry) => entry.embedding ?? []);
    if (!vectors.length || vectors.some((v) => !v.length)) {
      throw new Error(`${getProviderDisplayName(providerId)} : réponse embeddings vide.`);
    }
    return vectors;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Resolve vectors for every text, using the cache when possible and embedding
 * the missing ones in a single batch. Returns null on any failure so callers
 * can fall back to lexical scoring.
 */
export async function getOrCreateVectors(
  texts: string[],
  config: StoryProviderConfig,
  cache?: EmbeddingCache,
  signal?: AbortSignal
): Promise<Map<string, number[]> | null> {
  const result = new Map<string, number[]>();
  const missing: Array<{ key: string; text: string }> = [];
  for (const text of texts) {
    const key = `${DEFAULT_EMBEDDING_MODEL}::${foldText(text)}`;
    // A cache failure is never fatal — fall through to the network (or lexical).
    const cached = cache ? await cache.get(key).catch(() => null) : null;
    if (cached) result.set(foldText(text), cached);
    else missing.push({ key, text });
  }
  if (!missing.length) return result;
  try {
    const vectors = await embedTexts(missing.map((m) => m.text), config, signal);
    for (let i = 0; i < missing.length; i += 1) {
      const vector = vectors[i] ?? [];
      if (!vector.length) continue;
      result.set(foldText(missing[i].text), vector);
      void cache?.set(missing[i].key, vector).catch(() => undefined);
    }
    return result;
  } catch {
    return null;
  }
}
