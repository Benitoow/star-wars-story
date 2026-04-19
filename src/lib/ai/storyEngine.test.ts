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

  it('keeps agentic mode enabled for Xiaomi MiMo-V2-Flash and Grok 4.1 Fast', () => {
    expect(supportsAgenticToolCalling('openrouter', 'xiaomi/mimo-v2-flash')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'x-ai/grok-4.1-fast')).toBe(true);
  });

  it('keeps agentic mode enabled for Grok 4.20, MiniMax M2.7, Qwen3.5-9B and MiMo-V2-Omni', () => {
    expect(supportsAgenticToolCalling('openrouter', 'x-ai/grok-4.20')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'minimax/minimax-m2.7')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'qwen/qwen3.5-9b')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'xiaomi/mimo-v2-omni')).toBe(true);
  });

  it('keeps agentic mode enabled for DeepSeek V3.2, GPT-OSS-120B, Gemini 2.5 Flash Lite and Gemini 3 Flash Preview', () => {
    expect(supportsAgenticToolCalling('openrouter', 'deepseek/deepseek-v3.2')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'openai/gpt-oss-120b')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'google/gemini-2.5-flash-lite')).toBe(true);
    expect(supportsAgenticToolCalling('openrouter', 'google/gemini-3-flash-preview')).toBe(true);
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
