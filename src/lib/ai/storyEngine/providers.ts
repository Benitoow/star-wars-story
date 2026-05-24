import { recordDiagnosticEvent } from '$lib/utils/logger';
import { OpenRouterCore } from '@openrouter/sdk/core.js';
import { chatSend } from '@openrouter/sdk/funcs/chatSend.js';
import { HTTPClient } from '@openrouter/sdk/lib/http.js';
import type { ChatMessages } from '@openrouter/sdk/models/chatmessages.js';
import type { ChatRequest, Reasoning, ResponseFormat } from '@openrouter/sdk/models/chatrequest.js';
import type { ProviderPreferences } from '@openrouter/sdk/models/providerpreferences.js';
import { ConnectionError, RequestAbortedError, RequestTimeoutError } from '@openrouter/sdk/models/errors/httpclienterrors.js';
import { OpenRouterError } from '@openrouter/sdk/models/errors/openroutererror.js';
import type { SendChatCompletionRequestRequest } from '@openrouter/sdk/models/operations/sendchatcompletionrequest.js';
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

const OPENROUTER_APP_TITLE = 'Star Wars Story Manager';

function getOpenRouterReferer(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
}

function createOpenRouterClient(apiKey: string, rawResponseBodies: WeakMap<Response, string>): OpenRouterCore {
  return new OpenRouterCore({
    apiKey,
    retryConfig: { strategy: 'none' },
    httpClient: new HTTPClient({
      fetcher: async (input, init) => {
        const response = init == null ? await fetch(input) : await fetch(input, init);
        const bodyText = await response.clone().text().catch(() => '');
        rawResponseBodies.set(response, bodyText);
        return response;
      }
    })
  });
}

function normalizeOpenRouterContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          if (typeof record.text === 'string') return record.text;
          if (typeof record.content === 'string') return record.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
  }

  return '';
}

function normalizeOpenRouterToolCalls(toolCalls: unknown): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | undefined {
  if (!Array.isArray(toolCalls)) return undefined;

  const normalized = toolCalls.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = cleanText(record.id, 120);
    const functionRecord = record.function && typeof record.function === 'object' ? record.function as Record<string, unknown> : null;
    const name = cleanText(functionRecord?.name, 120);
    const args = cleanText(functionRecord?.arguments, 4000);
    if (!id || !name) return [];
    return [{ id, type: 'function' as const, function: { name, arguments: args } }];
  });

  return normalized.length ? normalized : undefined;
}

function toOpenRouterChatMessages(messages: OpenAiMessage[]): ChatMessages[] {
  const normalized: ChatMessages[] = [];

  for (const message of messages) {
    const content = normalizeOpenRouterContent(message.content);

    if (message.role === 'assistant') {
      normalized.push({
        role: 'assistant',
        content,
        name: message.name,
        reasoning: message.reasoning || message.reasoning_content,
        toolCalls: normalizeOpenRouterToolCalls(message.tool_calls)
      });
      continue;
    }

    if (message.role === 'tool') {
      normalized.push({
        role: 'tool',
        content: content || '',
        toolCallId: cleanText(message.tool_call_id, 120)
      });
      continue;
    }

    normalized.push({
      role: message.role,
      content
    });
  }

  return normalized;
}

function serializeMessagesForDiagnostics(messages: OpenAiMessage[]): string[] {
  return messages.map((message, index) => {
    const content = cleanText(normalizeOpenRouterContent(message.content), 4000);
    const prefix = `${index + 1}. ${message.role}`;
    return content ? `${prefix}: ${content}` : `${prefix}: <vide>`;
  });
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableSdkError(error: unknown): boolean {
  if (error instanceof RequestTimeoutError || error instanceof RequestAbortedError || error instanceof ConnectionError) {
    return true;
  }

  if (error instanceof OpenRouterError) {
    return isRetryableHttpStatus(error.statusCode);
  }

  if (error && typeof error === 'object') {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number' && isRetryableHttpStatus(statusCode)) return true;
    const message = String((error as { message?: unknown }).message || '');
    if (/timeout|network|fetch failed|failed to fetch|aborted/i.test(message)) return true;
  }

  return false;
}

function parseOpenRouterErrorMessage(rawBody: string, fallbackMessage = 'Réponse provider vide ou incomplète.'): string {
  const raw = cleanText(rawBody, 2400);
  if (!raw) return fallbackMessage;

  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const nestedError = data.error;
    if (nestedError && typeof nestedError === 'object' && !Array.isArray(nestedError)) {
      const nestedMessage = (nestedError as Record<string, unknown>).message;
      if (nestedMessage) return cleanText(nestedMessage, 240);
    }
    if (data.message) return cleanText(data.message, 240);
  } catch {
    // plain text fallback
  }

  return cleanText(raw, 240) || fallbackMessage;
}

