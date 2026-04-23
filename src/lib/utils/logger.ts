import { browser, dev } from '$app/environment';
import { APP_VERSION, STORY_ENGINE_RELEASE_CHANNEL } from '$lib/config/app';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type DiagnosticLevel = Exclude<LogLevel, 'silent'>;
export type DiagnosticValidationResult = 'passed' | 'failed' | 'repaired' | 'skipped';

export interface DiagnosticEntry {
  id: string;
  timestamp: string;
  appVersion: string;
  releaseChannel: string;
  level: DiagnosticLevel;
  category: string;
  message: string;
  stage?: string;
  providerId?: string;
  model?: string;
  runtimeMode?: string;
  storyId?: string;
  sessionId?: string;
  validation?: DiagnosticValidationResult;
  meta?: unknown;
}

export interface DiagnosticEventInput {
  level?: DiagnosticLevel;
  category: string;
  message: string;
  stage?: string;
  providerId?: string;
  model?: string;
  runtimeMode?: string;
  storyId?: string;
  sessionId?: string;
  validation?: DiagnosticValidationResult;
  meta?: unknown;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

const STORAGE_KEY = 'sw_log_level';
const GLOBAL_KEY = '__SW_STORY_LOG_LEVEL__';
const DIAGNOSTICS_STORAGE_KEY = 'sw_story_engine_diagnostics_v1';
const PREFIX = '[star-wars-story]';
const DIAGNOSTIC_LIMIT = 200;
const SENSITIVE_META_KEYS = new Set([
  'apiKey',
  'apikey',
  'authorization',
  'auth',
  'token',
  'textApiKey',
  'imageApiKey',
  'body',
  'rawBody',
  'rawResponse',
  'messages',
  'prompt',
  'systemPrompt',
  'userPrompt',
  'content'
]);

let runtimeLogLevel: LogLevel | null = null;
let runtimeDiagnostics: DiagnosticEntry[] | null = null;

function normalizeLogLevel(value: unknown): LogLevel | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error' || normalized === 'silent') {
    return normalized;
  }
  return null;
}

