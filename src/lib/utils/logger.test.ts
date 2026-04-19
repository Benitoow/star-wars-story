import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogLevel, logger, setLogLevel } from './logger';

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('warn', false);
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
});
