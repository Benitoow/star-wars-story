/* Hidden dice roll. The player never sees the number — the outcome is folded
   into a directive that biases how the GM narrates the consequence. */
import type { StoryChoice } from './types';

export type Outcome = 'critical' | 'success' | 'partial' | 'failure';

export interface RollResult {
  outcome: Outcome;
  roll: number;
  dc: number;
  directive: string;
}

const DIRECTIVES: Record<Outcome, string> = {
  critical: 'RÉSULTAT (caché — ne révèle jamais le jet) : RÉUSSITE ÉCLATANTE — la tentative réussit au-delà des espérances, avec un avantage inattendu.',
  success: 'RÉSULTAT (caché — ne révèle jamais le jet) : RÉUSSITE — la tentative aboutit, mais le monde réagit en conséquence.',
  partial: 'RÉSULTAT (caché — ne révèle jamais le jet) : SUCCÈS PARTIEL — la tentative avance, mais à un prix concret ou avec un imprévu.',
  failure: 'RÉSULTAT (caché — ne révèle jamais le jet) : ÉCHEC — la tentative échoue et déclenche une complication sérieuse (coût, blessure, perte ou escalade).'
};

/** Roll a d20 against a difficulty-derived DC and resolve the outcome. */
export function rollForChoice(choice: Pick<StoryChoice, 'difficulty'>, rng: () => number = Math.random): RollResult {
  const roll = 1 + Math.floor(rng() * 20);
  const difficulty = Math.max(1, Math.min(5, choice.difficulty || 3));
  const dc = 6 + difficulty * 3; // difficulty 1 → DC 9 … difficulty 5 → DC 21
  const margin = roll - dc;

  let outcome: Outcome;
  if (roll === 20 || margin >= 6) outcome = 'critical';
  else if (margin >= 0) outcome = 'success';
  else if (roll === 1 || margin <= -6) outcome = 'failure';
  else outcome = 'partial';

  return { outcome, roll, dc, directive: DIRECTIVES[outcome] };
}
