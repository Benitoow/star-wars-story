import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateCharacterGenesis, parseGenesis } from './genesis';
import { initWorldState } from './worldState';
import { buildStartPrompt, buildStableSystemPrompt } from './prompts';
import { generateOpening } from './generate';
import type { CharacterGenesis, StoryProviderConfig, StorySetup } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'm', apiKey: 'k' };
const setup: StorySetup = {
  era: 'imperial', faction: 'rebels', role: 'smuggler', premise: 'p',
  protagonistFirstName: 'Kael', language: 'fr'
};

const genesis: CharacterGenesis = {
  background: 'Ancien docker de Corellia, il a perdu son frère dans une rafle impériale.',
  motivation: 'Racheter la dette qui pèse sur sa sœur.',
  flaw: 'Il ne sait pas partir quand il le faut.',
  items: [{ name: 'Datapad volé', qty: 1 }, { name: 'Blaster usé', qty: 1 }],
  ally: { name: 'Vess Rann', affinity: 45, status: 'ally', alive: true, note: 'contrebandière, sa dernière associée' },
  location: 'Docks de Corellia',
  premise: 'Kael doit livrer un datapad volé avant que la patrouille ne boucle le secteur.'
};

afterEach(() => vi.unstubAllGlobals());

describe('parseGenesis', () => {
  it('validates and clamps a well-formed payload', () => {
    const parsed = parseGenesis(JSON.stringify({
      background: 'Un passé.', motivation: 'Un but.', flaw: 'Un défaut.',
      items: [{ name: 'Outil', qty: 3 }, { name: 'Carte' }, { name: 'Ignoré' }],
      ally: { name: 'Vess', role: 'contact', note: 'sa dernière associée', affinity: 900 },
      location: 'Docks', premise: 'Une situation.'
    }), setup);

    expect(parsed?.items).toHaveLength(2);           // capped at two starting objects
    expect(parsed?.items[0]).toEqual({ name: 'Outil', qty: 3 });
    expect(parsed?.ally.affinity).toBe(100);          // clamped
    expect(parsed?.ally.status).toBe('ally');
    expect(parsed?.ally.faction).toBe('rebels');
  });

  it('trims an over-long item name on a word boundary, never mid-word', () => {
    const parsed = parseGenesis(JSON.stringify({
      background: 'b', premise: 'p',
      items: [{ name: 'Transpondeur volé (crypté) dissimulé dans une cheville creuse et scellée', qty: 1 }]
    }), setup);
    const name = parsed!.items[0].name;
    expect(name.length).toBeLessThanOrEqual(48);
    expect(name).not.toMatch(/\s$/);          // no dangling space
    expect(name.endsWith('creus')).toBe(false); // the exact cut seen in play
    // Whatever survives is made of whole words.
    expect('Transpondeur volé (crypté) dissimulé dans une cheville creuse et scellée').toContain(name);
  });

  it('rejects a payload with no background or no premise — those are what turn 1 stages', () => {
    expect(parseGenesis(JSON.stringify({ background: 'x' }), setup)).toBeNull();
    expect(parseGenesis(JSON.stringify({ premise: 'x' }), setup)).toBeNull();
    expect(parseGenesis('pas du json', setup)).toBeNull();
  });

  it('returns null rather than throwing when the call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau coupé')));
    expect(await generateCharacterGenesis(setup, 'Le Solitaire', [], provider)).toBeNull();
  });

  it('crosses era, faction, role and trame in the prompt', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '',
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ background: 'b', premise: 'p' }) } }] })
    });
    vi.stubGlobal('fetch', mock);

    await generateCharacterGenesis(setup, 'Le Solitaire', ['Ère Impériale : ...'], provider);
    const completion = mock.mock.calls.find((c) => String(c[0]).includes('/chat/completions'));
    const body = JSON.parse((completion![1] as { body: string }).body) as { messages: Array<{ content: string }> };
    const user = body.messages.at(-1)!.content;
    expect(user).toContain('imperial');
    expect(user).toContain('rebels');
    expect(user).toContain('smuggler');
    expect(user).toContain('Le Solitaire');
    expect(user).toContain('Kael');
    expect(user).toMatch(/aucune intrigue|AUCUN événement futur/i);
  });
});

