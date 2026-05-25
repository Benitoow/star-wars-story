import { dev } from '$app/environment';

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, ...rest: unknown[]): void {
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
