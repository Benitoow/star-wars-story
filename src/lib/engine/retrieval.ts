/* ═══════════════════════════════════════════════
   Memory retrieval — inspired by Mnemosyne-style
   agentic memory: instead of injecting the whole
   fact list, select the facts most relevant to the
   current scene (lexical overlap + recency, fused
   with semantic embeddings when enabled).
   Pure module — no I/O, fully testable.
══════════════════════════════════════════════ */
import { foldText } from './text';
import type { MemoryCategory, MemoryFact } from './types';

export interface ScoredFact {
  fact: MemoryFact;
  score: number;
}

export interface RetrievalOptions {
  topK?: number;                // max facts injected (default 24)
  currentTurn?: number;         // recency anchor (default: newest fact turn)
  recencyHalfLife?: number;     // turns after which a fact halves its recency boost (default 8)
  alwaysIncludeRecent?: number; // always surface facts from the last N turns (default 3)
  categoryWeights?: Partial<Record<MemoryCategory, number>>;
}

const STOP_MIN_LENGTH = 3;
const DEFAULT_CATEGORY_WEIGHTS: Record<MemoryCategory, number> = {
  relations: 1.1,
  places: 0.95,
  injuries: 1,
  resources: 0.95,
  notes: 1
};

/** Accent-folded, lowercased tokens — very short words carry no signal. */
export function tokenize(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= STOP_MIN_LENGTH);
}

/** Cosine similarity over equal-length vectors; 0 for empty/mismatched. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function factTokens(fact: MemoryFact): string[] {
  return tokenize(fact.text);
}

function recencyBoost(turn: number, currentTurn: number, halfLife: number): number {
  if (turn <= 0) return Math.exp(-currentTurn / halfLife); // legacy facts: old by default
  const age = Math.max(0, currentTurn - turn);
  return Math.exp(-age / halfLife);
}

/**
 * Lexical relevance: weighted keyword overlap (IDF-style) normalized like a
 * cosine, then blended with a recency boost and a per-category weight.
 */
export function scoreFacts(
  facts: MemoryFact[],
  query: string,
  options: RetrievalOptions = {}
): ScoredFact[] {
  const currentTurn = options.currentTurn ?? Math.max(0, ...facts.map((f) => f.turn));
  const halfLife = options.recencyHalfLife ?? 8;
  const weights = { ...DEFAULT_CATEGORY_WEIGHTS, ...(options.categoryWeights ?? {}) };
  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    // No query signal: fall back to pure recency so the freshest facts stay visible.
    return facts.map((fact) => ({
      fact,
      score: recencyBoost(fact.turn, currentTurn, halfLife) * (weights[fact.category] ?? 1)
    }));
  }

  const tokenized = facts.map((fact) => ({ fact, tokens: factTokens(fact) }));
  const documentFrequency = new Map<string, number>();
  for (const { tokens } of tokenized) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const n = Math.max(1, facts.length);

  return tokenized.map(({ fact, tokens }) => {
    const present = new Set(tokens);
    let dot = 0;
    let norm = 0;
    for (const token of queryTokens) {
      const idf = Math.log(1 + n / (1 + (documentFrequency.get(token) ?? 0)));
      norm += idf * idf;
      if (present.has(token)) dot += idf;
    }
    const lexical = norm > 0 ? dot / Math.sqrt(norm) : 0;
    const recency = recencyBoost(fact.turn, currentTurn, halfLife);
    const score = lexical * (0.55 + 0.45 * recency) * (weights[fact.category] ?? 1);
    return { fact, score };
  });
}

/** Semantic (embedding) relevance blended with recency, same shape as scoreFacts. */
export function semanticScores(
  facts: MemoryFact[],
  queryVector: number[],
  vectors: ReadonlyMap<string, number[]>,
  options: RetrievalOptions = {}
): ScoredFact[] {
  const currentTurn = options.currentTurn ?? Math.max(0, ...facts.map((f) => f.turn));
  const halfLife = options.recencyHalfLife ?? 8;
  const weights = { ...DEFAULT_CATEGORY_WEIGHTS, ...(options.categoryWeights ?? {}) };
  return facts.map((fact) => {
    const vector = vectors.get(foldText(fact.text));
    const cosine = vector ? cosineSimilarity(queryVector, vector) : 0;
    const recency = recencyBoost(fact.turn, currentTurn, halfLife);
    const score = cosine * (0.6 + 0.4 * recency) * (weights[fact.category] ?? 1);
    return { fact, score };
  });
}

/** Fuse two rankings (lexical + semantic) into one, best first. */
export function mergeScores(...rankings: ScoredFact[][]): ScoredFact[] {
  const summed = new Map<string, { fact: MemoryFact; score: number; count: number }>();
  for (const ranking of rankings) {
    const maxScore = Math.max(1e-6, ...ranking.map((s) => s.score));
    for (const { fact, score } of ranking) {
      const key = foldText(fact.text);
      const entry = summed.get(key) ?? { fact, score: 0, count: 0 };
      entry.score += score / maxScore; // normalize each ranking before summing
      entry.count += 1;
      summed.set(key, entry);
    }
  }
  return [...summed.values()]
    .map((entry) => ({ fact: entry.fact, score: entry.score / entry.count }))
    .sort((a, b) => b.score - a.score);
}

/** Select the best-scoring facts, then any very-recent fact that would drop. */
export function selectFromScores(
  ranked: ScoredFact[],
  facts: MemoryFact[],
  options: RetrievalOptions = {}
): MemoryFact[] {
  const topK = options.topK ?? 24;
  const recentWindow = options.alwaysIncludeRecent ?? 3;
  const currentTurn = options.currentTurn ?? Math.max(0, ...facts.map((f) => f.turn));
  const selected: MemoryFact[] = [];
  const seen = new Set<string>();
  for (const { fact } of ranked) {
    if (selected.length >= topK) break;
    const key = foldText(fact.text);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(fact);
  }
  for (const fact of facts) {
    if (selected.length >= topK + recentWindow) break;
    if (fact.turn > 0 && currentTurn - fact.turn < recentWindow) {
      const key = foldText(fact.text);
      if (!seen.has(key)) {
        seen.add(key);
        selected.push(fact);
      }
    }
  }
  return selected;
}

/**
 * Select the facts to inject: best-scoring first, then any fact from the very
 * recent scene window that would otherwise be dropped (scene continuity beats
 * pure relevance), capped so the prompt block stays bounded.
 */
export function selectTopFacts(
  facts: MemoryFact[],
  query: string,
  options: RetrievalOptions = {}
): MemoryFact[] {
  const ranked = scoreFacts(facts, query, options).sort((a, b) => b.score - a.score);
  return selectFromScores(ranked, facts, options);
}

/** Join the available scene signals into one retrieval query. */
export function buildMemoryQuery(parts: Array<string | undefined>): string {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 800);
}
