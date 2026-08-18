/* ═══════════════════════════════════════════════
   Memory consolidation — Mnemosyne-style episodic
   compression: every N turns, the oldest notes are
   condensed into one dated synthesis by the model,
   so the fact list stays bounded without hard
   eviction losing information. Fail-safe: any
   error leaves the memory untouched.
══════════════════════════════════════════════ */
import { cleanText, foldText } from './text';
import type { MemoryCategory, MemoryFact, StoryProviderConfig } from './types';

export interface ConsolidationPlan {
  toConsolidate: MemoryFact[];
  remaining: MemoryFact[];
}

export interface ConsolidationOptions {
  everyTurn?: number;     // cadence: consolidate when currentTurn % everyTurn === 0
  olderThan?: number;     // a fact is "old" when currentTurn - turn >= olderThan
  minOldFacts?: number;   // minimum old facts before bothering to consolidate
  maxBatch?: number;      // cap per pass
  categories?: MemoryCategory[]; // only these categories are consolidated (relations stay intact)
}

const DEFAULT_OPTIONS: Required<ConsolidationOptions> = {
  everyTurn: 10,
  olderThan: 8,
  minOldFacts: 4,
  maxBatch: 8,
  categories: ['notes']
};

/** Decide whether a consolidation pass should run, and on which facts. */
export function planConsolidation(
  facts: MemoryFact[],
  currentTurn: number,
  options: ConsolidationOptions = {}
): ConsolidationPlan | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (currentTurn <= 0 || currentTurn % opts.everyTurn !== 0) return null;

  const toConsolidate = facts.filter(
    (f) =>
      f.turn > 0 &&
      currentTurn - f.turn >= opts.olderThan &&
      opts.categories.includes(f.category)
  );
  if (toConsolidate.length < opts.minOldFacts) return null;

  const batch = toConsolidate.slice(0, opts.maxBatch);
  const batchKeys = new Set(batch.map((f) => foldText(f.text)));
  const remaining = facts.filter((f) => !batchKeys.has(foldText(f.text)));
  return { toConsolidate: batch, remaining };
}

/** Replace the consolidated facts with a dated synthesis (pure). */
export function consolidateInto(
  facts: MemoryFact[],
  toConsolidate: MemoryFact[],
  summary: string,
  turn: number
): MemoryFact[] {
  const text = cleanText(summary, 280);
  if (!text) return facts;
  const replaced = new Set(toConsolidate.map((f) => foldText(f.text)));
  const kept = facts.filter((f) => !replaced.has(foldText(f.text)));
  return [...kept, { text, category: 'notes' as const, turn }];
}

const CONSOLIDATION_SYSTEM = 'Tu condenses des faits narratifs d\'une campagne Star Wars. Réponds UNIQUEMENT en JSON valide : {"summary": "synthèse d\'au plus 2 phrases, factuelle, sans prédiction ni supposition"}.' ;

/** Ask the model for a synthesis of the old facts. Throws on failure. */
export async function summarizeFacts(
  facts: MemoryFact[],
  provider: StoryProviderConfig,
  signal?: AbortSignal
): Promise<string> {
  const list = facts.map((f) => `- ${f.text}`).join('\n');
  const user = `Résume ces faits en une synthèse unique et factuelle (2 phrases max) :\n${list}`;
  const { callTextModel } = await import('./provider');
  const raw = await callTextModel(
    [
      { role: 'system', content: CONSOLIDATION_SYSTEM },
      { role: 'user', content: user }
    ],
    provider,
    { jsonMode: true, skipReasoning: true, signal, label: 'consolidation mémoire' }
  );
  try {
    const parsed = JSON.parse(raw) as { summary?: unknown };
    return cleanText(parsed.summary, 280);
  } catch {
    return cleanText(raw, 280);
  }
}

/**
 * Run one consolidation pass. Returns the new fact list, or the original one
 * when nothing is due or the model call fails (memory is never destroyed).
 */
export async function runConsolidation(
  facts: MemoryFact[],
  currentTurn: number,
  provider: StoryProviderConfig,
  options: ConsolidationOptions = {}
): Promise<MemoryFact[]> {
  const plan = planConsolidation(facts, currentTurn, options);
  if (!plan) return facts;
  try {
    const summary = await summarizeFacts(plan.toConsolidate, provider);
    if (!summary) return facts;
    return consolidateInto(facts, plan.toConsolidate, summary, currentTurn);
  } catch {
    return facts;
  }
}
