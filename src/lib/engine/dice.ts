/* Hidden dice roll. The player never sees the number — the outcome is folded
   into a directive that biases how the GM narrates the consequence. */
import type { StoryChoice } from './types';

export type Outcome = 'critical' | 'success' | 'partial' | 'failure';

export interface RollResult {
  outcome: Outcome;
  roll: number;
  dc: number;
  bonus: number;
  total: number;
  directive: string;
}

export type ChoiceRisk = 'low' | 'medium' | 'high';

const DIRECTIVES: Record<Outcome, string> = {
  critical: 'RÉSULTAT (caché — ne révèle jamais le jet) : RÉUSSITE ÉCLATANTE — la tentative réussit au-delà des espérances, avec un avantage inattendu.',
  success: 'RÉSULTAT (caché — ne révèle jamais le jet) : RÉUSSITE — la tentative aboutit, mais le monde réagit en conséquence.',
  partial: 'RÉSULTAT (caché — ne révèle jamais le jet) : SUCCÈS PARTIEL — la tentative avance, mais à un prix concret ou avec un imprévu.',
  failure: 'RÉSULTAT (caché — ne révèle jamais le jet) : ÉCHEC — la tentative échoue et déclenche une complication sérieuse (coût, blessure, perte ou escalade).'
};

/** Roll a d20 against a difficulty-derived DC and resolve the outcome.
 * The second argument remains backwards-compatible with the old RNG-only API.
 */
export function rollForChoice(
  choice: Pick<StoryChoice, 'difficulty'>,
  skillBonusOrRng: number | (() => number) = 0,
  maybeRng: () => number = Math.random
): RollResult {
  const skillBonus = typeof skillBonusOrRng === 'function' ? 0 : Math.max(-2, Math.min(4, Math.round(skillBonusOrRng)));
  const rng = typeof skillBonusOrRng === 'function' ? skillBonusOrRng : maybeRng;
  const roll = 1 + Math.floor(rng() * 20);
  const difficulty = Math.max(1, Math.min(5, choice.difficulty || 3));
  // DC 7 / 9 / 11 / 13 / 15. A competent character succeeds at simple tasks
  // reliably, while a specialist still needs a good roll for a heroic feat.
  const dc = 5 + difficulty * 2;
  const total = roll + skillBonus;
  const margin = total - dc;

  let outcome: Outcome;
  if (roll === 20 || margin >= 6) outcome = 'critical';
  else if (roll === 1 || margin <= -6) outcome = 'failure';
  else if (margin >= 0) outcome = 'success';
  else outcome = 'partial';

  return { outcome, roll, dc, bonus: skillBonus, total, directive: DIRECTIVES[outcome] };
}

/** Convert the character's aptitude and the scene difficulty into a readable risk. */
export function choiceRisk(
  choice: Pick<StoryChoice, 'difficulty'>,
  skillScore = 2,
  hasRequiredItems = true
): ChoiceRisk {
  if (!hasRequiredItems) return 'high';
  const skill = Math.max(1, Math.min(5, skillScore));
  const advantage = skill - choice.difficulty;
  if (advantage >= 1) return 'low';
  if (advantage <= -2) return 'high';
  return 'medium';
}
