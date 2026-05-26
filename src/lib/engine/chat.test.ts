import { describe, it, expect, vi, afterEach } from 'vitest';
import { npcReply, resolveConversation } from './chat';
import { initWorldState } from './worldState';
import type { NpcRelation, StoryProviderConfig, StorySetup } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };
const setup: StorySetup = { era: 'imperial', faction: 'rebels', role: 'smuggler', premise: 'x', protagonistFirstName: 'Kael', language: 'fr' };
const npc: NpcRelation = { name: 'Vela', affinity: 10, status: 'neutral', alive: true, faction: 'hutt', note: 'informatrice' };

function sseBody(chunks: string[]) {
  let i = 0;
  const enc = new TextEncoder();
  return { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined }) }) };
}
afterEach(() => vi.unstubAllGlobals());

describe('npcReply (streamed, in-character)', () => {
  it('streams the NPC reply token by token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"Vela : "}}]}\n\n', 'data: {"choices":[{"delta":{"content":"Que veux-tu ?"}}]}\n\n', 'data: [DONE]\n\n'])
    }));
    const tokens: string[] = [];
    const reply = await npcReply(
      { setup, worldState: initWorldState(setup), npc, sceneSummary: 'cantina enfumée', turns: [{ speaker: 'player', content: 'Salut Vela.' }] },
      provider,
      (t) => tokens.push(t)
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(reply).toContain('Que veux-tu');
  });
});

describe('resolveConversation (exit debrief)', () => {
  it('builds a recap chapter and applies the conversation consequences', async () => {
    const content = JSON.stringify({
      chapter_title: 'Marché conclu',
      section_type: 'dialogue',
      narrative: { action: 'Vela accepte de parler après quelques crédits.', dialogue: '', reflection: '', atmosphere: 'calm' },
      state_update: { npcs: [{ name: 'Vela', affinity: 30, status: 'ally', note: 'alliée payée' }] },
      memory_updates: { notes: ['Vela connaît la planque rebelle'] },
      choices: [{ text: 'Suivre Vela vers la planque', attribute: 'stealth', difficulty: 2 }]
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content }));

    const world = initWorldState(setup);
    world.npcs.push({ name: 'Vela', affinity: 10, status: 'neutral', alive: true });
    const result = await resolveConversation(
      { setup, worldState: world, npc, sceneSummary: 'cantina', turns: [{ speaker: 'player', content: 'Aide-moi.' }, { speaker: 'npc', content: 'Ça se paie.' }], turnNumber: 4 },
      provider
    );

    expect(result.chapter.chapter_title).toBe('Marché conclu');
    expect(result.chapter.choices[0].text).toContain('Vela');
    const vela = result.worldState.npcs.find((n) => n.name === 'Vela');
    expect(vela?.affinity).toBe(30); // absolute set by the debrief
    expect(vela?.status).toBe('ally');
  });
});
