/* ═══════════════════════════════════════════════
   Star Wars content catalog — eras, factions, roles,
   story seeds (trames), writing axes, presets.
══════════════════════════════════════════════ */
import type { SkillProfile, StoryAttribute, StorySetup } from '$lib/engine/types';

export interface CatalogItem {
  id: string;
  name: string;
  icon?: string;
}

export const ERAS: Array<CatalogItem & { years: string; backdrop: string }> = [
  { id: 'old_republic', name: 'Ancienne République', years: '25 000 – 1000 AVBY', icon: 'AncientRepublic.svg', backdrop: 'cosmic-nebula' },
  { id: 'clone_wars', name: 'Guerres des Clones', years: '22 – 19 AVBY', icon: 'jedi-order-svgrepo-com.svg', backdrop: 'city-dusk' },
  { id: 'imperial', name: 'Ère Impériale', years: '19 – 4 AVBY', icon: 'Emblem_of_the_First_Galactic_Empire.svg', backdrop: 'stormtroopers' },
  { id: 'new_republic', name: 'Nouvelle République', years: '4 – 28 APBY', icon: 'NR_Seal.svg', backdrop: 'city-night' },
  { id: 'first_order', name: 'Premier Ordre', years: '28 – 35 APBY', icon: 'Emblem_of_the_First_Order.svg', backdrop: 'starry-sky' }
];

export const ERA_CONTEXT: Record<string, string> = {
  old_republic: "Ancienne République — guerres mandaloriennes, Jedi au zénith, Sith encore tapis dans l'ombre.",
  clone_wars: 'Guerres des Clones — la galaxie se déchire, les Jedi deviennent généraux et Palpatine tisse son plan.',
  imperial: "Ère Impériale — l'Empire règne par la peur, les Jedi sont traqués et la Rébellion cherche des alliés.",
  new_republic: "Nouvelle République — l'Empire s'effondre, le pouvoir se reconstruit et les vieilles menaces persistent.",
  first_order: 'Premier Ordre — la République vacille, la Résistance survit et les fantômes de l\'Empire reviennent.'
};

export const ERA_START_DATES: Record<string, string> = {
  old_republic: '3950 AVBY, Jour 1',
  clone_wars: '22 AVBY, Jour 1',
  imperial: '19 AVBY, Jour 1',
  new_republic: '4 APBY, Jour 1',
  first_order: '34 APBY, Jour 1'
};

