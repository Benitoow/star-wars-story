import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, parseStoryResponse, supportsAgenticToolCalling } from './storyEngine';

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

  it('normalizes numbered choice labels from model output', () => {
    const raw = JSON.stringify({
      chapter_title: 'Test',
      chapter_number: 2,
      section_type: 'action',
      narrative: { action: 'Scène de test.' },
      choices: [
        { text: '1. Inspecter discrètement le hangar', attribute: 'stealth', difficulty: 2 },
        { text: 'B) Questionner Lira immédiatement', attribute: 'diplomacy', difficulty: 3 },
        { text: '• Activer le terminal de sécurité', attribute: 'tech', difficulty: 3 }
      ]
    });

    const chapter = parseStoryResponse(raw, 2);

    expect(chapter.choices[0]?.text.startsWith('1.')).toBe(false);
    expect(chapter.choices[1]?.text.startsWith('B)')).toBe(false);
    expect(chapter.choices[2]?.text.startsWith('•')).toBe(false);
    expect(chapter.choices[0]?.text).toContain('Inspecter discrètement le hangar');
  });

  it('recovers inline credits/hp deltas when state_update is missing', () => {
    const raw = JSON.stringify({
      chapter_title: 'Pacte dans la poussière',
      chapter_number: 2,
      section_type: 'action',
      narrative: {
        action: 'Lira glisse une datacarte dans ta main. credits:+200. La pression monte. hp:-10.'
      },
      choices: [{ text: 'Continuer', attribute: 'survival', difficulty: 2 }]
    });

    const chapter = parseStoryResponse(raw, 2);

    expect(chapter.state_update?.credits).toBe(200);
    expect(chapter.state_update?.hp).toBe(-10);
  });

  it('infers location from narrative when model omits world location', () => {
    const raw = JSON.stringify({
      chapter_title: 'Ombres sur les docks',
      chapter_number: 1,
      section_type: 'action',
      narrative: {
        action: 'La sirène retentit dans le hangar de Nar Shaddaa tandis que les contrebandiers verrouillent les portes.'
      },
      state_update: {
        location: 'Inconnu'
      },
      choices: [{ text: 'Observer discrètement', attribute: 'stealth', difficulty: 2 }]
    });

    const chapter = parseStoryResponse(raw, 1);

    expect(chapter.state_update?.location).toBe('Nar Shaddaa');
    expect(chapter.memory_updates.places).toContain('Nar Shaddaa');
  });

  it('seeds npc entries from dialogue labels when state_update.npcs is missing', () => {
    const raw = JSON.stringify({
      chapter_title: 'Marché noir',
      chapter_number: 4,
      section_type: 'dialogue',
      narrative: {
        action: 'La foule s’écarte quand deux silhouettes t’encerclent.',
        dialogue: '— Lira : On ne devrait pas être vus ici.\n— Kesh : Trop tard, ils arrivent.'
      },
      choices: [{ text: 'Suivre Lira', attribute: 'diplomacy', difficulty: 2 }]
    });

    const chapter = parseStoryResponse(raw, 4);
    const npcNames = chapter.state_update?.npcs?.map(npc => npc.name) ?? [];

    expect(npcNames).toContain('Lira');
    expect(npcNames).toContain('Kesh');
    expect(chapter.memory_updates.relations.some(item => /^Rencontre avec\s+/i.test(item))).toBe(false);
  });

  it('does not seed locations or vehicles as npc names', () => {
    const raw = JSON.stringify({
      chapter_title: 'Échos du canyon',
      chapter_number: 8,
      section_type: 'action',
      narrative: {
        action: 'Le YT-1300 file vers le Canyon de Jundland. Kashyyyk n\'est plus qu\'un souvenir lointain.',
        dialogue: '— Vex : On décroche maintenant.'
      },
      choices: [{ text: 'Suivre Vex', attribute: 'survival', difficulty: 2 }]
    });

    const chapter = parseStoryResponse(raw, 8);
    const npcNames = new Set((chapter.state_update?.npcs ?? []).map(npc => npc.name));

    expect(npcNames.has('Vex')).toBe(true);
    expect(npcNames.has('Jundland')).toBe(false);
    expect(npcNames.has('Canyon')).toBe(false);
    expect(npcNames.has('Kashyyyk')).toBe(false);
    expect(npcNames.has('YT-1300')).toBe(false);
  });

  it('keeps dialogue instructions explicit in the system prompt', () => {
    const prompt = buildSystemPrompt(
      {
        era: 'imperial',
        faction: 'rebels',
        role: 'smuggler',
        premise: 'Test prompt',
        writingStyle: 'cinematic',
        writingTone: 'tense',
        writingPov: 'first-person',
        writingLength: 'medium',
        contentMode: 'cinematic',
        protagonistFirstName: 'Ash',
        protagonistLastName: 'Voss'
      },
      [],
      undefined,
      'json',
      1,
      []
    );

    expect(prompt).toContain('DIALOGUES: chaque réplique doit être sur son propre paragraphe');
    expect(prompt).toContain('Ne colle jamais une réplique au milieu d\'un paragraphe d\'action.');
  });

  it('locks canonical role in the system prompt', () => {
    const prompt = buildSystemPrompt(
      {
        era: 'imperial',
        faction: 'jedi',
        role: 'padawan',
        premise: 'Test role lock',
        writingStyle: 'cinematic',
        writingTone: 'tense',
        writingPov: 'first-person',
        writingLength: 'medium',
        contentMode: 'cinematic',
        protagonistFirstName: 'Ash',
        protagonistLastName: 'Voss'
      },
      [],
      undefined,
      'json',
      1,
      []
    );

    expect(prompt).toContain('RÔLE CANONIQUE IMMUTABLE');
    expect(prompt).toContain('"padawan"');
    expect(prompt).toContain('Padawan ≠ Chevalier/Maître');
  });
});
