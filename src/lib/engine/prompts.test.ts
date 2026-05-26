import { describe, it, expect } from 'vitest';
import { buildContinuePrompt, buildSystemPrompt } from './prompts';
import { initWorldState } from './worldState';
import type { StorySetup } from './types';

const setup: StorySetup = { era: 'imperial', faction: 'jedi', role: 'padawan', premise: 'x', language: 'fr' };

describe('player canon — keeps the player\'s stated constraints in context', () => {
  it('the continue prompt injects recent player directives as canon', () => {
    const prompt = buildContinuePrompt('Je négocie', 3, [], [], [], 'fr', '', [
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

  it('no canon block when the player has stated nothing', () => {
    expect(buildContinuePrompt('Je cours', 2)).not.toContain('CANON DU JOUEUR');
  });
});
