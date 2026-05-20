import type { PlayerState, StoryAttribute, StoryChoice } from '$lib/ai/storyEngine';

export type ChoiceVerdict = 'success' | 'partial' | 'failure';

export interface ChoiceResolutionContext {
  role: string;
  situationPenalty: number; // extra effective difficulty from world state (0..2)
}

export interface ChoiceResolution {
  verdict: ChoiceVerdict;
}

// Hidden, per-role attribute proficiencies. The roll is never shown to the player;
// these only bias the verdict the writer is told to respect.
export const ROLE_ATTRIBUTE_PROFILE: Record<string, Partial<Record<StoryAttribute, number>>> = {
  jedi_knight: { force: 4, combat: 3, diplomacy: 1 },
  jedi_master: { force: 5, combat: 2, diplomacy: 3 },
  padawan: { force: 2, combat: 1, survival: 1 },
  sith_lord: { force: 5, combat: 3, stealth: 1 },
  sith_apprentice: { force: 3, combat: 2 },
  imperial_officer: { diplomacy: 3, tech: 2, combat: 1 },
  stormtrooper: { combat: 3, survival: 1 },
  rebel_pilot: { tech: 3, combat: 2, survival: 1 },
  rebel_leader: { diplomacy: 4, combat: 1, survival: 1 },
  senator: { diplomacy: 5, tech: 1 },
  clone_trooper: { combat: 3, tech: 1, survival: 2 },
  mandalorian_warrior: { combat: 4, survival: 3, tech: 2, stealth: 1 },
  first_order_trooper: { combat: 3, tech: 1 },
  resistance_member: { combat: 2, diplomacy: 1, survival: 1 },
  hutt_enforcer: { combat: 3, diplomacy: 1, stealth: 1 },
  bounty_hunter: { combat: 3, stealth: 3, survival: 3, tech: 1 },
  smuggler: { stealth: 3, diplomacy: 2, tech: 2, survival: 1 },
  scavenger: { survival: 4, stealth: 2, tech: 2 },
  force_sensitive: { force: 3, survival: 1 },
  jedi_exile: { force: 3, combat: 2, survival: 2 }
};

const DIFFICULTY_DC: Record<number, number> = { 1: 8, 2: 10, 3: 12, 4: 15, 5: 18, 6: 21 };

export function difficultyToDc(difficulty: number): number {
  const clamped = Math.max(1, Math.min(6, Math.round(difficulty) || 1));
  return DIFFICULTY_DC[clamped];
}

export function roleAttributeModifier(role: string, attribute: StoryAttribute): number {
  return ROLE_ATTRIBUTE_PROFILE[role]?.[attribute] ?? 0;
}

// Extra effective difficulty derived from the player's current condition.
// Single source of truth shared by the UI hint and the hidden roll.
export function situationalDifficultyPenalty(
  choice: StoryChoice,
  player: Pick<PlayerState, 'hp' | 'injuries'>
): number {
  const critical = player.hp < 20;
  const heavyInjury = player.injuries.some(injury => injury.severity === 'severe');

  if (critical && (choice.attribute === 'combat' || choice.attribute === 'force')) return 2;
  if (heavyInjury && (choice.attribute === 'combat' || choice.attribute === 'stealth')) return 1;
  return 0;
}

// d20 + role modifier vs a DC derived from (difficulty + situation). Natural 1/20 override.
export function resolveChoiceOutcome(
  choice: StoryChoice,
  ctx: ChoiceResolutionContext,
  rng: () => number = Math.random
): ChoiceResolution {
  const roll = 1 + Math.floor(Math.max(0, Math.min(0.9999999, rng())) * 20);
  if (roll >= 20) return { verdict: 'success' };
  if (roll <= 1) return { verdict: 'failure' };

  const modifier = roleAttributeModifier(ctx.role, choice.attribute);
  const effectiveDifficulty = Math.max(
    1,
    Math.min(6, (Math.round(choice.difficulty) || 1) + Math.max(0, ctx.situationPenalty || 0))
  );
  const dc = difficultyToDc(effectiveDifficulty);
  const total = roll + modifier;

  if (total >= dc) return { verdict: 'success' };
  if (total >= dc - 4) return { verdict: 'partial' };
  return { verdict: 'failure' };
}

const OUTCOME_DIRECTIVES: Record<ChoiceVerdict, string> = {
  success:
    "RÉSULTAT IMPOSÉ: l'action du joueur RÉUSSIT clairement. Montre une conséquence positive concrète, sans facilité gratuite.",
  partial:
    "RÉSULTAT IMPOSÉ: réussite PARTIELLE — l'action aboutit mais à un coût, un imprévu ou une complication concrète.",
  failure:
    "RÉSULTAT IMPOSÉ: ÉCHEC — l'action échoue ou se retourne contre le joueur. Montre un coût concret (blessure, perte, dette, danger accru) sans annuler la tentative ni la rejouer."
};

export function buildOutcomeDirective(verdict: ChoiceVerdict): string {
  return OUTCOME_DIRECTIVES[verdict];
}
