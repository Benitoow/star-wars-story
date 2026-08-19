/* ═══════════════════════════════════════════════
   Lore surfaced in the creation wizard: what each faction
   and role actually is, and which factions plausibly exist
   in a given era. The catalog held ids and names only, so
   the wizard let players build combinations the engine then
   spent every turn fighting (an Ordre Jedi hero under the
   First Order, a Galactic Empire officer 4000 years early).
══════════════════════════════════════════════ */

/** How natural a faction is in an era. `absent` means it does not exist yet, or no longer does. */
export type EraFit = 'canon' | 'rare' | 'absent';

export interface FitVerdict {
  fit: EraFit;
  reason: string;
}

export const FACTION_DESC: Record<string, string> = {
  jedi: 'Gardiens de la paix, sensibles à la Force, liés par un code exigeant.',
  sith: "L'ordre du Côté Obscur — puissance, ambition, trahison rituelle.",
  empire: "Machine militaire et administrative qui gouverne par la peur.",
  rebels: 'Cellules dispersées, moyens réduits, convictions intactes.',
  republic: 'La démocratie galactique, ses sénats, ses lenteurs et ses idéaux.',
  mandalore: "Clans guerriers, armures héritées, honneur avant tout.",
  first_order: "Héritier de l'Empire, né en secret dans les Régions Inconnues.",
  hutt: 'Cartels criminels : contrebande, dettes, protections achetées.',
  neutral: 'Aucune allégeance — seulement tes propres comptes à régler.'
};

export const ROLE_DESC: Record<string, string> = {
  jedi_knight: 'Sabre et Force au service des autres. On attend beaucoup de toi.',
  jedi_master: "Des années d'enseignement derrière toi, et le poids qui va avec.",
  padawan: "Doué, incomplet, et pressé de le prouver.",
  sith_lord: 'Tu commandes par la terreur, et tu surveilles tes arrières.',
  sith_apprentice: 'Tu obéis en attendant de pouvoir frapper.',
  imperial_officer: 'Ton uniforme ouvre les portes — et te désigne comme cible.',
  stormtrooper: 'Sous le casque, un matricule. Et quelqu\'un qui commence à douter.',
  rebel_pilot: 'Un chasseur fatigué, des camarades, et très peu de marge.',
  rebel_leader: 'On te suit. C\'est aussi ce qui te condamne si tu te trompes.',
  senator: 'Influence, budget, réseaux — et une cible dans le dos.',
  clone_trooper: 'Entraîné pour obéir. Restent ta mémoire et tes frères d\'armes.',
  mandalorian_warrior: "Ton armure vaut une fortune et raconte ton clan.",
  bounty_hunter: 'Tu livres les gens. Tu as arrêté de demander pourquoi.',
  smuggler: 'Un vaisseau, des dettes, et un talent pour les sorties de secours.',
  scavenger: 'Tu survis là où les autres passent. Tu répares tout.',
  jedi_exile: 'Tu connais la Force et tu la caches. Ton passé te cherche.'
};

/** Factions that naturally belong to each era. */
const ERA_CANON: Record<string, string[]> = {
  old_republic: ['jedi', 'sith', 'republic', 'mandalore', 'hutt', 'neutral'],
  clone_wars: ['jedi', 'republic', 'mandalore', 'hutt', 'neutral'],
  imperial: ['empire', 'rebels', 'sith', 'hutt', 'mandalore', 'neutral'],
  new_republic: ['republic', 'mandalore', 'hutt', 'neutral'],
  first_order: ['first_order', 'rebels', 'mandalore', 'hutt', 'neutral']
};

/** Factions that can appear, but need a reason — shown to the player as a nuance. */
const ERA_RARE: Record<string, Record<string, string>> = {
  clone_wars: { sith: 'Les Sith agissent dans l\'ombre — personne ne sait qu\'ils sont revenus.' },
  imperial: { jedi: "L'Ordre est détruit ; tu es un survivant traqué." },
  new_republic: {
    jedi: 'Luke reconstruit un ordre fragile — vous êtes une poignée.',
    rebels: "L'Alliance est devenue la République ; il reste des irréductibles.",
    empire: 'Des restes impériaux survivent, en fuite vers les Régions Inconnues.',
    first_order: 'Il se forme en secret — presque personne ne connaît son nom.'
  },
  first_order: {
    jedi: 'Rey et Luke — l\'ordre tient à un fil.',
    sith: 'Palpatine revient dans l\'ombre d\'Exegol.',
    republic: 'La République vacille et sera bientôt décapitée.'
  }
};

/** Why a faction simply cannot be there. */
const ERA_ABSENT_REASON: Record<string, Record<string, string>> = {
  old_republic: {
    empire: "L'Empire galactique naîtra dans près de 4 000 ans.",
    rebels: "L'Alliance Rebelle n'existera que bien plus tard.",
    first_order: "Le Premier Ordre n'existera que bien plus tard."
  },
  clone_wars: {
    empire: "L'Empire ne sera proclamé qu'à la fin de cette guerre.",
    rebels: "L'Alliance Rebelle naîtra sous l'Empire.",
    first_order: "Le Premier Ordre n'existe pas encore."
  },
  imperial: {
    republic: 'La République a été dissoute lors de la proclamation de l\'Empire.',
    first_order: "Le Premier Ordre n'existe pas encore."
  },
  new_republic: { sith: 'Les Sith sont éteints — leur retour est encore un secret.' },
  first_order: { empire: "L'Empire est tombé à Endor et Jakku." }
};

/** How well a faction fits an era, with a sentence the wizard can show. */
export function eraFit(era: string, faction: string): FitVerdict {
  if (ERA_CANON[era]?.includes(faction)) return { fit: 'canon', reason: '' };
  const rare = ERA_RARE[era]?.[faction];
  if (rare) return { fit: 'rare', reason: rare };
  const absent = ERA_ABSENT_REASON[era]?.[faction];
  if (absent) return { fit: 'absent', reason: absent };
  // Unknown era or unlisted pairing: never block the player on missing data.
  return { fit: 'canon', reason: '' };
}

export const SKILL_LABELS: Record<string, string> = {
  combat: 'Combat',
  diplomacy: 'Diplomatie',
  stealth: 'Furtivité',
  tech: 'Technologie',
  force: 'Force',
  survival: 'Survie'
};
