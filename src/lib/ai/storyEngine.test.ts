import { describe, expect, it } from 'vitest';
import { parseStoryResponse, supportsAgenticToolCalling } from './storyEngine';

describe('supportsAgenticToolCalling', () => {
  it('enables native tool-calling for Gemma 4 models on OpenRouter', () => {
    expect(supportsAgenticToolCalling('openrouter', 'google/gemma-4-26b-a4b-it')).toBe(true);
  });

  it('keeps agentic mode enabled for supported models', () => {
    expect(supportsAgenticToolCalling('openrouter', 'openai/gpt-5.4-mini')).toBe(true);
  });

  it('defaults unknown models to agentic on compatible providers', () => {
    expect(supportsAgenticToolCalling('openrouter', 'my/custom-model-1')).toBe(true);
  });

  it('returns false when provider is unsupported', () => {
    expect(supportsAgenticToolCalling('none', 'openai/gpt-5.4-mini')).toBe(false);
  });
});

describe('parseStoryResponse', () => {
  it('extracts action text from malformed json-prefixed payloads', () => {
    const raw = `json {"chapter_title":"Sous la pluie de Coruscant","chapter_number":3,"narrative":{"action":"La pluie martèle les passerelles.\\n\\nKaelen hésite une seconde avant d'avancer.","dialogue":""}`;

    const chapter = parseStoryResponse(raw, 3);

    expect(chapter.narrative.action).toContain('La pluie martèle les passerelles.');
    expect(chapter.narrative.action).toContain('Kaelen hésite une seconde avant d\'avancer.');
    expect(chapter.narrative.action.toLowerCase()).not.toContain('chapter_title');
    expect(chapter.narrative.action.trim().startsWith('{')).toBe(false);
  });
});
