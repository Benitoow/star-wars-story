import { recordDiagnosticEvent } from '$lib/utils/logger';
import {
  AGENTIC_TOOL_CALLING_PROVIDER_IDS,
  DEFAULT_TEXT_MODELS,
  DEFAULT_TEXT_PROVIDER_ID,
  OPENAI_COMPATIBLE_BASE_URLS,
  getProviderDisplayName as getProviderDisplayNameFromConfig,
  normalizeTextProviderId
} from '$lib/config/providers';
import { assertSupportedStoryProviderConfig } from './contracts';
import type { ChatMessage, StoryProviderConfig } from './types';
import { cleanText } from './utils/shared';

function getProviderDisplayName(providerId: string): string {
  return getProviderDisplayNameFromConfig(providerId);
}

function ensureApiKey(providerId: string, apiKey?: string): void {
  if (providerId === 'ollama') return;
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) {
    throw new Error(`Clé API manquante pour ${getProviderDisplayName(providerId)}.`);
  }
}

function withTimeoutSignal(timeoutMs: number): { controller: AbortController; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cancel: () => clearTimeout(timer)
  };
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  if (name === 'AbortError') return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && /aborted a request|the operation was aborted|abort/i.test(message);
}

async function parseErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;

  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const nestedError = data.error;
    if (nestedError && typeof nestedError === 'object' && !Array.isArray(nestedError)) {
      const nestedMessage = (nestedError as Record<string, unknown>).message;
      if (nestedMessage) return cleanText(nestedMessage, 240);
    }
    if (data.message) return cleanText(data.message, 240);
  } catch {
    // plain text
  }

  return cleanText(raw, 240);
}

function resolveModel(config: StoryProviderConfig): string {
  const model = cleanText(config.model, 120);
  if (model) return model;
  return DEFAULT_TEXT_MODELS[config.providerId] || DEFAULT_TEXT_MODELS[DEFAULT_TEXT_PROVIDER_ID];
}

type ModelTier = 'small' | 'medium' | 'large';
type ReasoningStyle = 'openai-effort' | 'anthropic-thinking' | 'none';

export interface ModelCapabilities {
  tier: ModelTier;
  reasoningStyle: ReasoningStyle;
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'minimal' | 'none';
  supportsNativeTools: boolean;
  maxOutputTokens: number;
  idealTemperature: number;
}

const DEFAULT_CAPS: ModelCapabilities = {
  tier: 'small',
  reasoningStyle: 'none',
  reasoningEffort: 'low',
  supportsNativeTools: true,
  maxOutputTokens: 2000,
  idealTemperature: 0.9
};

const MODEL_CAPS_PATTERNS: Array<[RegExp, Partial<ModelCapabilities>]> = [
  [/gemini-3-flash-preview/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 0.9 }],
  [/gemini-2\.5-flash-lite/, { tier: 'small', reasoningStyle: 'none', supportsNativeTools: true, maxOutputTokens: 2600, idealTemperature: 0.85 }],
  [/gpt-oss-120b/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/deepseek-v3\.2/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/deepseek-v4-flash/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3200, idealTemperature: 0.9 }],
  [/kimi-k2\.6/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3500, idealTemperature: 0.9 }],
  [/mimo-v2-omni/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/mimo-v2-flash/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3200, idealTemperature: 0.9 }],
  [/minimax-m2\.7/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/qwen(3\.5|3\.6|.*plus)/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/grok-4\.20/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3600, idealTemperature: 0.9 }],
  [/grok-4\.1-fast/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3600, idealTemperature: 0.9 }],
  [/gemma-4-31b-it/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 0.95 }],
  [/gemma-4-26b-a4b-it/, { tier: 'small', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 2800, idealTemperature: 0.95 }],
  [/gemma-3-27b-it:free|gemma-3-27b-it/i, { tier: 'large', reasoningStyle: 'none', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 0.9 }],
  [/gemma-4/, { tier: 'small', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 2500, idealTemperature: 1.0 }],
  [/gpt-5\.4-mini/, { tier: 'small', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 1.0 }],
  [/gpt-5\.4/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3500, idealTemperature: 1.0 }],
  [/claude-opus-4/, { tier: 'large', reasoningStyle: 'anthropic-thinking', supportsNativeTools: true, maxOutputTokens: 4500, idealTemperature: 1.0 }],
  [/claude-sonnet-4/, { tier: 'medium', reasoningStyle: 'anthropic-thinking', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 1.0 }],
  [/\/o[1-9][-/]|\/o4-mini/, { tier: 'large', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 4000, idealTemperature: 1.0 }],
  [/grok-3-mini/, { tier: 'small', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 1.0 }],
  [/grok-3/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 1.0 }],
  [/mistral-(medium|large)/, { tier: 'medium', reasoningStyle: 'none', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 0.85 }],
  [/deepseek-r|qwen.*think/, { tier: 'medium', reasoningStyle: 'openai-effort', supportsNativeTools: true, maxOutputTokens: 2800, idealTemperature: 1.0 }]
];