function readConfiguredLogLevel(): LogLevel | null {
  if (!browser) return null;

  try {
    const globalLevel = normalizeLogLevel((globalThis as Record<string, unknown>)[GLOBAL_KEY]);
    if (globalLevel) return globalLevel;
  } catch {
    // ignore lookup issues
  }

  try {
    return normalizeLogLevel(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function defaultLogLevel(): LogLevel {
  return dev ? 'warn' : 'error';
}

function generateDiagnosticId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `diag-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampPreview(value: string, maxLength = 180): string {
  return value.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function summarizeString(value: string, sensitive = false): Record<string, unknown> {
  const preview = clampPreview(value);
  return sensitive
    ? { redacted: true, length: value.length, hash: simpleHash(value) }
    : { preview, length: value.length, hash: simpleHash(value) };
}

function sanitizeDiagnosticMeta(value: unknown, keyHint = '', depth = 0): unknown {
  if (value === null || value === undefined) return value;

  const normalizedKey = keyHint.trim().toLowerCase();
  const sensitive = SENSITIVE_META_KEYS.has(normalizedKey);

  if (typeof value === 'string') {
    if (sensitive || value.length > 220 || /\n/.test(value)) {
      return summarizeString(value, sensitive);
    }
    return clampPreview(value, 220);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: clampPreview(value.message, 220),
      stack: value.stack ? summarizeString(value.stack, false) : undefined
    };
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      items: depth >= 2
        ? []
        : value.slice(0, 5).map(item => sanitizeDiagnosticMeta(item, keyHint, depth + 1))
    };
  }

  if (typeof value === 'object') {
    if (depth >= 2) {
      return {
        type: 'object',
        keys: Object.keys(value as Record<string, unknown>).slice(0, 12)
      };
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 16)
      .map(([key, nestedValue]) => [key, sanitizeDiagnosticMeta(nestedValue, key, depth + 1)] as const);

    return Object.fromEntries(entries);
  }

  return clampPreview(String(value), 120);
}

function loadDiagnosticsFromStorage(): DiagnosticEntry[] {
  if (!browser) return [];

  try {
    const raw = window.localStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is DiagnosticEntry => Boolean(entry) && typeof entry === 'object')
      .slice(-DIAGNOSTIC_LIMIT);
  } catch {
    return [];
  }
}

function getDiagnosticsBuffer(): DiagnosticEntry[] {
  if (runtimeDiagnostics) return runtimeDiagnostics;
  runtimeDiagnostics = loadDiagnosticsFromStorage();
  return runtimeDiagnostics;
}

function persistDiagnostics(entries: DiagnosticEntry[]): void {
  runtimeDiagnostics = entries;
  if (!browser) return;

  try {
    window.localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore persistence issues
  }
}

export function getLogLevel(): LogLevel {
  if (runtimeLogLevel) return runtimeLogLevel;
  return readConfiguredLogLevel() ?? defaultLogLevel();
}

export function setLogLevel(level: LogLevel, persist = true): void {
  runtimeLogLevel = level;

  if (!browser || !persist) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // ignore persistence issues
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[getLogLevel()];
}

export function recordDiagnosticEvent(input: DiagnosticEventInput): DiagnosticEntry {
  const entry: DiagnosticEntry = {
    id: generateDiagnosticId(),
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    releaseChannel: STORY_ENGINE_RELEASE_CHANNEL,
    level: input.level ?? 'info',
    category: clampPreview(input.category, 60) || 'application',
    message: clampPreview(input.message, 280) || 'Diagnostic event',
    stage: input.stage ? clampPreview(input.stage, 80) : undefined,
    providerId: input.providerId ? clampPreview(input.providerId, 60) : undefined,
    model: input.model ? clampPreview(input.model, 120) : undefined,
    runtimeMode: input.runtimeMode ? clampPreview(input.runtimeMode, 60) : undefined,
    storyId: input.storyId ? clampPreview(input.storyId, 120) : undefined,
    sessionId: input.sessionId ? clampPreview(input.sessionId, 120) : undefined,
    validation: input.validation,
    meta: input.meta === undefined ? undefined : sanitizeDiagnosticMeta(input.meta)
  };

  const entries = [...getDiagnosticsBuffer(), entry].slice(-DIAGNOSTIC_LIMIT);
  persistDiagnostics(entries);
  return entry;
}

export function getDiagnosticsLog(): DiagnosticEntry[] {
  return [...getDiagnosticsBuffer()];
}

export function clearDiagnosticsLog(): void {
  persistDiagnostics([]);
}

export function exportDiagnosticsLog(): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    releaseChannel: STORY_ENGINE_RELEASE_CHANNEL,
    entries: getDiagnosticsLog()
  }, null, 2);
}

function emit(level: LogLevel, message: string, meta: unknown[]): void {
  const shouldEmit = shouldLog(level);
  if (!shouldEmit && level !== 'warn' && level !== 'error') return;

  const output = `${PREFIX} ${message}`;

  if (level === 'debug') {
    console.debug(output, ...meta);
    return;
  }

  if (level === 'info') {
    console.info(output, ...meta);
    return;
  }

  if (level === 'warn') {
    if (shouldEmit) console.warn(output, ...meta);
    recordDiagnosticEvent({
      level: 'warn',
      category: 'application-log',
      message,
      meta
    });
    return;
  }

  if (shouldEmit) console.error(output, ...meta);
  recordDiagnosticEvent({
    level: 'error',
    category: 'application-log',
    message,
    meta
  });
}

export const logger = {
  debug(message: string, ...meta: unknown[]): void {
    emit('debug', message, meta);
  },
  info(message: string, ...meta: unknown[]): void {
    emit('info', message, meta);
  },
  warn(message: string, ...meta: unknown[]): void {
    emit('warn', message, meta);
  },
  error(message: string, ...meta: unknown[]): void {
    emit('error', message, meta);
  }
};
