import { describe, it, expect, beforeEach } from 'vitest';
import { logger, recordDiag, getLogs, clearLogs } from './logger';

describe('logger ring buffer (diagnostics)', () => {
  beforeEach(() => clearLogs());

  it('captures info/warn/error but not debug', () => {
    logger.debug('d');
    logger.info('i');
    logger.warn('w', new Error('boom'));
    logger.error('e');
    const logs = getLogs();
    expect(logs.map((l) => l.level)).toEqual(['info', 'warn', 'error']);
    expect(logs.find((l) => l.level === 'warn')?.data).toContain('boom');
  });

  it('recordDiag stores a structured entry without throwing', () => {
    recordDiag('gen', { mode: 'agentic-subagents', rawResponse: 'x'.repeat(20) });
    const last = getLogs().at(-1);
    expect(last?.message).toBe('gen');
    expect(last?.data).toContain('agentic-subagents');
  });

  it('clearLogs empties the buffer', () => {
    logger.info('a');
    clearLogs();
    expect(getLogs()).toHaveLength(0);
  });
});