export function detectModelCapabilities(config: StoryProviderConfig): ModelCapabilities {
  const modelId = resolveModel(config).toLowerCase();
  for (const [pattern, overrides] of MODEL_CAPS_PATTERNS) {
    if (pattern.test(modelId)) {
      return { ...DEFAULT_CAPS, ...overrides };
    }
  }
  return DEFAULT_CAPS;
}

function getOpenRouterProviderPreferences(modelId: string): Record<string, unknown> | undefined {
  const normalized = modelId.toLowerCase();

  if (/google\/gemini-3-flash-preview/.test(normalized)) {
    return { require_parameters: true, order: ['google-ai-studio', 'google-vertex'], preferred_max_latency: { p90: 2 }, preferred_min_throughput: { p90: 70 }, max_price: { prompt: 0.6, completion: 3.5 }, allow_fallbacks: true };
  }
  if (/google\/gemini-2\.5-flash-lite/.test(normalized)) {
    return { require_parameters: true, order: ['google-vertex', 'google-ai-studio'], preferred_max_latency: { p90: 1 }, preferred_min_throughput: { p90: 100 }, max_price: { prompt: 0.2, completion: 0.6 }, allow_fallbacks: true };
  }
  if (/openai\/gpt-oss-120b/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 2 }, preferred_min_throughput: { p90: 50 }, max_price: { prompt: 0.2, completion: 0.8 }, allow_fallbacks: true };
  }
  if (/deepseek\/deepseek-v3\.2/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 3 }, preferred_min_throughput: { p90: 20 }, max_price: { prompt: 0.45, completion: 1.8 }, allow_fallbacks: true };
  }
  if (/deepseek\/deepseek-v4-flash/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 2 }, preferred_min_throughput: { p90: 60 }, max_price: { prompt: 0.14, completion: 0.28 }, allow_fallbacks: true };
  }
  if (/moonshotai\/kimi-k2\.6/.test(normalized)) {
    return { require_parameters: true, sort: 'latency', preferred_max_latency: { p90: 2 }, preferred_min_throughput: { p90: 25 }, max_price: { prompt: 0.6, completion: 2.4 }, allow_fallbacks: true };
  }
  if (/xiaomi\/mimo-v2-omni/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 3 }, preferred_min_throughput: { p90: 45 }, allow_fallbacks: true };
  }
  if (/xiaomi\/mimo-v2-flash/.test(normalized)) {
    return {
      require_parameters: true,
      sort: 'latency',
      preferred_max_latency: { p90: 2, p99: 4.5 },
      preferred_min_throughput: { p90: 45, p99: 20 },
      max_price: { prompt: 0.12, completion: 0.45 },
      allow_fallbacks: true
    };
  }
  if (/x-ai\/grok-4\.1-fast/.test(normalized)) {
    return {
      require_parameters: true,
      sort: 'throughput',
      preferred_max_latency: { p90: 4, p99: 8 },
      preferred_min_throughput: { p90: 90, p99: 55 },
      allow_fallbacks: true
    };
  }
  if (/x-ai\/grok-4\.20/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 2 }, preferred_min_throughput: { p90: 90 }, max_price: { prompt: 4, completion: 12 }, allow_fallbacks: true };
  }
  if (/minimax\/minimax-m2\.7/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 3 }, preferred_min_throughput: { p90: 30 }, max_price: { prompt: 0.6, completion: 2.4 }, allow_fallbacks: true };
  }
  if (/qwen\/qwen3\.5-9b/.test(normalized)) {
    return { require_parameters: true, order: ['together', 'venice'], preferred_max_latency: { p90: 1 }, preferred_min_throughput: { p90: 20 }, allow_fallbacks: true };
  }
  if (/google\/gemma-4-26b-a4b-it/.test(normalized)) {
    return { require_parameters: true, sort: 'latency', preferred_max_latency: { p90: 2 }, preferred_min_throughput: { p90: 25 }, allow_fallbacks: true };
  }
  if (/google\/gemma-4-31b-it/.test(normalized)) {
    return { require_parameters: true, sort: 'latency', preferred_max_latency: { p90: 3 }, preferred_min_throughput: { p90: 12 }, allow_fallbacks: true };
  }

  return undefined;
}