export const FACTIONS: Array<CatalogItem & { color: string }> = [
  { id: 'jedi', name: 'Ordre Jedi', color: '#7fb6a8', icon: 'jedi-order-svgrepo-com.svg' },
  { id: 'sith', name: 'Ordre Sith', color: '#c0504d', icon: 'starwars-sith-svgrepo-com.svg' },
  { id: 'empire', name: 'Empire Galactique', color: '#b0563f', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
  { id: 'rebels', name: 'Alliance Rebelle', color: '#d8b977', icon: 'millennium-falcon-svgrepo-com.svg' },
  { id: 'republic', name: 'République Galactique', color: '#6f9fc4', icon: 'brand-galactic-republic-svgrepo-com.svg' },
  { id: 'mandalore', name: 'Mandaloriens', color: '#9b8bbd', icon: 'mandalorian-svgrepo-com.svg' },
  { id: 'first_order', name: 'Premier Ordre', color: '#5a5f6e', icon: 'Emblem_of_the_First_Order.svg' },
  { id: 'hutt', name: 'Cartel Hutt', color: '#7faf7f', icon: 'Desilijic_clan_vector.svg' },
  { id: 'neutral', name: 'Indépendant', color: '#9aa0ac', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
];

export const ROLES: Array<CatalogItem & { faction: string }> = [
  { id: 'jedi_knight', name: 'Chevalier Jedi', faction: 'jedi', icon: 'luke-skywalker-lightsaber-svgrepo-com.svg' },
  { id: 'jedi_master', name: 'Maître Jedi', faction: 'jedi', icon: 'jedi-order-svgrepo-com.svg' },
  { id: 'padawan', name: 'Padawan', faction: 'jedi', icon: 'lightsaber-svgrepo-com.svg' },
  { id: 'sith_lord', name: 'Seigneur Sith', faction: 'sith', icon: 'SithEmblem-Traced-TORkit.svg' },
  { id: 'sith_apprentice', name: 'Apprenti Sith', faction: 'sith', icon: 'starwars-sith-svgrepo-com.svg' },
  { id: 'imperial_officer', name: 'Officier Impérial', faction: 'empire', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
  { id: 'stormtrooper', name: 'Stormtrooper', faction: 'empire', icon: 'noun-storm-trooper-49992.svg' },
  { id: 'rebel_pilot', name: 'Pilote Rebelle', faction: 'rebels', icon: 'millennium-falcon-svgrepo-com.svg' },
  { id: 'rebel_leader', name: 'Leader Rebelle', faction: 'rebels', icon: 'brand-galactic-republic-svgrepo-com.svg' },
  { id: 'senator', name: 'Sénateur', faction: 'republic', icon: 'brand-galactic-republic-svgrepo-com.svg' },
  { id: 'clone_trooper', name: 'Clone Trooper', faction: 'republic', icon: 'noun-storm-trooper-49992.svg' },
  { id: 'mandalorian_warrior', name: 'Guerrier Mandalorien', faction: 'mandalore', icon: 'mandalorian-svgrepo-com.svg' },
  { id: 'bounty_hunter', name: 'Chasseur de Primes', faction: 'neutral', icon: 'scifi-starwars-boba-fett-svgrepo-com.svg' },
  { id: 'smuggler', name: 'Contrebandier', faction: 'neutral', icon: 'millennium-falcon-svgrepo-com.svg' },
  { id: 'scavenger', name: 'Éclaireur', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' },
  { id: 'jedi_exile', name: 'Jedi Banni', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
];

// Starting credits per role id — one entry for every role in ROLES (grunts and
// apprentices at the bottom), plus a generic fallback. Keep in sync with ROLES.
export const FACTION_CREDITS: Record<string, number> = {
  senator: 5000, imperial_officer: 3000, sith_lord: 2500, bounty_hunter: 1500,
  mandalorian_warrior: 1200, sith_apprentice: 1000, rebel_leader: 900,
  jedi_master: 800, smuggler: 800, rebel_pilot: 600, jedi_knight: 500,
  scavenger: 300, stormtrooper: 300, clone_trooper: 300, jedi_exile: 300,
  padawan: 250, default: 1000
};

const ALL_ATTRIBUTES: StoryAttribute[] = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'];
const BASE_SKILLS: SkillProfile = {
  combat: 2, diplomacy: 2, stealth: 2, tech: 2, force: 2, survival: 2
};

const ROLE_SKILL_BONUSES: Record<string, Partial<SkillProfile>> = {
  jedi_knight: { combat: 1, force: 2, survival: 1 },
  jedi_master: { diplomacy: 1, combat: 1, force: 3 },
  padawan: { tech: 1, force: 2, survival: 1 },
  sith_lord: { combat: 2, force: 3, diplomacy: 1 },
  sith_apprentice: { combat: 1, stealth: 1, force: 2 },
  imperial_officer: { diplomacy: 2, tech: 1, survival: 1 },
  stormtrooper: { combat: 2, survival: 2 },
  rebel_pilot: { combat: 1, tech: 2, stealth: 1 },
  rebel_leader: { diplomacy: 3, survival: 1 },
  senator: { diplomacy: 3, tech: 1 },
  clone_trooper: { combat: 2, survival: 2 },
  mandalorian_warrior: { combat: 2, tech: 1, survival: 2 },
  bounty_hunter: { combat: 1, stealth: 2, tech: 1 },
  smuggler: { diplomacy: 1, stealth: 2, tech: 1 },
  scavenger: { stealth: 1, tech: 2, survival: 2 },
  jedi_exile: { combat: 1, stealth: 1, force: 2, survival: 1 }
};

const FACTION_SKILL_BONUSES: Record<string, Partial<SkillProfile>> = {
  jedi: { force: 1 }, sith: { force: 1 }, rebels: { stealth: 1 },
  empire: { diplomacy: 1 }, republic: { diplomacy: 1 }, mandalore: { combat: 1 },
  hutt: { diplomacy: 1 }
};

/** Derive a visible but compact aptitude profile from the chosen role and faction. */
export function deriveSkillProfile(setup: Pick<StorySetup, 'role' | 'faction'>): SkillProfile {
  const result = { ...BASE_SKILLS };
  for (const [attribute, bonus] of Object.entries(ROLE_SKILL_BONUSES[setup.role] ?? {})) {
    result[attribute as StoryAttribute] += bonus as number;
  }
  for (const [attribute, bonus] of Object.entries(FACTION_SKILL_BONUSES[setup.faction] ?? {})) {
    result[attribute as StoryAttribute] += bonus as number;
  }
  for (const attribute of ALL_ATTRIBUTES) result[attribute] = Math.max(1, Math.min(5, result[attribute]));
  return result;
}

export const TRAMES: Array<CatalogItem & { premise: string }> = [
  { id: 'solo', name: 'Le Solitaire', icon: '🚀', premise: "Un contrat de routine aux confins de la Bordure Extérieure tourne au désastre lorsqu'un conteneur scellé révèle un secret convoité par les plus dangereuses puissances de la galaxie." },
  { id: 'chosen', name: "L'Élu", icon: '✨', premise: "Un murmure persistant dans la Force trouble vos nuits et vous guide vers des ruines oubliées, éveillant une relique dont la lumière — ou l'ombre — pourrait sceller le destin d'un secteur entier." },
  { id: 'exile', name: 'Le Banni', icon: '🌑', premise: "Marqué par la honte et chassé de votre ancien ordre, vous dissimulez vos talents dans la crasse des bas-fonds d'une planète industrielle, jusqu'à ce que votre passé vous traque et vous accule." },
  { id: 'rebel', name: 'Le Résistant', icon: '⚡', premise: "Au cœur de l'occupation, sabotages et réunions clandestines forment votre quotidien. Mais le vol d'un transpondeur militaire crypté vous jette dans une traque spatiale impitoyable." },
  { id: 'redeemed', name: 'La Rédemption', icon: '🔥', premise: "Les cris de vos anciennes victimes hantent chacun de vos pas. Pour racheter vos fautes sous la bannière du Côté Obscur, vous vous jetez au secours d'un groupe de réfugiés pourchassés." },
  { id: 'spy', name: "L'Infiltrateur", icon: '🕵️', premise: "Sous une fausse identité au sein des rangs ennemis, chaque mensonge érode votre loyauté d'origine alors que l'heure de la trahison finale approche sous la menace d'une détection imminente." },
  { id: 'custom', name: 'Libre', icon: '✏️', premise: '' }
];

export const AVATARS = ['🧑‍🚀', '👩‍🚀', '🧙', '🧙‍♀️', '⚔️', '🤖', '👾', '🦾', '🌌', '💫', '🔵', '🔴'];

export const WRITING_STYLES: Array<CatalogItem & { desc: string }> = [
  { id: 'cinematique', name: 'Cinématique', desc: 'Scènes courtes, rythme intense, style film' },
  { id: 'litteraire', name: 'Littéraire', desc: 'Prose riche, descriptions profondes, introspection' },
  { id: 'epique', name: 'Épique', desc: 'Grandeur, batailles, destins héroïques' },
  { id: 'immersif', name: 'Immersif', desc: 'Style jeu de rôle, vous êtes le héros' }
];

export const WRITING_TONES: Array<CatalogItem & { desc: string }> = [
  { id: 'heroique', name: 'Héroïque', desc: 'Courage, sacrifice, lumière' },
  { id: 'sombre', name: 'Sombre', desc: 'Tension, danger, ambiguïté morale' },
  { id: 'aventure', name: 'Aventure', desc: 'Action, humour, légèreté' },
  { id: 'drame', name: 'Dramatique', desc: 'Émotions, relations, trahisons' }
];

export const WRITING_POVS: CatalogItem[] = [
  { id: 'premiere', name: '1ère personne — Je' },
  { id: 'troisieme', name: '3ème personne — Il/Elle' }
];

export const WRITING_LENGTHS: CatalogItem[] = [
  { id: 'court', name: 'Court' },
  { id: 'moyen', name: 'Moyen' },
  { id: 'long', name: 'Long' }
];

export const CONTENT_MODES: Array<CatalogItem & { desc: string }> = [
  { id: 'cinematic', name: 'Cinéma', icon: '🎬', desc: 'Intense mais équilibré. Adapté aux IA filtrées.' },
  { id: 'dark', name: 'Sombre', icon: '🌒', desc: 'Ambiance dure et tendue, sans gratuité.' },
  { id: 'adult', name: 'Adulte', icon: '🔞', desc: 'Mature et frontal, selon les limites du modèle.' },
  { id: 'raw', name: 'Brut', icon: '⚠️', desc: 'Très frontal et sans concession (si le modèle le permet).' }
];

export interface NarrativePreset extends CatalogItem {
  desc: string;
  writingStyle: string;
  writingTone: string;
  writingPov: string;
  writingLength: string;
  contentMode: string;
}

export const NARRATIVE_PRESETS: NarrativePreset[] = [
  { id: 'cinematic_hero', name: 'Cinématique héroïque', icon: '🎬', desc: 'Rythme de film, courage et panache. Le choix sûr.', writingStyle: 'cinematique', writingTone: 'heroique', writingPov: 'troisieme', writingLength: 'moyen', contentMode: 'cinematic' },
  { id: 'dark_saga', name: 'Saga sombre', icon: '🌒', desc: 'Prose dense, tension morale, enjeux lourds.', writingStyle: 'litteraire', writingTone: 'sombre', writingPov: 'troisieme', writingLength: 'long', contentMode: 'dark' },
  { id: 'pulp_adventure', name: 'Aventure pulp', icon: '⚡', desc: 'Action nerveuse, humour, légèreté.', writingStyle: 'cinematique', writingTone: 'aventure', writingPov: 'troisieme', writingLength: 'court', contentMode: 'cinematic' },
  { id: 'epic_legend', name: 'Légende épique', icon: '✨', desc: 'Souffle, grandes batailles, destins héroïques.', writingStyle: 'epique', writingTone: 'heroique', writingPov: 'troisieme', writingLength: 'long', contentMode: 'cinematic' },
  { id: 'immersive_rp', name: 'Immersif — tu es le héros', icon: '🕹️', desc: 'JdR à la 1ʳᵉ personne, drame intime.', writingStyle: 'immersif', writingTone: 'drame', writingPov: 'premiere', writingLength: 'moyen', contentMode: 'dark' }
];

export const DEFAULT_PREMISE = 'Un appel de détresse inattendu force votre protagoniste à agir immédiatement.';

export function defaultRoleForFaction(factionId: string): string {
  return ROLES.find((role) => role.faction === factionId)?.id || ROLES[0].id;
}

export function eraBackdrop(eraId: string): string {
  return ERAS.find((era) => era.id === eraId)?.backdrop || 'cosmic-darkness';
}

type WritingAxes = Pick<StorySetup, 'writingStyle' | 'writingTone' | 'writingPov' | 'writingLength' | 'contentMode'>;

export function findNarrativePreset(axes: WritingAxes): NarrativePreset | undefined {
  return NARRATIVE_PRESETS.find(
    (p) =>
      p.writingStyle === axes.writingStyle &&
      p.writingTone === axes.writingTone &&
      p.writingPov === axes.writingPov &&
      p.writingLength === axes.writingLength &&
      p.contentMode === axes.contentMode
  );
}

/** Single source of setup defaults — fills every missing field. */
export function withSetupDefaults(setup: Partial<StorySetup>, trameId?: string | null): StorySetup {
  const preset = NARRATIVE_PRESETS[0];
  const faction = setup.faction || FACTIONS[0].id;
  const trame = trameId ? TRAMES.find((t) => t.id === trameId) : undefined;
  return {
    era: setup.era || ERAS[0].id,
    faction,
    role: setup.role || defaultRoleForFaction(faction),
    premise: setup.premise || trame?.premise || DEFAULT_PREMISE,
    trameId: setup.trameId ?? trameId ?? undefined,
    protagonistFirstName: setup.protagonistFirstName || '',
    protagonistLastName: setup.protagonistLastName || '',
    protagonistAvatar: setup.protagonistAvatar || AVATARS[0],
    writingStyle: setup.writingStyle || preset.writingStyle,
    writingTone: setup.writingTone || preset.writingTone,
    writingPov: setup.writingPov || preset.writingPov,
    writingLength: setup.writingLength || preset.writingLength,
    contentMode: setup.contentMode || preset.contentMode,
    language: setup.language
  };
}
