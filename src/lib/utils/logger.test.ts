import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDiagnosticsLog,
  exportDiagnosticsLog,
  getDiagnosticsLog,
  getLogLevel,
  logger,
  recordDiagnosticEvent,
  setLogLevel
} from './logger';

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('warn', false);
    clearDiagnosticsLog();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suppresses info logs when level is warn', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logger.info('this should stay silent');

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('emits warn logs with project prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logger.warn('visible warning');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('[star-wars-story] visible warning');
  });

  it('applies runtime log-level overrides', () => {
    setLogLevel('debug', false);

    expect(getLogLevel()).toBe('debug');
  });

  it('records bounded structured diagnostics with redaction', () => {
    recordDiagnosticEvent({
      level: 'error',
      category: 'provider-response',
      message: 'Provider exploded.',
      stage: 'openrouter-chat-completions',
      validation: 'failed',
      meta: {
        apiKey: 'secret-key',
        prompt: 'A'.repeat(400),
        providerMessage: 'boom'
      }
    });

    const log = getDiagnosticsLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.meta).toMatchObject({
      apiKey: { redacted: true },
      prompt: { length: 400 }
    });
  });

  it('exports diagnostics as JSON envelope', () => {
    recordDiagnosticEvent({
      category: 'runtime',
      message: 'Runtime recovered after validation.',
      validation: 'repaired'
    });

    const exported = JSON.parse(exportDiagnosticsLog()) as { exportedAt: string; entries: unknown[] };

    expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(exported.entries).toHaveLength(1);
  });
});
