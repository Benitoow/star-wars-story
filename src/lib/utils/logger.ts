import { browser, dev } from '$app/environment';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

const STORAGE_KEY = 'sw_log_level';
const GLOBAL_KEY = '__SW_STORY_LOG_LEVEL__';
const PREFIX = '[star-wars-story]';

let runtimeLogLevel: LogLevel | null = null;

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

function emit(level: LogLevel, message: string, meta: unknown[]): void {
  if (!shouldLog(level)) return;

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
    console.warn(output, ...meta);
    return;
  }

  console.error(output, ...meta);
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
