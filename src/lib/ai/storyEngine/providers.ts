import { logger } from '$lib/utils/logger';
import {
  AGENTIC_TOOL_CALLING_PROVIDER_IDS,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TEXT_MODELS,
  DEFAULT_TEXT_PROVIDER_ID,
  OPENAI_COMPATIBLE_BASE_URLS,
  getProviderDisplayName as getProviderDisplayNameFromConfig,
  normalizeTextProviderId
} from '$lib/config/providers';
import type { ChatMessage, StoryProviderConfig } from './types';
import { parseJsonSafely } from './parsing';

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

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
  reasoningEffort: 'low' | 'medium' | 'high';
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
  [/gemini-3-flash-preview/, { tier: 'medium', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 0.9 }],
  [/gemini-2\.5-flash-lite/, { tier: 'small', reasoningStyle: 'none', reasoningEffort: 'low', supportsNativeTools: true, maxOutputTokens: 2600, idealTemperature: 0.85 }],
  [/gpt-oss-120b/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/deepseek-v3\.2/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/mimo-v2-omni/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/mimo-v2-flash/, { tier: 'medium', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2800, idealTemperature: 0.95 }],
  [/minimax-m2\.7/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3400, idealTemperature: 0.9 }],
  [/qwen3\.5-9b/, { tier: 'small', reasoningStyle: 'openai-effort', reasoningEffort: 'low', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 0.9 }],
  [/grok-4\.20/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3600, idealTemperature: 0.9 }],
  [/grok-4\.1-fast/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3200, idealTemperature: 0.95 }],
  [/gemma-4-31b-it/, { tier: 'medium', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 0.95 }],
  [/gemma-4-26b-a4b-it/, { tier: 'small', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2800, idealTemperature: 0.95 }],
  [/gemma-3-27b-it:free|gemma-3-27b-it/i, { tier: 'large', reasoningStyle: 'none', reasoningEffort: 'low', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 0.9 }],
  [/gemma-4/, { tier: 'small', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2500, idealTemperature: 1.0 }],
  [/gpt-5\.4-mini/, { tier: 'small', reasoningStyle: 'openai-effort', reasoningEffort: 'low', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 1.0 }],
  [/gpt-5\.4/, { tier: 'medium', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3500, idealTemperature: 1.0 }],
  [/claude-opus-4/, { tier: 'large', reasoningStyle: 'anthropic-thinking', reasoningEffort: 'high', supportsNativeTools: true, maxOutputTokens: 4500, idealTemperature: 1.0 }],
  [/claude-sonnet-4/, { tier: 'medium', reasoningStyle: 'anthropic-thinking', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 1.0 }],
  [/\/o[1-9][-/]|\/o4-mini/, { tier: 'large', reasoningStyle: 'openai-effort', reasoningEffort: 'high', supportsNativeTools: true, maxOutputTokens: 4000, idealTemperature: 1.0 }],
  [/grok-3-mini/, { tier: 'small', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 1.0 }],
  [/grok-3/, { tier: 'medium', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 1.0 }],
  [/mistral-(medium|large)/, { tier: 'medium', reasoningStyle: 'none', reasoningEffort: 'low', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 0.85 }],
  [/deepseek-r|qwen.*think/, { tier: 'medium', reasoningStyle: 'openai-effort', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2800, idealTemperature: 1.0 }]
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
  if (/xiaomi\/mimo-v2-omni/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 3 }, preferred_min_throughput: { p90: 45 }, allow_fallbacks: true };
  }
  if (/xiaomi\/mimo-v2-flash/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 3 }, preferred_min_throughput: { p90: 40 }, allow_fallbacks: true };
  }
  if (/x-ai\/grok-4\.1-fast/.test(normalized)) {
    return { require_parameters: true, sort: 'throughput', preferred_max_latency: { p90: 10 }, preferred_min_throughput: { p90: 80 }, allow_fallbacks: true };
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

type OpenAiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAiToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

type OpenAiToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
};

function toOpenAiMessageList(messages: ChatMessage[]): OpenAiMessage[] {
  return messages.map(message => ({ role: message.role, content: message.content }));
}

