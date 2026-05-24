import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSupportedStoryProviderConfig,
  callOpenAiCompatibleRaw,
  normalizeStoryGenerationMode,
  validateStoryTurnGenerationResult
} from './storyEngine';
import { PROVIDER_RESPONSE_FIXTURES } from '../../test/fixtures/providerResponseFixtures';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function buildResponseFixture(fixture: (typeof PROVIDER_RESPONSE_FIXTURES)[number]): Response {
  const hasJsonBody = fixture.json !== undefined;
  const body = fixture.text ?? (hasJsonBody ? JSON.stringify(fixture.json ?? {}) : '');
  const looksLikeJson = typeof body === 'string' && /^[\s\r\n]*[\[{]/.test(body);

  return new Response(body, {
    status: fixture.status ?? (fixture.ok ? 200 : 500),
    headers: {
      'content-type': hasJsonBody || looksLikeJson ? 'application/json' : 'text/plain'
    }
  });
}

describe('story engine contracts', () => {
  it('normalizes legacy runtime mode aliases to the frozen public modes', () => {
    expect(normalizeStoryGenerationMode('pipeline')).toBe('agentic-subagents');
    expect(normalizeStoryGenerationMode('agentic-tools')).toBe('agentic-subagents');
    expect(normalizeStoryGenerationMode('structured-json')).toBe('structured-json');
  });

  it('maps legacy provider ids to the supported OpenRouter surface', () => {
    const config = assertSupportedStoryProviderConfig({
      providerId: 'openai',
      model: 'openai/gpt-5.4-mini',
      apiKey: 'test-key'
    });

    expect(config.providerId).toBe('openrouter');
    expect(config.model).toBe('openai/gpt-5.4-mini');
  });

  it('rejects empty chapters after central validation', () => {
    expect(() => validateStoryTurnGenerationResult({
      chapter: {
        chapter_title: 'Vide',
        chapter_number: 1,
        section_type: 'action',
        narrative: { context: '', action: '', dialogue: '', reflection: '', atmosphere: 'tense' },
        choices: [],
        memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] },
        scene_description: 'test',
        user_edits_applied: null
      },
      rawResponse: '',
      mode: 'agentic-subagents',
      steps: 4,
      toolCalls: 0
    }, 1)).toThrow('aucune action ni dialogue exploitable');
  });

  it.each(PROVIDER_RESPONSE_FIXTURES)('validates provider fixture: $name', async (fixture) => {
    const fetchMock = vi.fn().mockImplementation(() => buildResponseFixture(fixture));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const run = () => callOpenAiCompatibleRaw(
      [{ role: 'user', content: 'Test fixture provider' }],
      { providerId: 'openrouter', model: 'qwen/qwen3.5-9b', apiKey: 'test-key' }
    );

    if (fixture.shouldThrow) {
      await expect(run()).rejects.toThrow(fixture.expectedMessage);
      return;
    }

    const message = await run();
    if (fixture.expectContent !== undefined) {
      expect(message.content).toBe(fixture.expectContent);
    }
    expect(message.role).toBe('assistant');
  });
});