describe('the genesis seeds the world instead of leaving turn 1 an empty stage', () => {
  it('opens with the starting items, the tied NPC and the real location', () => {
    const world = initWorldState({ ...setup, genesis });
    expect(world.player.inventory.map((i) => i.name)).toEqual(['Datapad volé', 'Blaster usé']);
    expect(world.npcs.map((n) => n.name)).toEqual(['Vess Rann']);
    expect(world.player.location).toBe('Docks de Corellia');
  });

  it('still opens correctly for a story created without one', () => {
    const world = initWorldState(setup);
    expect(world.player.inventory).toEqual([]);
    expect(world.npcs).toEqual([]);
    expect(world.player.location).toBeTruthy();
  });
});

describe('turn 1 stages the character rather than inventing it', () => {
  it('tells the model the protagonist is already defined and to use the seeded items', () => {
    const prompt = buildStartPrompt({ ...setup, genesis }, 'Le Solitaire');
    expect(prompt).toContain('DÉJÀ défini');
    expect(prompt).toContain('Docks de Corellia');
    expect(prompt).toContain('Vess Rann');
    expect(prompt).toContain('Datapad volé');
    expect(prompt).toContain('AU MOINS UN CHOIX');
    expect(prompt).toContain('Le Solitaire');       // the trame is no longer discarded
  });

  it('falls back to introducing the protagonist when there is no genesis', () => {
    const prompt = buildStartPrompt(setup, null);
    expect(prompt).toContain('introduction cinématique');
    expect(prompt).not.toContain('DÉJÀ défini');
  });

  it('puts the character in the stable system prefix, so both engines see it', () => {
    const sys = buildStableSystemPrompt({ ...setup, genesis }, 3);
    expect(sys).toContain('LE PROTAGONISTE');
    expect(sys).toContain('Ancien docker de Corellia');
    expect(sys).toContain('Il ne sait pas partir');   // the flaw travels too
  });
});

describe('the agentic engine finally receives the turn-1 spec', () => {
  it('passes the opening brief to the Director AND the Writer', async () => {
    const director = JSON.stringify({ scene_goal: 'g', tension: 't', must_include: ['x'], section_type: 'action', atmosphere: 'tense' });
    const brain = JSON.stringify({ chapter_title: 'T', section_type: 'action', narrative: {}, state_update: {}, choices: [], memory_updates: {} });
    const contents = [director, 'prose', 'prose relue', brain];
    let i = 0;
    const mock = vi.fn().mockImplementation(async (url: unknown) => {
      if (String(url).includes('/models')) return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '' };
      const c = contents[Math.min(i++, contents.length - 1)];
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: c } }] }), text: async () => c };
    });
    vi.stubGlobal('fetch', mock);

    await generateOpening({ ...setup, genesis }, provider, { mode: 'agentic-subagents', trameLabel: 'Le Solitaire' });

    const bodies = mock.mock.calls
      .filter((c) => String(c[0]).includes('/chat/completions'))
      .map((c) => JSON.parse((c[1] as { body: string }).body) as { messages: Array<{ content: string }> });
    const [directorCall, writerCall] = bodies;

    expect(directorCall.messages.at(-1)!.content).toContain('EXIGENCES DU PREMIER TOUR');
    expect(writerCall.messages.at(-1)!.content).toContain('EXIGENCES DU PREMIER TOUR');
    // And the Writer's stable prefix carries who the character is.
    expect(writerCall.messages[0].content).toContain('LE PROTAGONISTE');
    expect(writerCall.messages[0].content).toContain('Ancien docker de Corellia');
  });
});
