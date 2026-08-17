import { describe, it, expect } from 'vitest';
import { buildContinuePrompt, buildStableSystemPrompt, buildSystemPrompt, buildTurnContextBlock, renderWorldDigest } from './prompts';
import { initWorldState } from './worldState';
import type { MemoryFact, StorySetup } from './types';

const setup: StorySetup = { era: 'imperial', faction: 'jedi', role: 'padawan', premise: 'x', language: 'fr' };

describe('player canon — keeps the player\'s stated constraints in context', () => {
  it('the continue prompt injects recent player directives as canon', () => {
    const prompt = buildContinuePrompt('Je négocie', 3, [], [], 'fr', '', [
      "Il n'y a pas de soldats sur ce marché"
    ]);
    expect(prompt).toContain('CANON DU JOUEUR');
    expect(prompt).toContain('pas de soldats');
  });

  it('the system prompt embeds the canon and the measured-escalation rule', () => {
    const sys = buildSystemPrompt(setup, [], initWorldState(setup), 3, ['Le marché reste calme, aucun trooper']);
    expect(sys).toContain('aucun trooper');
    expect(sys).toMatch(/CANON DU JOUEUR/);
    expect(sys).toMatch(/ESCALADE MESUR/i); // "ESCALADE MESURÉE & ÉCHELLE"
  });

  it('the system prompt enforces finite enemy forces (no infinite waves)', () => {
    const sys = buildSystemPrompt(setup, [], initWorldState(setup), 3);
    expect(sys).toMatch(/CONSÉQUENCES DURABLES/i);
    expect(sys).toMatch(/RESSOURCES FINIES/i);
    expect(sys).toMatch(/ne consigne JAMAIS une prédiction de menace/i);
  });

  it('the world digest surfaces the environment status to sub-agents', () => {
    const world = initWorldState(setup);
    world.environment_status = 'plus un soldat debout, la cour est jonchée de débris';
    const digest = renderWorldDigest(world);
    expect(digest).toContain('Environnement : plus un soldat debout');
  });

  it('the system prompt carries a campaign objective and forces meaningful tradeoffs', () => {
    const sys = buildSystemPrompt(setup, [], initWorldState(setup), 3);
    expect(sys).toMatch(/FIL ROUGE|OBJECTIF DE CAMPAGNE/i);
    expect(sys).toMatch(/choix.*coûts opposés|arbitrages/i);
  });

  it('no canon block when the player has stated nothing', () => {
    expect(buildContinuePrompt('Je cours', 2)).not.toContain('CANON DU JOUEUR');
  });
});

describe('stable prompt prefix (provider input cache)', () => {
  it('the stable system prompt does not vary with world state or memory', () => {
    const base = buildStableSystemPrompt(setup, 3);
    expect(base).toBe(buildStableSystemPrompt(setup, 5)); // same setup → identical prefix
    expect(base).toContain('RÈGLES');
    // Variable context blocks never leak into the stable prefix.
    expect(base).not.toContain('ÉTAT DU MONDE');
    expect(base).not.toContain('MÉMOIRE NARRATIVE');
    // The legacy wrapper still carries them (used by older callers/tests).
    const full = buildSystemPrompt(setup, [{ text: 'Vela alliée', category: 'relations', turn: 2 }], initWorldState(setup), 3);
    expect(full).toContain('Vela alliée');
  });

  it('the turn context block carries world, memory and archive into the final message', () => {
    const world = initWorldState(setup);
    world.player.location = 'Mos Eisley';
    const memory: MemoryFact[] = [{ text: 'Vela est une contrebandière', category: 'relations', turn: 2 }];
    const block = buildTurnContextBlock(setup, world, memory, ['Tour 1 : Ouverture']);
    expect(block).toContain('Mos Eisley');
    expect(block).toContain('contrebandière');
    expect(block).toContain('RÉSUMÉ DES TOURS ANCIENS');
    // The continue prompt embeds the context block before the action.
    const prompt = buildContinuePrompt('Je négocie', 3, [], [], 'fr', '', [], [], block);
    expect(prompt.indexOf('Mos Eisley')).toBeLessThan(prompt.indexOf('ACTION JOUEUR CANONIQUE'));
  });

  it('the campaign dossier rides the stable system prompt and codex rides the turn block', () => {
    const dossier = 'Sous l\'Empire, la Bordure Extérieure vit sous la loi martiale.';
    const stable = buildStableSystemPrompt(setup, 4, dossier);
    expect(stable).toContain('Bordure Extérieure');
    expect(stable).toContain('DOSSIER DE CAMPAGNE');
    const world = initWorldState(setup);
    const codexEntry = { id: 't', eras: ['imperial'], keywords: 'x', text: 'Taris est un monde-cité à étages.' };
    const block = buildTurnContextBlock(setup, world, [], [], [codexEntry]);
    expect(block).toContain('CODEX DE L\'ÉPOQUE');
    expect(block).toContain('contexte optionnel');
    expect(block).toContain('monde-cité');
  });
});