function getOpenAiCompatibleTimeoutMs(caps: ModelCapabilities): number {
  if (caps.tier === 'large') return 90000;
  if (caps.tier === 'medium') return 65000;
  return 50000;
}

export async function callOpenAiCompatibleRaw(
  messages: OpenAiMessage[],
  config: StoryProviderConfig,
  options: { tools?: OpenAiToolDefinition[]; toolChoice?: OpenAiToolChoice; maxTokens?: number; temperature?: number; skipReasoning?: boolean } = {}
): Promise<OpenAiMessage> {
  const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[config.providerId];
  if (!baseUrl) throw new Error(`Provider non supporté: ${config.providerId}`);

  ensureApiKey(config.providerId, config.apiKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${String(config.apiKey || '').trim()}`,
    'Content-Type': 'application/json'
  };

  if (config.providerId === 'openrouter') {
    const referer = typeof window !== 'undefined' ? window.location.href : 'https://localhost';
    headers['HTTP-Referer'] = referer;
    headers['X-Title'] = 'Star Wars Story Manager';
  }

  const caps = detectModelCapabilities(config);
  const modelId = resolveModel(config);
  const timeoutMs = getOpenAiCompatibleTimeoutMs(caps);
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: options.maxTokens ?? caps.maxOutputTokens,
    temperature: options.temperature ?? caps.idealTemperature
  };

  if (config.providerId === 'openrouter') {
    const providerPreferences = getOpenRouterProviderPreferences(modelId);
    if (providerPreferences) body.provider = providerPreferences;
  }

  if (caps.reasoningStyle === 'openai-effort' && !options.skipReasoning) {
    body.reasoning = { effort: caps.reasoningEffort };
  }

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? 'auto';
  }

  const { controller, cancel } = withTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(`${getProviderDisplayName(config.providerId)}: ${message}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: OpenAiMessage }> };
    return data.choices?.[0]?.message ?? { role: 'assistant', content: '' };
  } finally {
    cancel();
  }
}

async function callOpenAiCompatible(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  const message = await callOpenAiCompatibleRaw(toOpenAiMessageList(messages), config);
  return cleanText(message.content, 12000);
}

async function callAnthropic(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  ensureApiKey(config.providerId, config.apiKey);

  const systemMessage = messages.find(message => message.role === 'system');
  const conversation = messages.filter(message => message.role !== 'system').map(message => ({ role: message.role, content: message.content }));
  const caps = detectModelCapabilities(config);
  const body: Record<string, unknown> = { model: resolveModel(config), max_tokens: caps.maxOutputTokens, messages: conversation };

  if (caps.reasoningStyle === 'anthropic-thinking') {
    const thinkingBudget = caps.tier === 'large' ? 8000 : 5000;
    body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
    body.temperature = 1;
  } else {
    body.temperature = caps.idealTemperature;
  }

  if (systemMessage?.content) body.system = systemMessage.content;

  const { controller, cancel } = withTimeoutSignal(50000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': String(config.apiKey || '').trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(`Anthropic: ${message}`);
    }

    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    const textBlock = data.content?.find(b => b.type === 'text');
    return textBlock?.text || data.content?.[0]?.text || '';
  } finally {
    cancel();
  }
}

async function callOllama(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  const baseUrl = cleanText(config.ollamaUrl, 200) || DEFAULT_OLLAMA_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  const body = { model: resolveModel(config), messages, stream: false, options: { temperature: 0.9 } };
  const { controller, cancel } = withTimeoutSignal(50000);

  try {
    const response = await fetch(`${normalizedBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(`Ollama: ${message}`);
    }

    const data = await response.json() as { message?: { content?: string }; response?: string };
    return data.message?.content || data.response || '';
  } finally {
    cancel();
  }
}

export async function callTextModel(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  const providerId = normalizeProviderId(config.providerId);
  const normalizedConfig = providerId === config.providerId ? config : { ...config, providerId };

  if (!providerId || providerId === 'none') {
    throw new Error('Aucun provider texte sélectionné.');
  }

  if (providerId === 'anthropic') return callAnthropic(messages, normalizedConfig);
  if (providerId === 'ollama') return callOllama(messages, normalizedConfig);
  return callOpenAiCompatible(messages, normalizedConfig);
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