function describeSdkError(error: unknown): Record<string, unknown> {
  if (error instanceof OpenRouterError) {
    return {
      name: error.name,
      statusCode: error.statusCode,
      message: cleanText(error.message, 240),
      contentType: error.contentType,
      body: cleanText(error.body, 2400),
      openrouterMetadata: (error as { openrouterMetadata?: unknown }).openrouterMetadata,
      userId: (error as { userId?: unknown }).userId
    };
  }

  if (error instanceof RequestTimeoutError || error instanceof RequestAbortedError || error instanceof ConnectionError) {
    return {
      name: error.name,
      message: cleanText(error.message, 240),
      cause: (error as { cause?: unknown }).cause ? cleanText(String((error as { cause?: unknown }).cause), 240) : undefined
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: cleanText(error.message, 240),
      stack: error.stack
    };
  }

  return { value: cleanText(String(error), 240) };
}

async function readJsonResponseBody(response: Response): Promise<Record<string, unknown> | null> {
  const raw = await response.clone().text().catch(() => '');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function parseJsonText(raw: string): Record<string, unknown> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function extractAssistantMessage(payload: unknown): OpenAiMessage | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object' || Array.isArray(firstChoice)) return null;
  const choiceRecord = firstChoice as Record<string, unknown>;
  const message = choiceRecord.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;

  const messageRecord = message as Record<string, unknown>;
  const role = cleanText(messageRecord.role, 40) || 'assistant';
  const content = normalizeOpenRouterContent(messageRecord.content ?? messageRecord.text);
  const toolCalls = normalizeOpenRouterToolCalls(messageRecord.toolCalls ?? messageRecord.tool_calls);
  const reasoning = cleanText(messageRecord.reasoning, 12000) || cleanText(messageRecord.reasoning_content, 12000);

  return {
    role: role as 'assistant',
    content: content || undefined,
    name: cleanText(messageRecord.name, 120) || undefined,
    tool_calls: toolCalls,
    reasoning: reasoning || undefined,
    reasoning_content: reasoning || undefined,
    reasoning_details: Array.isArray(messageRecord.reasoningDetails)
      ? messageRecord.reasoningDetails as OpenAiMessage['reasoning_details']
      : Array.isArray(messageRecord.reasoning_details)
        ? messageRecord.reasoning_details as OpenAiMessage['reasoning_details']
        : undefined
  };
}

function extractResponseMeta(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    id: record.id,
    object: record.object,
    created: record.created,
    model: record.model,
    serviceTier: record.serviceTier ?? record.service_tier,
    systemFingerprint: record.systemFingerprint ?? record.system_fingerprint,
    usage: record.usage,
    openrouterMetadata: record.openrouterMetadata ?? record.openrouter_metadata,
    choices: Array.isArray(record.choices)
      ? record.choices.map(choice => {
          if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return choice;
          const choiceRecord = choice as Record<string, unknown>;
          const messageRecord = choiceRecord.message && typeof choiceRecord.message === 'object' && !Array.isArray(choiceRecord.message)
            ? choiceRecord.message as Record<string, unknown>
            : null;

          return {
            index: choiceRecord.index,
            finishReason: choiceRecord.finishReason ?? choiceRecord.finish_reason,
            nativeFinishReason: choiceRecord.nativeFinishReason ?? choiceRecord.native_finish_reason,
            message: messageRecord ? {
              role: messageRecord.role,
              content: normalizeOpenRouterContent(messageRecord.content),
              toolCalls: normalizeOpenRouterToolCalls(messageRecord.toolCalls ?? messageRecord.tool_calls)
            } : undefined
          };
        })
      : undefined
  };
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