function isOpenRouterGrokFastModel(modelId: string): boolean {
  return /x-ai\/grok-4\.1-fast/i.test(modelId);
}

function isOpenRouterMimoV2FlashModel(modelId: string): boolean {
  return /xiaomi\/mimo-v2-flash/i.test(modelId);
}

function buildReasoningPayload(
  caps: ModelCapabilities,
  providerId: string,
  modelId: string,
  skipReasoning = false,
  effortOverride?: string
): Record<string, unknown> | undefined {
  if (caps.reasoningStyle !== 'openai-effort') return undefined;

  if (skipReasoning || effortOverride === 'none') {
    if (providerId === 'openrouter') return { enabled: false };
    return { effort: 'none' };
  }

  if (providerId === 'openrouter' && isOpenRouterMimoV2FlashModel(modelId)) {
    return { enabled: true };
  }

  const effort = effortOverride ?? caps.reasoningEffort;

  if (providerId === 'openrouter') {
    return { enabled: true, effort };
  }

  return { effort };
}

type OpenAiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAiToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

type OpenAiResponseFormat = {
  type: 'json_object';
};

type OpenAiToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

type OpenAiReasoningDetail = Record<string, unknown>;

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  reasoning?: string;
  reasoning_content?: string;
  reasoning_details?: OpenAiReasoningDetail[];
};

export interface TextGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  skipReasoning?: boolean;
}

function toOpenAiMessageList(messages: ChatMessage[]): OpenAiMessage[] {
  return messages.map(message => ({ role: message.role, content: message.content }));
}

function getOpenAiCompatibleTimeoutMs(caps: ModelCapabilities): number {
  if (caps.tier === 'large') return 120000;
  if (caps.tier === 'medium') return 90000;
  return 75000;
}

