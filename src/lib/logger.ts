import { dev } from '$app/environment';

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  t: string; // ISO timestamp
  level: Level;
  message: string;
  data?: string;
}

// In-memory ring buffer of recent events, surfaced in the diagnostics export.
const RING: LogEntry[] = [];
const RING_MAX = 200;

function snippet(values: unknown[]): string | undefined {
  if (!values.length) return undefined;
  return values
    .map((v) => {
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (typeof v === 'string') return v;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    })
    .join(' ')
    .slice(0, 8000);
}

function push(level: Level, message: string, data: unknown[]): void {
  RING.push({ t: new Date().toISOString(), level, message, data: snippet(data) });
  if (RING.length > RING_MAX) RING.shift();
}

function emit(level: Level, message: string, ...rest: unknown[]): void {
  if (level !== 'debug') push(level, message, rest);
  if (level === 'debug' && !dev) return;
  // eslint-disable-next-line no-console
  console[level](`[sw] ${message}`, ...rest);
}

export const logger = {
  debug: (m: string, ...r: unknown[]) => emit('debug', m, ...r),
  info: (m: string, ...r: unknown[]) => emit('info', m, ...r),
  warn: (m: string, ...r: unknown[]) => emit('warn', m, ...r),
  error: (m: string, ...r: unknown[]) => emit('error', m, ...r)
};

/** Record a diagnostic event into the ring buffer only (no console noise). */
export function recordDiag(message: string, ...data: unknown[]): void {
  push('info', message, data);
}

export function getLogs(): LogEntry[] {
  return [...RING];
}

export function clearLogs(): void {
  RING.length = 0;
}
