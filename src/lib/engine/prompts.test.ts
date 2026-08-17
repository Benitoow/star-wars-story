import { describe, it, expect } from 'vitest';
import { buildContinuePrompt, buildSystemPrompt, renderWorldDigest } from './prompts';
import { initWorldState } from './worldState';
import type { StorySetup } from './types';

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
