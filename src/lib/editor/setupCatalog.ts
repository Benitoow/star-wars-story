export type SetupScreenId = 'era' | 'faction_role' | 'premise' | 'style' | 'profile' | 'review';

export type SetupScreen = {
  id: SetupScreenId;
  label: string;
  subtitle: string;
};

export const SETUP_SCREENS: SetupScreen[] = [
  { id: 'era', label: 'Ère', subtitle: 'Quand commence votre histoire ?' },
  { id: 'faction_role', label: 'Faction & rôle', subtitle: 'Qui êtes-vous dans cette galaxie ?' },
  { id: 'premise', label: 'Trame', subtitle: 'Quel est le point de départ ?' },
  { id: 'style', label: 'Style IA', subtitle: `Comment doit écrire l'IA ?` },
  { id: 'profile', label: 'Protagoniste', subtitle: 'Nom facultatif, avatar rapide' },
  { id: 'review', label: 'Lancement', subtitle: `On démarre l'aventure immédiatement` }
];

export const ERA_START_DATES: Record<string, string> = {
  old_republic: '3950 AVBY, Jour 1',
  clone_wars: '22 AVBY, Jour 1',
  imperial: '19 AVBY, Jour 1',
  new_republic: '4 APBY, Jour 1',
  first_order: '34 APBY, Jour 1'
};

export const FACTION_CREDITS: Record<string, number> = {
  imperial_officer: 3000,
  bounty_hunter: 1500,
  hutt_enforcer: 2000,
  smuggler: 800,
  rebel_pilot: 600,
  rebel_leader: 900,
  jedi_knight: 500,
  jedi_master: 800,
  sith_lord: 2500,
  sith_apprentice: 1000,
  mandalorian_warrior: 1200,
  senator: 5000,
  scavenger: 300,
  default: 1000
};

