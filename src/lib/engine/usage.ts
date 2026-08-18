/* ═══════════════════════════════════════════════
   Token accounting. Providers report what a call actually
   consumed — including how much of the prompt was served
   from their input cache. The app's stable-prefix design
   only pays off if those cached counts are non-zero, so
   we surface them in the diagnostics export rather than
   assuming. Pure module: parse + format, no I/O.
══════════════════════════════════════════════ */
import { isRecord } from './text';

export interface TokenUsage {
  prompt: number;       // total input tokens billed for this call
  cached: number;       // input tokens served from the provider's cache
  cacheWritten: number; // input tokens written INTO the cache by this call
  completion: number;   // generated tokens
  reasoning: number;    // thinking tokens (subset of completion, when reported)
  cost: number | null;  // provider-reported cost, when available
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Read the usage block of an OpenAI-compatible response. Field names vary
 * slightly between providers, so the cached count is looked up under both the
 * OpenAI-style nested shape and the flat Anthropic-style alias.
 */
export function extractUsage(payload: unknown): TokenUsage | null {
  if (!isRecord(payload)) return null;
  const usage = payload.usage;
  if (!isRecord(usage)) return null;

  const promptDetails = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
  const completionDetails = isRecord(usage.completion_tokens_details) ? usage.completion_tokens_details : {};

  const prompt = num(usage.prompt_tokens) || num(usage.input_tokens);
  const completion = num(usage.completion_tokens) || num(usage.output_tokens);
  if (!prompt && !completion) return null;

  return {
    prompt,
    completion,
    cached: num(promptDetails.cached_tokens) || num(usage.cache_read_input_tokens),
    cacheWritten: num(promptDetails.cache_write_tokens) || num(usage.cache_creation_input_tokens),
    reasoning: num(completionDetails.reasoning_tokens),
    cost: typeof usage.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : null
  };
}

/** Share of the input that the provider served from its cache (0 when none). */
export function cacheHitRate(usage: TokenUsage): number {
  return usage.prompt > 0 ? usage.cached / usage.prompt : 0;
}

const fr = (n: number): string => n.toLocaleString('fr-FR');

/**
 * One diagnostic line per model call. Says plainly whether the input cache
 * engaged — "cache inactif" is the signal that the stable prefix is buying
 * nothing on this model (e.g. a provider that needs explicit cache_control).
 */
export function formatUsage(usage: TokenUsage, label: string, model: string): string {
  const parts = [`${fr(usage.prompt)} tokens d'entrée`];
  if (usage.cached > 0) {
    parts.push(`dont ${fr(usage.cached)} servis en cache (${Math.round(cacheHitRate(usage) * 100)} %)`);
  } else {
    parts.push('cache inactif');
  }
  if (usage.cacheWritten > 0) parts.push(`${fr(usage.cacheWritten)} écrits en cache`);
  parts.push(`${fr(usage.completion)} générés`);
  if (usage.reasoning > 0) parts.push(`(dont ${fr(usage.reasoning)} de raisonnement)`);
  if (usage.cost !== null) parts.push(`coût ${usage.cost.toFixed(6)} $`);
  return `usage ${label} [${model}] : ${parts.join(' · ')}`;
}