function getOpenRouterProviderPreferences(modelId: string): ProviderPreferences | undefined {
  const normalized = modelId.toLowerCase();

  if (/google\/gemini-3-flash-preview/.test(normalized)) {
    return { requireParameters: true, order: ['google-ai-studio', 'google-vertex'], preferredMaxLatency: { p90: 2 }, preferredMinThroughput: { p90: 70 }, maxPrice: { prompt: '0.6', completion: '3.5' }, allowFallbacks: true };
  }
  if (/google\/gemini-2\.5-flash-lite/.test(normalized)) {
    return { requireParameters: true, order: ['google-vertex', 'google-ai-studio'], preferredMaxLatency: { p90: 1 }, preferredMinThroughput: { p90: 100 }, maxPrice: { prompt: '0.2', completion: '0.6' }, allowFallbacks: true };
  }
  if (/openai\/gpt-oss-120b/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 2 }, preferredMinThroughput: { p90: 50 }, maxPrice: { prompt: '0.2', completion: '0.8' }, allowFallbacks: true };
  }
  if (/deepseek\/deepseek-v3\.2/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 3 }, preferredMinThroughput: { p90: 20 }, maxPrice: { prompt: '0.45', completion: '1.8' }, allowFallbacks: true };
  }
  if (/deepseek\/deepseek-v4-flash/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 2 }, preferredMinThroughput: { p90: 60 }, maxPrice: { prompt: '0.14', completion: '0.28' }, allowFallbacks: true };
  }
  if (/moonshotai\/kimi-k2\.6/.test(normalized)) {
    return { requireParameters: true, sort: 'latency', preferredMaxLatency: { p90: 2 }, preferredMinThroughput: { p90: 25 }, maxPrice: { prompt: '0.6', completion: '2.4' }, allowFallbacks: true };
  }
  if (/xiaomi\/mimo-v2-omni/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 3 }, preferredMinThroughput: { p90: 45 }, allowFallbacks: true };
  }
  if (/xiaomi\/mimo-v2-flash/.test(normalized)) {
    return {
      requireParameters: true,
      sort: 'latency',
      preferredMaxLatency: { p90: 2, p99: 4.5 },
      preferredMinThroughput: { p90: 45, p99: 20 },
      maxPrice: { prompt: '0.12', completion: '0.45' },
      allowFallbacks: true
    };
  }
  if (/x-ai\/grok-4\.1-fast/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 4, p99: 8 }, preferredMinThroughput: { p90: 90, p99: 55 }, allowFallbacks: true };
  }
  if (/x-ai\/grok-4\.20/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 2 }, preferredMinThroughput: { p90: 90 }, maxPrice: { prompt: '4', completion: '12' }, allowFallbacks: true };
  }
  if (/minimax\/minimax-m2\.7/.test(normalized)) {
    return { requireParameters: true, sort: 'throughput', preferredMaxLatency: { p90: 3 }, preferredMinThroughput: { p90: 30 }, maxPrice: { prompt: '0.6', completion: '2.4' }, allowFallbacks: true };
  }
  if (/qwen\/qwen3\.5-9b/.test(normalized)) {
    return { requireParameters: true, order: ['together', 'venice'], preferredMaxLatency: { p90: 1 }, preferredMinThroughput: { p90: 20 }, allowFallbacks: true };
  }
  if (/google\/gemma-4-26b-a4b-it/.test(normalized)) {
    return { requireParameters: true, sort: 'latency', preferredMaxLatency: { p90: 2 }, preferredMinThroughput: { p90: 25 }, allowFallbacks: true };
  }
  if (/google\/gemma-4-31b-it/.test(normalized)) {
    return { requireParameters: true, sort: 'latency', preferredMaxLatency: { p90: 3 }, preferredMinThroughput: { p90: 12 }, allowFallbacks: true };
  }

  return undefined;
}

function isOpenRouterMimoV2FlashModel(modelId: string): boolean {
  return /xiaomi\/mimo-v2-flash/i.test(modelId);
}

