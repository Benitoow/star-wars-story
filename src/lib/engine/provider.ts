/* ═══════════════════════════════════════════════
   Text transport — OpenRouter via DIRECT fetch.
   The @openrouter/sdk fails in the browser ("Failed to
   fetch"), so we never use it. No max_tokens ceiling
   (the provider decides); reasoning defaults to 'auto'
   (param omitted → the model decides).
══════════════════════════════════════════════ */
import {
  DEFAULT_TEXT_MODEL_ID,
  OPENROUTER_APP_TITLE,
  OPENROUTER_BASE_URL,
  getProviderDisplayName,
  normalizeTextProviderId
} from '$lib/content/providers';
import { logger } from '$lib/logger';
import { cleanText } from './text';
import type { ChatMessage, StoryProviderConfig } from './types';

export interface TextGenOptions {
  temperature?: number;
  jsonMode?: boolean;       // request a JSON object response
  skipReasoning?: boolean;  // for internal extraction passes
}

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export function normalizeProviderConfig(config: StoryProviderConfig): Required<Omit<StoryProviderConfig, 'reasoningEffort'>> & { reasoningEffort: string } {
  return {
    providerId: normalizeTextProviderId(config.providerId),
    model: cleanText(config.model, 160) || DEFAULT_TEXT_MODEL_ID,
    apiKey: cleanText(config.apiKey, 500),
    reasoningEffort: cleanText(config.reasoningEffort, 16) || 'auto'
  };
}

function timeoutFor(model: string): number {
  const m = model.toLowerCase();
  if (/pro|max|large|opus|ultra/.test(m)) return 120000;
  if (/flash|mini|nano|lite|small/.test(m)) return 75000;
  return 90000;
}

function reasoningPayload(effort: string, skip: boolean, model: string): { effort: string } | undefined {
  if (skip) {
    const m = model.toLowerCase();
    const isReasoningModel = /\b(?:o1|o3|r1|grok-3|grok-4|thinking|kimi-k2\.6|sonar-reasoning)\b|deepseek\/deepseek-r1|openai\/o1|openai\/o3-mini/i.test(m);
    if (!isReasoningModel) {
      return undefined;
    }
    if (/\b(?:o1|r1|deepseek-r1|o3-mini)\b/i.test(m)) {
      return undefined;
    }
    return { effort: 'none' };
  }
  if (!effort || effort === 'auto') return undefined; // let the model decide
  return { effort };
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || !choices.length) return '';
  const message = (choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
  return cleanText(message?.content, 16000);
}

function parseError(rawBody: string, fallback: string): string {
  try {
    const data = JSON.parse(rawBody) as Record<string, unknown>;
    const nested = data.error;
    if (nested && typeof nested === 'object' && 'message' in nested) return cleanText((nested as Record<string, unknown>).message, 240);
    if (data.message) return cleanText(data.message, 240);
  } catch {
    /* plain text */
  }
  return cleanText(rawBody, 240) || fallback;
}

/** Single chat completion. Throws a descriptive Error on failure (never returns canned text). */
export async function callTextModel(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  options: TextGenOptions = {}
): Promise<string> {
  const cfg = normalizeProviderConfig(config);

  if (cfg.providerId === 'none') {
    throw new Error('Aucun provider IA configuré. Ajoute une clé OpenRouter dans les réglages.');
  }
  if (!cfg.apiKey) {
    throw new Error(`Clé API manquante pour ${getProviderDisplayName(cfg.providerId)}.`);
  }

  const timeoutMs = timeoutFor(cfg.model);
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.9
    // No max_tokens — capping it silently truncates verbose reasoning models.
  };
  const reasoning = reasoningPayload(cfg.reasoningEffort, options.skipReasoning === true, cfg.model);
  if (reasoning) body.reasoning = reasoning;
  if (options.jsonMode) body.response_format = { type: 'json_object' };

  let lastError: Error | null = null;
  let connectionFaults = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 500));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
          'X-Title': OPENROUTER_APP_TITLE
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (response.ok) {
        const content = extractContent(await response.json().catch(() => null));
        if (content) return content;
        lastError = new Error(`${getProviderDisplayName(cfg.providerId)} : réponse vide.`);
        break; // empty 200 is not transient
      }

      const message = parseError(await response.text().catch(() => ''), `HTTP ${response.status}`);
      lastError = new Error(`${getProviderDisplayName(cfg.providerId)} : ${message}`);
      logger.warn(`provider ${response.status}: ${message}`);
      if (!RETRYABLE_STATUS.has(response.status)) break;
    } catch (error) {
      clearTimeout(timer);
      const msg = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(msg));
      lastError = new Error(isTimeout ? `Délai dépassé après ${timeoutMs}ms` : `Échec réseau : ${msg}`);
      logger.warn(`provider network error: ${msg}`);
      // "Failed to fetch" = unreachable (CORS/DNS/offline). Tolerate one, then bail.
      if (/failed to fetch|networkerror|unable to make request/i.test(msg)) {
        connectionFaults += 1;
        if (connectionFaults > 1) break;
      }
    }
  }

  throw lastError || new Error('Impossible d\'obtenir une réponse du provider.');
}
