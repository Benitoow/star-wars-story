/* ═══════════════════════════════════════════════
   Text transport — multi-provider (OpenRouter + MiMo).
   Each provider is OpenAI-compatible at the transport
   level; the only divergence is reasoning:
     OpenRouter → { reasoning: { effort } }
     MiMo       → { thinking:  { type: 'enabled'|'disabled' } }
   No max_tokens ceiling (the provider decides).
══════════════════════════════════════════════ */
import {
  DEFAULT_TEXT_MODEL_ID,
  buildAuthHeaders,
  getProviderBaseUrl,
  getProviderDisplayName,
  normalizeTextProviderId
} from '$lib/content/providers';
import { logger, recordDiag } from '$lib/logger';
import { extractUsage, formatUsage } from './usage';
import { supportsReasoningParam } from './models';
import { cleanText } from './text';
import type { ChatMessage, StoryProviderConfig } from './types';

export interface TextGenOptions {
  temperature?: number;
  jsonMode?: boolean;
  skipReasoning?: boolean;
  signal?: AbortSignal;
  label?: string; // names this call in the diagnostics export
}

export interface StreamOptions {
  temperature?: number;
  jsonMode?: boolean;
  skipReasoning?: boolean;
  signal?: AbortSignal;
  label?: string; // names this call in the diagnostics export
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

const REQUEST_TIMEOUT_MS = 120000;

// ── reasoning / thinking adapter ───────────────────────

/** MiMo uses `thinking: { type }` instead of OpenRouter's `reasoning: { effort }`. */
function buildThinkingParam(
  reasoning: { effort: string } | undefined,
  providerId: string
): Record<string, unknown> | undefined {
  if (!reasoning) return undefined;
  if (providerId === 'mimo') {
    // MiMo: effort 'none' → disabled, anything else → enabled
    const enabled = reasoning.effort !== 'none';
    return { thinking: { type: enabled ? 'enabled' : 'disabled' } };
  }
  // OpenRouter: pass through as-is
  return { reasoning };
}

/**
 * Resolve reasoning parameter, driven by model capabilities (OpenRouter
 * /models -> supported_parameters). MiMo always supports thinking.
 */
async function resolveReasoning(
  cfg: ReturnType<typeof normalizeProviderConfig>,
  skip: boolean
): Promise<{ effort: string } | undefined> {
  if (!skip && (!cfg.reasoningEffort || cfg.reasoningEffort === 'auto')) return undefined;
  // MiMo always supports thinking — no catalog check needed
  if (cfg.providerId === 'mimo') {
    return skip ? { effort: 'none' } : { effort: cfg.reasoningEffort };
  }
  const supports = await supportsReasoningParam(cfg);
  if (skip) return supports === true ? { effort: 'none' } : undefined;
  return supports === false ? undefined : { effort: cfg.reasoningEffort };
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || !choices.length) return '';
  const message = (choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
  return cleanText(message?.content, 16000);
}

/** Log what a call consumed — notably how much of the prompt hit the cache. */
function reportUsage(payload: unknown, model: string, label?: string): void {
  const usage = extractUsage(payload);
  if (usage) recordDiag(formatUsage(usage, label ?? 'appel', model), usage);
}

function parseError(rawBody: string, fallback: string): string {
  try {
    const data = JSON.parse(rawBody) as Record<string, unknown>;
    const nested = data.error;
    if (nested && typeof nested === 'object' && 'message' in nested) return cleanText((nested as Record<string, unknown>).message, 240);
    if (data.message) return cleanText(data.message, 240);
  } catch { /* plain text */ }
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
    throw new Error('Aucun provider IA configuré. Ajoute une clé API dans les réglages.');
  }
  if (!cfg.apiKey) {
    throw new Error(`Clé API manquante pour ${getProviderDisplayName(cfg.providerId)}.`);
  }

  const baseUrl = getProviderBaseUrl(cfg.providerId);
  const headers = buildAuthHeaders(cfg.providerId, cfg.apiKey);
  const timeoutMs = REQUEST_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.9
  };
  const reasoning = await resolveReasoning(cfg, options.skipReasoning === true);
  const thinkingParam = buildThinkingParam(reasoning, cfg.providerId);
  if (thinkingParam) Object.assign(body, thinkingParam);
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
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null);
        const content = extractContent(payload);
        if (content) {
          reportUsage(payload, cfg.model, options.label);
          return content;
        }
        lastError = new Error(`${getProviderDisplayName(cfg.providerId)} : réponse vide.`);
        break;
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

function requestHeaders(providerId: string, apiKey: string): Record<string, string> {
  return buildAuthHeaders(providerId, apiKey);
}

/** Streaming chat completion (SSE). */
export async function callTextModelStream(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  onToken: (delta: string) => void,
  options: StreamOptions = {}
): Promise<string> {
  const cfg = normalizeProviderConfig(config);
  if (cfg.providerId === 'none') {
    throw new Error('Aucun provider IA configuré. Ajoute une clé API dans les réglages.');
  }
  if (!cfg.apiKey) {
    throw new Error(`Clé API manquante pour ${getProviderDisplayName(cfg.providerId)}.`);
  }

  const baseUrl = getProviderBaseUrl(cfg.providerId);
  const headers = requestHeaders(cfg.providerId, cfg.apiKey);

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.9,
    stream: true
  };
  const reasoning = await resolveReasoning(cfg, options.skipReasoning === true);
  const thinkingParam = buildThinkingParam(reasoning, cfg.providerId);
  if (thinkingParam) Object.assign(body, thinkingParam);
  if (options.jsonMode) body.response_format = { type: 'json_object' };

  const timeoutMs = REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let full = '';
  let usagePayload: unknown = null;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
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
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; usage?: unknown };
          if (json.usage) usagePayload = json; // the closing frame carries the accounting
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            full += delta;
            onToken(delta);
          }
        } catch { /* keep-alive or partial frame */ }
      }
    }
    clearTimeout(timer);
    reportUsage(usagePayload, cfg.model, options.label);
    return cleanText(full, 16000);
  } catch (error) {
    clearTimeout(timer);
    const msg = error instanceof Error ? error.message : String(error);
    if (options.signal?.aborted) return cleanText(full, 16000);
    logger.warn(`provider stream error: ${msg}`);
    throw error instanceof Error ? error : new Error(msg);
  }
}