function buildReasoningPayload(
  caps: ModelCapabilities,
  skipReasoning = false,
  effortOverride?: string
): Reasoning | undefined {
  if (caps.reasoningStyle !== 'openai-effort') return undefined;

  const effort = skipReasoning || effortOverride === 'none'
    ? 'none'
    : (effortOverride ?? caps.reasoningEffort);

  return { effort: effort as Reasoning['effort'] };
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
    responseFormat?: ResponseFormat;
  } = {}
): Promise<OpenAiMessage> {
  const normalizedConfig = assertSupportedStoryProviderConfig(config);
  const caps = detectModelCapabilities(normalizedConfig);
  const modelId = resolveModel(normalizedConfig);
  const timeoutMs = getOpenAiCompatibleTimeoutMs(caps);
  const isOpenRouterProvider = normalizedConfig.providerId === 'openrouter';
  const reasoningPayload = buildReasoningPayload(caps, options.skipReasoning === true, normalizedConfig.reasoningEffortOverride);
  const providerPreferences = isOpenRouterProvider ? getOpenRouterProviderPreferences(modelId) : undefined;
  const messagesForDiagnostics = serializeMessagesForDiagnostics(messages);
  const maxRetries = 3;
  let attempt = 0;
  let lastError: Error | null = null;

  if (isOpenRouterProvider) {
    ensureApiKey(normalizedConfig.providerId, normalizedConfig.apiKey);

    const rawResponseBodies = new WeakMap<Response, string>();
    const client = createOpenRouterClient(String(normalizedConfig.apiKey || '').trim(), rawResponseBodies);
    const chatRequest: ChatRequest = {
      model: modelId,
      messages: toOpenRouterChatMessages(messages),
      maxCompletionTokens: options.maxTokens ?? caps.maxOutputTokens,
      temperature: options.temperature ?? caps.idealTemperature,
      provider: providerPreferences,
      reasoning: reasoningPayload,
      responseFormat: options.responseFormat,
      tools: options.tools,
      toolChoice: options.tools?.length ? options.toolChoice ?? 'auto' : undefined,
      stream: false
    };

    const request: SendChatCompletionRequestRequest = {
      httpReferer: getOpenRouterReferer(),
      appTitle: OPENROUTER_APP_TITLE,
      xOpenRouterExperimentalMetadata: 'enabled',
      chatRequest
    };

    while (attempt <= maxRetries) {
      if (attempt > 0) {
        const delay = attempt * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        recordDiagnosticEvent({
          level: 'warn',
          category: 'provider-retry',
          stage: 'openrouter-chat-completions',
          message: `Nouvelle tentative d'appel API (essai ${attempt}/${maxRetries}).`,
          providerId: normalizedConfig.providerId,
          model: modelId,
          validation: 'repaired',
          meta: {
            transport: 'openrouter-sdk',
            sdkStatus: 'retry',
            timeoutMs
          }
        });
      }

      try {
        if (attempt === 0) {
          recordDiagnosticEvent({
            level: 'info',
            category: 'provider-request',
            stage: 'openrouter-chat-completions',
            message: 'Appel provider texte via OpenRouter SDK.',
            providerId: normalizedConfig.providerId,
            model: modelId,
            validation: 'passed',
            meta: {
              transport: 'openrouter-sdk',
              messageCount: messages.length,
              messages: messagesForDiagnostics,
              maxCompletionTokens: chatRequest.maxCompletionTokens,
              temperature: chatRequest.temperature,
              reasoning: chatRequest.reasoning,
              providerPreferences,
              responseFormat: chatRequest.responseFormat,
              hasTools: Array.isArray(options.tools) && options.tools.length > 0,
              toolChoice: chatRequest.toolChoice,
              timeoutMs,
              referer: getOpenRouterReferer(),
              experimentalMetadata: 'enabled'
            }
          });
        }

        const [sdkResult, apiCall] = await chatSend(client, request, { timeoutMs }).$inspect();
        const apiStatus = apiCall?.status;

        if (!apiStatus) {
          lastError = new Error(`Requête OpenRouter SDK invalide.`);
          recordDiagnosticEvent({
            level: 'error',
            category: 'provider-response-error',
            stage: 'openrouter-chat-completions',
            message: 'Le SDK OpenRouter n’a pas renvoyé de statut exploitable.',
            providerId: normalizedConfig.providerId,
            model: modelId,
            validation: 'failed',
            meta: {
              transport: 'openrouter-sdk',
              sdkStatus: 'missing'
            }
          });
          break;
        }

        if (apiStatus === 'invalid') {
          lastError = new Error(`Requête OpenRouter SDK invalide.`);
          recordDiagnosticEvent({
            level: 'error',
            category: 'provider-response-error',
            stage: 'openrouter-chat-completions',
            message: 'Le SDK OpenRouter a rejeté la requête.',
            providerId: normalizedConfig.providerId,
            model: modelId,
            validation: 'failed',
            meta: {
              transport: 'openrouter-sdk',
              sdkStatus: apiStatus,
              sdkError: sdkResult.ok ? undefined : describeSdkError(sdkResult.error)
            }
          });
          break;
        }

        if (apiStatus === 'request-error') {
          const sdkError = sdkResult.ok ? null : sdkResult.error;
          const sdkDescription = sdkError ? describeSdkError(sdkError) : undefined;
          const isTimeout = sdkError instanceof RequestTimeoutError || sdkError instanceof RequestAbortedError || (sdkError instanceof Error && /timeout|aborted/i.test(sdkError.message));
          lastError = isTimeout
            ? new Error(`Délai d'attente dépassé après ${timeoutMs}ms`)
            : new Error(`Échec de la requête réseau: ${sdkError instanceof Error ? sdkError.message : 'OpenRouter SDK request error'}`);

          recordDiagnosticEvent({
            level: isTimeout ? 'error' : 'warn',
            category: isTimeout ? 'provider-timeout' : 'provider-network-error',
            stage: 'openrouter-chat-completions',
            message: isTimeout ? 'Le provider OpenRouter a dépassé le délai.' : "Erreur réseau lors de l'appel OpenRouter SDK.",
            providerId: normalizedConfig.providerId,
            model: modelId,
            validation: isTimeout ? 'failed' : 'repaired',
            meta: {
              transport: 'openrouter-sdk',
              timeoutMs,
              sdkStatus: apiStatus,
              error: sdkDescription
            }
          });

          if (isRetryableSdkError(sdkError)) {
            attempt += 1;
            continue;
          }
          break;
        }

        const rawBody = apiCall.response instanceof Response ? rawResponseBodies.get(apiCall.response) ?? '' : '';
        const rawPayload = parseJsonText(rawBody);
        const response = apiCall.response;

        if (!sdkResult.ok) {
          const sdkError = sdkResult.error;
          const sdkDescription = describeSdkError(sdkError);
          const retryable = isRetryableSdkError(sdkError);
          const isValidationError = /validation/i.test(String((sdkError as { name?: unknown }).name || ''));
          const responseStatus = typeof response?.status === 'number' ? response.status : undefined;
          const providerErrorMessage = responseStatus && responseStatus >= 400 ? parseOpenRouterErrorMessage(rawBody, `HTTP ${responseStatus}`) : '';

          if (providerErrorMessage && responseStatus && responseStatus >= 400) {
            lastError = new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: ${providerErrorMessage}`);

            recordDiagnosticEvent({
              level: 'error',
              category: 'provider-response-error',
              stage: 'openrouter-chat-completions',
              message: 'Réponse HTTP provider OpenRouter en erreur.',
              providerId: normalizedConfig.providerId,
              model: modelId,
              validation: 'failed',
              meta: {
                transport: 'openrouter-sdk',
                sdkStatus: apiStatus,
                sdkError: sdkDescription,
                status: responseStatus,
                rawBody: cleanText(rawBody, 2400)
              }
            });

            break;
          }

          lastError = retryable || !isValidationError
            ? new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: ${String((sdkDescription.message ?? sdkDescription.body) || 'échec du provider')}`)
            : new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: réponse vide ou incomplète du provider.`);

          recordDiagnosticEvent({
            level: retryable ? 'warn' : 'error',
            category: retryable ? 'provider-network-error' : 'provider-response-error',
            stage: 'openrouter-chat-completions',
            message: retryable ? 'Le provider OpenRouter a répondu avec une erreur réseau/serveur.' : 'Réponse provider OpenRouter invalide.',
            providerId: normalizedConfig.providerId,
            model: modelId,
            validation: retryable ? 'repaired' : 'failed',
            meta: {
              transport: 'openrouter-sdk',
              sdkStatus: apiStatus,
              sdkError: sdkDescription,
              status: response?.status,
              rawBody: cleanText(rawBody, 2400)
            }
          });

          if (retryable) {
            attempt += 1;
            continue;
          }

          if (rawPayload) {
            const payload = rawPayload;
            const message = extractAssistantMessage(payload);
            const hasContent = Boolean(cleanText(message?.content, 16000));
            const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;

            if (message && (hasContent || hasToolCalls)) {
              recordDiagnosticEvent({
                level: 'info',
                category: 'provider-response',
                stage: 'openrouter-chat-completions',
                message: 'Réponse provider validée via OpenRouter SDK.',
                providerId: normalizedConfig.providerId,
                model: modelId,
                validation: 'passed',
                meta: {
                  transport: 'openrouter-sdk',
                  sdkStatus: apiStatus,
                  hasContent,
                  toolCalls: message.tool_calls?.length || 0,
                  content: cleanText(message.content, 16000) || '',
                  response: extractResponseMeta(payload)
                }
              });

              return {
                ...message,
                content: cleanText(message.content, 16000) || undefined
              };
            }
          }

          break;
        }

        const payload = rawPayload ?? sdkResult.value;
        const message = extractAssistantMessage(payload);
        const hasContent = Boolean(cleanText(message?.content, 16000));
        const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;

        if (!message || (!hasContent && !hasToolCalls)) {
          const responseMeta = extractResponseMeta(payload);
          lastError = new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: réponse vide ou incomplète du provider.`);

          recordDiagnosticEvent({
            level: 'error',
            category: 'provider-response',
            stage: 'openrouter-chat-completions',
            message: 'Réponse provider vide ou incomplète.',
            providerId: normalizedConfig.providerId,
            model: modelId,
            validation: 'failed',
            meta: {
              transport: 'openrouter-sdk',
              sdkStatus: apiStatus,
              sdkError: undefined,
              response: responseMeta,
              hasContent,
              toolCalls: message?.tool_calls?.length || 0
            }
          });

          break;
        }

        recordDiagnosticEvent({
          level: 'info',
          category: 'provider-response',
          stage: 'openrouter-chat-completions',
          message: 'Réponse provider validée via OpenRouter SDK.',
          providerId: normalizedConfig.providerId,
          model: modelId,
          validation: 'passed',
          meta: {
            transport: 'openrouter-sdk',
            sdkStatus: apiCall.status,
            hasContent,
            toolCalls: message.tool_calls?.length || 0,
            content: cleanText(message.content, 16000) || '',
            response: extractResponseMeta(payload)
          }
        });

        return {
          ...message,
          content: cleanText(message.content, 16000) || undefined
        };
      } catch (error) {
        const sdkError = error as unknown;
        const sdkDescription = describeSdkError(sdkError);
        const isTimeout = sdkError instanceof RequestTimeoutError || sdkError instanceof RequestAbortedError || (sdkError instanceof Error && /timeout|aborted/i.test(sdkError.message));
        lastError = isTimeout
          ? new Error(`Délai d'attente dépassé après ${timeoutMs}ms`)
          : new Error(`Échec de la requête réseau: ${sdkError instanceof Error ? sdkError.message : String(sdkError)}`);

        recordDiagnosticEvent({
          level: isTimeout ? 'error' : 'warn',
          category: isTimeout ? 'provider-timeout' : 'provider-network-error',
          stage: 'openrouter-chat-completions',
          message: isTimeout ? 'Le provider OpenRouter a dépassé le délai.' : "Erreur réseau lors de l'appel OpenRouter SDK.",
          providerId: normalizedConfig.providerId,
          model: modelId,
          validation: isTimeout ? 'failed' : 'repaired',
          meta: {
            transport: 'openrouter-sdk',
            timeoutMs,
            error: sdkDescription
          }
        });

        if (isRetryableSdkError(sdkError)) {
          attempt += 1;
          continue;
        }
      }

      attempt += 1;
    }

    throw lastError || new Error(`Impossible d'obtenir une réponse valide du provider après ${maxRetries} tentatives.`);
  }

  const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[normalizedConfig.providerId];
  if (!baseUrl) throw new Error(`Provider non supporté: ${normalizedConfig.providerId}`);

  ensureApiKey(normalizedConfig.providerId, normalizedConfig.apiKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${String(normalizedConfig.apiKey || '').trim()}`,
    'Content-Type': 'application/json'
  };

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: options.maxTokens ?? caps.maxOutputTokens,
    temperature: options.temperature ?? caps.idealTemperature
  };

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

  while (attempt <= maxRetries) {
    if (attempt > 0) {
      const delay = attempt * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
      recordDiagnosticEvent({
        level: 'warn',
        category: 'provider-retry',
        stage: 'openrouter-chat-completions',
        message: `Nouvelle tentative d'appel API (essai ${attempt}/${maxRetries}).`,
        providerId: normalizedConfig.providerId,
        model: modelId,
        validation: 'repaired',
        meta: {
          transport: 'fetch',
          sdkStatus: 'retry',
          timeoutMs
        }
      });
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    const cancel = () => clearTimeout(timeoutHandle);

    try {
      if (attempt === 0) {
        recordDiagnosticEvent({
          level: 'info',
          category: 'provider-request',
          stage: 'openrouter-chat-completions',
          message: 'Appel provider texte.',
          providerId: normalizedConfig.providerId,
          model: modelId,
          validation: 'passed',
          meta: {
            transport: 'fetch',
            messageCount: messages.length,
            messages: messagesForDiagnostics,
            maxTokens: body.max_tokens,
            temperature: body.temperature,
            reasoning: body.reasoning,
            hasTools: Array.isArray(options.tools) && options.tools.length > 0,
            timeoutMs
          }
        });
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      cancel();

      if (response.ok) {
        const rawPayload = await readJsonResponseBody(response);
        const message = extractAssistantMessage(rawPayload);
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
            meta: {
              transport: 'fetch',
              response: extractResponseMeta(rawPayload)
            }
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
            transport: 'fetch',
            hasContent,
            toolCalls: message.tool_calls?.length || 0,
            content: message.content || '',
            response: extractResponseMeta(rawPayload)
          }
        });

        return {
          ...message,
          content: cleanText(message.content, 16000) || undefined
        };
      }

      const rawText = await response.clone().text().catch(() => '');
      const message = parseOpenRouterErrorMessage(rawText, `HTTP ${response.status}`);
      lastError = new Error(`${getProviderDisplayName(normalizedConfig.providerId)}: ${message}`);

      recordDiagnosticEvent({
        level: 'warn',
        category: 'provider-response-error',
        stage: 'openrouter-chat-completions',
        message: `Le provider texte a répondu en erreur (${response.status}).`,
        providerId: normalizedConfig.providerId,
        model: modelId,
        validation: 'repaired',
        meta: {
          transport: 'fetch',
          status: response.status,
          providerMessage: message,
          rawBody: cleanText(rawText, 2400)
        }
      });

      if (!isRetryableHttpStatus(response.status)) {
        break;
      }
    } catch (error) {
      cancel();
      const msg = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(error.message));
      lastError = isTimeout
        ? new Error(`Délai d'attente dépassé après ${timeoutMs}ms`)
        : new Error(`Échec de la requête réseau: ${msg}`);

      if (isTimeout) {
        recordDiagnosticEvent({
          level: 'error',
          category: 'provider-timeout',
          stage: 'openrouter-chat-completions',
          message: 'Le provider texte a dépassé le délai.',
          providerId: normalizedConfig.providerId,
          model: modelId,
          validation: 'failed',
          meta: { transport: 'fetch', timeoutMs }
        });
      } else {
        recordDiagnosticEvent({
          level: 'warn',
          category: 'provider-network-error',
          stage: 'openrouter-chat-completions',
          message: "Erreur réseau lors de l'appel API.",
          providerId: normalizedConfig.providerId,
          model: modelId,
          validation: 'repaired',
          meta: { transport: 'fetch', error: msg }
        });
      }
    }

    attempt += 1;
  }

  throw lastError || new Error(`Impossible d'obtenir une réponse valide du provider après ${maxRetries} tentatives.`);
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
