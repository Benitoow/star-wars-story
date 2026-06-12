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
  signal?: AbortSignal;     // external cancel — aborts the request and stops retrying
}

export interface StreamOptions {
  temperature?: number;
  skipReasoning?: boolean;
  signal?: AbortSignal;     // external cancel (e.g. the user closes the chat)
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
    if (options.signal?.aborted) {
      lastError = new Error('Génération annulée.');
      break;
    }
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 500));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
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
      if (options.signal?.aborted) {
        lastError = new Error('Génération annulée.');
        break;
      }
      const msg = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(msg));
      lastError = new Error(isTimeout ? `Délai dépassé après ${timeoutMs}ms` : `Échec réseau : ${msg}`);
      logger.warn(`provider network error: ${msg}`);
      // "Failed to fetch" = unreachable (CORS/DNS/offline). Tolerate one, then bail.
      if (/failed to fetch|networkerror|unable to make request/i.test(msg)) {
        connectionFaults += 1;
        if (connectionFaults > 1) break;
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw lastError || new Error('Impossible d\'obtenir une réponse du provider.');
}

function requestHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
    'X-Title': OPENROUTER_APP_TITLE
  };
}

/**
 * Streaming chat completion (SSE). Invokes onToken(delta) as text arrives and
 * resolves with the full text. Single attempt (no retry — the caller can resend).
 * If aborted via options.signal, resolves with the partial text gathered so far.
 */
export async function callTextModelStream(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  onToken: (delta: string) => void,
  options: StreamOptions = {}
): Promise<string> {
  const cfg = normalizeProviderConfig(config);
  if (cfg.providerId === 'none') {
    throw new Error('Aucun provider IA configuré. Ajoute une clé OpenRouter dans les réglages.');
  }
  if (!cfg.apiKey) {
    throw new Error(`Clé API manquante pour ${getProviderDisplayName(cfg.providerId)}.`);
  }

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.9,
    stream: true
  };
  const reasoning = reasoningPayload(cfg.reasoningEffort, options.skipReasoning === true, cfg.model);
  if (reasoning) body.reasoning = reasoning;

  const timeoutMs = timeoutFor(cfg.model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let full = '';
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: requestHeaders(cfg.apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = parseError(await response.text().catch(() => ''), `HTTP ${response.status}`);
      throw new Error(`${getProviderDisplayName(cfg.providerId)} : ${message}`);
    }
    if (!response.body) throw new Error('Réponse sans flux (streaming indisponible).');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep the last (possibly incomplete) line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            full += delta;
            onToken(delta);
          }
        } catch {
          /* keep-alive or partial frame — ignore */
        }
      }
    }
    clearTimeout(timer);
    return cleanText(full, 16000);
  } catch (error) {
    clearTimeout(timer);
    const msg = error instanceof Error ? error.message : String(error);
    // User-initiated cancel → return whatever we already streamed.
    if (options.signal?.aborted) return cleanText(full, 16000);
    logger.warn(`provider stream error: ${msg}`);
    throw error instanceof Error ? error : new Error(msg);
  }
}
