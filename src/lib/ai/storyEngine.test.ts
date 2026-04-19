import { describe, expect, it } from 'vitest';
import { supportsAgenticToolCalling } from './storyEngine';

describe('supportsAgenticToolCalling', () => {
  it('disables native tool-calling for Gemma 4 models on OpenRouter', () => {
    expect(supportsAgenticToolCalling('openrouter', 'google/gemma-4-26b-a4b-it')).toBe(false);
  });

  it('keeps agentic mode enabled for supported models', () => {
    expect(supportsAgenticToolCalling('openrouter', 'openai/gpt-5.4-mini')).toBe(true);
  });

  it('returns false when provider is unsupported', () => {
    expect(supportsAgenticToolCalling('none', 'openai/gpt-5.4-mini')).toBe(false);
  });
});
