import { describe, it, expect, vi, afterEach } from 'vitest';
import { retrieveCodex, generateCampaignDossier, CODEX } from './codex';
import type { StoryProviderConfig } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };
const setup = { era: 'imperial', faction: 'rebels', role: 'smuggler', premise: 'x', language: 'fr' };

afterEach(() => vi.unstubAllGlobals());

describe('retrieveCodex', () => {
  it('only returns entries from the campaign era', () => {
    const entries = retrieveCodex('imperial', 'planète lointaine');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.eras.includes('imperial'))).toBe(true);
  });

  it('ranks entries matching the scene keywords first', () => {
    const entries = retrieveCodex('imperial', 'vaisseau TIE destroyer stellaire', 3);
    expect(entries[0].keywords).toMatch(/vaisseau|destroyer|tie/i);
  });

  it('caps the batch and returns nothing for an unknown era', () => {
    expect(retrieveCodex('imperial', 'x', 2).length).toBeLessThanOrEqual(2);
    expect(retrieveCodex('nimporte-quoi', 'x')).toEqual([]);
  });

  it('every era in the game has codex coverage', () => {
    for (const era of ['old_republic', 'clone_wars', 'imperial', 'new_republic', 'first_order']) {
      expect(retrieveCodex(era, 'général', 10).length).toBeGreaterThan(0);
    }
  });
});

describe('generateCampaignDossier', () => {
  it('asks the model for a factual, intrigue-free dossier', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"dossier":"Sous l\'Empire, les mondes de la Bordure Extérieure vivent sous la loi martiale."}' } }] }),
      text: async () => ''
    });
    vi.stubGlobal('fetch', mock);

    const dossier = await generateCampaignDossier(setup, provider, retrieveCodex('imperial', 'x', 3));
    expect(dossier).toContain('Bordure Extérieure');
    const completion = mock.mock.calls.find((c) => String(c[0]).includes('/chat/completions'));
    const body = JSON.parse((completion![1] as { body: string }).body) as { messages: Array<{ role: string; content: string }> };
    const user = body.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).toMatch(/dossier de contexte|DOSSIER/i);
    expect(user).toMatch(/intrigue|événement/i); // the no-plot guardrail is in the prompt
  });

  it('returns an empty dossier on failure (opening never blocks)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau coupé')));
    expect(await generateCampaignDossier(setup, provider, [])).toBe('');
  });
});