export async function callOpenAiCompatibleRaw(
  messages: OpenAiMessage[],
  config: StoryProviderConfig,
  options: {
    tools?: OpenAiToolDefinition[];
    toolChoice?: OpenAiToolChoice;
    maxTokens?: number;
    temperature?: number;
    skipReasoning?: boolean;
    responseFormat?: OpenAiResponseFormat;
  } = {}
): Promise<OpenAiMessage> {
  const normalizedConfig = assertSupportedStoryProviderConfig(config);
  const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[normalizedConfig.providerId];
  if (!baseUrl) throw new Error(`Provider non supporté: ${normalizedConfig.providerId}`);

  ensureApiKey(normalizedConfig.providerId, normalizedConfig.apiKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${String(normalizedConfig.apiKey || '').trim()}`,
    'Content-Type': 'application/json'
  };

  if (normalizedConfig.providerId === 'openrouter') {
    const referer = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    headers['HTTP-Referer'] = referer;
    headers['X-OpenRouter-Title'] = 'Star Wars Story Manager';
    headers['X-Title'] = 'Star Wars Story Manager';
  }

  const caps = detectModelCapabilities(normalizedConfig);
  const modelId = resolveModel(normalizedConfig);
  const timeoutMs = getOpenAiCompatibleTimeoutMs(caps);
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: options.maxTokens ?? caps.maxOutputTokens,
    temperature: options.temperature ?? caps.idealTemperature
  };

  if (normalizedConfig.providerId === 'openrouter') {
    const providerPreferences = getOpenRouterProviderPreferences(modelId);
    if (providerPreferences) body.provider = providerPreferences;
  }

  const reasoningPayload = buildReasoningPayload(caps, normalizedConfig.providerId, modelId, options.skipReasoning === true, normalizedConfig.reasoningEffortOverride);
  if (reasoningPayload) {
    body.reasoning = reasoningPayload;
  }

  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? 'auto';
  }

  const { controller, cancel } = withTimeoutSignal(timeoutMs);

  try {
    recordDiagnosticEvent({
      level: 'info',
      category: 'provider-request',
      stage: 'openrouter-chat-completions',
      message: 'Appel provider texte.',
      providerId: normalizedConfig.providerId,
      model: modelId,
      validation: 'passed',
      meta: {
        messageCount: messages.length,
        maxTokens: body.max_tokens,
        temperature: body.temperature,
        reasoning: body.reasoning,
        hasTools: Array.isArray(options.tools) && options.tools.length > 0
      }
    });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      recordDiagnosticEvent({
        level: 'error',
        category: 'provider-response',
        stage: 'openrouter-chat-completions',
        message: 'Le provider texte a répondu en erreur.',
        providerId: normalizedConfig.providerId,
        model: modelId,
        validation: 'failed',
        meta: {
          status: response.status,
          providerMessage: message
        }
      });
      throw new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: ${message}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: OpenAiMessage }> };
    const message = data.choices?.[0]?.message;
    const hasContent = Boolean(cleanText(message?.content, 16000));
    const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;
    if (!message || (!hasContent && !hasToolCalls)) {
      recordDiagnosticEvent({
        level: 'error',
        category: 'provider-response',
        stage: 'openrouter-chat-completions',
        message: 'Réponse provider vide ou incomplète.',
        providerId: normalizedConfig.providerId,
        model: modelId,
        validation: 'failed',
        meta: data
      });
      throw new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: réponse vide ou incomplète du provider.`);
    }

    recordDiagnosticEvent({
      level: 'info',
      category: 'provider-response',
      stage: 'openrouter-chat-completions',
      message: 'Réponse provider validée.',
      providerId: normalizedConfig.providerId,
      model: modelId,
      validation: 'passed',
      meta: {
        hasContent,
        toolCalls: message.tool_calls?.length || 0,
        content: message.content || ''
      }
    });

    return {
      ...message,
      content: cleanText(message.content, 16000) || undefined
    };
  } catch (error) {
    if (isAbortError(error)) {
      recordDiagnosticEvent({
        level: 'error',
        category: 'provider-timeout',
        stage: 'openrouter-chat-completions',
        message: 'Le provider texte a dépassé le délai.',
        providerId: normalizedConfig.providerId,
        model: modelId,
        validation: 'failed',
        meta: { timeoutMs }
      });
    }
    throw error;
  } finally {
    cancel();
  }
}

async function callOpenAiCompatible(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  options: TextGenerationOptions = {}
): Promise<string> {
  const message = await callOpenAiCompatibleRaw(toOpenAiMessageList(messages), config, options);
  return cleanText(message.content, 12000);
}

export async function callTextModel(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  options: TextGenerationOptions = {}
): Promise<string> {
  const normalizedConfig = assertSupportedStoryProviderConfig(config);
  return callOpenAiCompatible(messages, normalizedConfig, options);
}

export function supportsAgenticToolCalling(providerId: string | undefined, model?: string): boolean {
  const normalized = normalizeProviderId(providerId);
  if (!AGENTIC_TOOL_CALLING_PROVIDER_IDS.has(normalized)) return false;
  if (!model) return true;
  const caps = detectModelCapabilities({ providerId: normalized, model });
  return caps.supportsNativeTools;
}

export function normalizeProviderId(rawProviderId: string | undefined): string {
  return normalizeTextProviderId(rawProviderId);
}