export const ERAS = [
  { id: 'old_republic', name: 'Ancienne République', years: '25 000 - 1000 AVBY', icon: 'AncientRepublic.svg' },
  { id: 'clone_wars', name: 'Guerres des Clones', years: '22 - 19 AVBY', icon: 'jedi-order-svgrepo-com.svg' },
  { id: 'imperial', name: 'Ère Impériale', years: '19 - 4 AVBY', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
  { id: 'new_republic', name: 'Nouvelle République', years: '4 - 28 APBY', icon: 'NR_Seal.svg' },
  { id: 'first_order', name: 'Premier Ordre', years: '28 - 35 APBY', icon: 'Emblem_of_the_First_Order.svg' }
];

export const FACTIONS = [
  { id: 'jedi', name: 'Ordre Jedi', color: '#4ec9b0', icon: 'jedi-order-svgrepo-com.svg' },
  { id: 'sith', name: 'Ordre Sith', color: '#e51414', icon: 'starwars-sith-svgrepo-com.svg' },
  { id: 'empire', name: 'Empire Galactique', color: '#c41e3a', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
  { id: 'rebels', name: 'Alliance Rebelle', color: '#f39c12', icon: 'millennium-falcon-svgrepo-com.svg' },
  { id: 'republic', name: 'République Galactique', color: '#3498db', icon: 'brand-galactic-republic-svgrepo-com.svg' },
  { id: 'mandalore', name: 'Mandaloriens', color: '#9b59b6', icon: 'mandalorian-svgrepo-com.svg' },
  { id: 'first_order', name: 'Premier Ordre', color: '#1a1a2e', icon: 'Emblem_of_the_First_Order.svg' },
  { id: 'hutt', name: 'Cartel Hutt', color: '#27ae60', icon: 'Desilijic_clan_vector.svg' },
  { id: 'neutral', name: 'Indépendant', color: '#95a5a6', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
];

export const ROLES = [
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
  { id: 'first_order_trooper', name: 'Soldat du Premier Ordre', faction: 'first_order', icon: 'Emblem_of_the_First_Order.svg' },
  { id: 'resistance_member', name: 'Membre de la Résistance', faction: 'rebels', icon: 'millennium-falcon-svgrepo-com.svg' },
  { id: 'hutt_enforcer', name: 'Main du Hutt', faction: 'hutt', icon: 'Desilijic_clan_vector.svg' },
  { id: 'bounty_hunter', name: 'Chasseur de Primes', faction: 'neutral', icon: 'scifi-starwars-boba-fett-svgrepo-com.svg' },
  { id: 'smuggler', name: 'Contrebandier', faction: 'neutral', icon: 'millennium-falcon-svgrepo-com.svg' },
  { id: 'scavenger', name: 'Éclaireur', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' },
  { id: 'force_sensitive', name: 'Sensible à la Force', faction: 'neutral', icon: 'lightsaber-svgrepo-com.svg' },
  { id: 'jedi_exile', name: 'Jedi Banni', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
];

export const TRAMES = [
  {
    id: 'solo',
    name: 'Le Solitaire',
    icon: '🚀',
    premise: `Vous acceptez un contrat en apparence simple, mais il vous entraîne dans un conflit galactique majeur.`
  },
  {
    id: 'chosen',
    name: "L'Élu",
    icon: '✨',
    premise: `Une intuition de la Force vous pousse sur une piste que personne ne comprend encore.`
  },
  {
    id: 'exile',
    name: 'Le Banni',
    icon: '🌑',
    premise: `Exilé après un incident obscur, vous survivez dans l'ombre jusqu'au jour où tout bascule.`
  },
  {
    id: 'rebel',
    name: 'Le Résistant',
    icon: '⚡',
    premise: `Vous combattez l'oppresseur et découvrez un enjeu plus grand que votre vengeance.`
  },
  {
    id: 'redeemed',
    name: 'La Rédemption',
    icon: '🔥',
    premise: `Ancien serviteur de l'Obscur, vous tentez de réparer ce qui peut encore l'être.`
  },
  {
    id: 'spy',
    name: "L'Infiltrateur",
    icon: '🕵️',
    premise: `Votre mission d'infiltration brouille progressivement la frontière entre vos deux identités.`
  },
  { id: 'custom', name: 'Libre', icon: '✏️', premise: '' }
];

export const AVATARS = ['🧑‍🚀', '👩‍🚀', '🧙', '🧙‍♀️', '⚔️', '🤖', '👾', '🦾', '🌌', '💫', '🔵', '🔴'];

export const WRITING_STYLES = [
  { id: 'cinematique', name: 'Cinématique', desc: 'Scènes courtes, rythme intense, style film' },
  { id: 'litteraire', name: 'Littéraire', desc: 'Prose riche, descriptions profondes, introspection' },
  { id: 'epique', name: 'Épique', desc: 'Grandeur, batailles, destins héroïques' },
  { id: 'immersif', name: 'Immersif', desc: '2ème personne, style jeu de rôle, vous êtes le héros' }
];

export const WRITING_TONES = [
  { id: 'heroique', name: 'Héroïque', desc: 'Courage, sacrifice, lumière' },
  { id: 'sombre', name: 'Sombre', desc: 'Tension, danger, ambiguïté morale' },
  { id: 'aventure', name: 'Aventure', desc: 'Action, humour, légèreté' },
  { id: 'drame', name: 'Dramatique', desc: 'Émotions, relations, trahisons' }
];

export const WRITING_POVS = [
  { id: 'premiere', name: '1ère personne — Je' },
  { id: 'troisieme', name: '3ème personne — Il/Elle' }
];

export const WRITING_LENGTHS = [
  { id: 'court', name: 'Court' },
  { id: 'moyen', name: 'Moyen' },
  { id: 'long', name: 'Long' }
];

export const CONTENT_MODES = [
  { id: 'cinematic', icon: '🎬', name: 'Cinéma', desc: 'Intense mais équilibré. Adapté aux IA filtrées.' },
  { id: 'dark', icon: '🌒', name: 'Sombre', desc: 'Ambiance dure et tendue, sans gratuité excessive.' },
  { id: 'adult', icon: '🔞', name: 'Adulte', desc: 'Mature et frontal, selon les limites du provider choisi.' },
  { id: 'raw', icon: '⚠️', name: 'Brut', desc: 'Très frontal et sans concession (quand le modèle le permet).' }
];

export function defaultRoleForFaction(factionId: string): string {
  return ROLES.find(role => role.faction === factionId)?.id || ROLES[0].id;
}
