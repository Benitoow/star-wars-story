/* ═══════════════════════════════════════════════════════════════════
   Star Wars Story Assets — SVG Icons & Story Choices Configuration
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Faction Emblems ──────────────────────────────────────────────
   Used for: Faction selection in story setup
   Each faction has: id, name, icon SVG path, color */
export const FACTIONS = [
  {
    id: 'jedi',
    name: 'Ordre Jedi',
    icon: 'jedi-order-svgrepo-com.svg',
    color: '#4ec9b0',
    description: 'Gardiens de la paix et de la justice dans la galaxie'
  },
  {
    id: 'sith',
    name: 'Ordre Sith',
    icon: 'starwars-sith-svgrepo-com.svg',
    color: '#e51414',
    description: 'Maîtres du côté obscur de la Force'
  },
  {
    id: 'empire',
    name: 'Empire Galactique',
    icon: 'Emblem_of_the_First_Galactic_Empire.svg',
    color: '#c41e3a',
    description: 'Le pouvoir autoproclamé de la galaxie'
  },
  {
    id: 'republic',
    name: 'République Galactique',
    icon: 'brand-galactic-republic-svgrepo-com.svg',
    color: '#3498db',
    description: 'Démocratie millénaire maintenant en péril'
  },
  {
    id: 'first_order',
    name: 'Premier Ordre',
    icon: 'Emblem_of_the_First_Order.svg',
    color: '#1a1a2e',
    description: 'Successeur de l Empire, surgit des cendres'
  },
  {
    id: 'mandalore',
    name: 'Mandaloriens',
    icon: 'mandalorian-svgrepo-com.svg',
    color: '#9b59b6',
    description: 'Guerrriers redoutables, enfants de Mandalore'
  },
  {
    id: 'hutt',
    name: 'Cartel Hutt',
    icon: 'Desilijic_clan_vector.svg',
    color: '#27ae60',
    description: 'Seigneurs du crime et du commerce Spatial'
  },
  {
    id: 'rebels',
    name: 'Alliance Rebelle',
    icon: 'brand-galactic-republic-svgrepo-com.svg', // TODO: Create rebel-specific icon
    color: '#f39c12',
    description: 'Combattants pour la liberté contre l oppression'
  },
  {
    id: 'neutral',
    name: 'Indépendant',
    icon: 'alone-characterized-embodied-svgrepo-com.svg',
    color: '#95a5a6',
    description: 'Ni Jedi ni Sith, libre de toute allégeance'
  }
];

/* ─── Roles/Characters ──────────────────────────────────────────────
   Used for: Character selection in story setup
   Each role has: id, name, faction, icon, attributes */
export const ROLES = [
  // Jedi Roles
  {
    id: 'jedi_knight',
    name: 'Chevalier Jedi',
    faction: 'jedi',
    icon: 'luke-skywalker-lightsaber-svgrepo-com.svg',
    attributes: {
      force: 85,
      combat: 70,
      diplomacy: 65,
      survival: 50,
      stealth: 40,
      intelligence: 75
    },
    skills: ['Sabres laser', 'Force', 'Diplomatie', 'Stratégie']
  },
  {
    id: 'jedi_master',
    name: 'Maître Jedi',
    faction: 'jedi',
    icon: 'luke-skywalker-lightsaber-svgrepo-com.svg',
    attributes: {
      force: 95,
      combat: 80,
      diplomacy: 85,
      survival: 60,
      stealth: 30,
      intelligence: 90
    },
    skills: ['Maîtrise de la Force', 'Combat', 'Sagesse', 'Guérison']
  },
  {
    id: 'padawan',
    name: 'Padawan',
    faction: 'jedi',
    icon: 'jedi-order-svgrepo-com.svg',
    attributes: {
      force: 50,
      combat: 45,
      diplomacy: 55,
      survival: 40,
      stealth: 50,
      intelligence: 60
    },
    skills: ['Apprentissage', 'Sabre laser', 'Curiosité', 'Athlétisme']
  },
  
  // Sith Roles
  {
    id: 'sith_lord',
    name: 'Seigneur Sith',
    faction: 'sith',
    icon: 'lightsaber-svgrepo-com.svg',
    attributes: {
      force: 95,
      combat: 85,
      diplomacy: 40,
      survival: 65,
      stealth: 50,
      intelligence: 85
    },
    skills: ['Coté Obscur', 'Manipulation', 'Combat', 'Terreur']
  },
  {
    id: 'sith_apprentice',
    name: 'Apprenti Sith',
    faction: 'sith',
    icon: 'lightsaber-svgrepo-com.svg',
    attributes: {
      force: 65,
      combat: 60,
      diplomacy: 35,
      survival: 55,
      stealth: 55,
      intelligence: 70
    },
    skills: ['Force', 'Sabre laser', 'Ambition', 'Ruse']
  },
  
  // Imperial Roles
  {
    id: 'imperial_officer',
    name: 'Officier Impérial',
    faction: 'empire',
    icon: 'noun-storm-trooper-49992.svg',
    attributes: {
      force: 30,
      combat: 60,
      diplomacy: 70,
      survival: 55,
      stealth: 35,
      intelligence: 80
    },
    skills: ['Tactique', 'Commandement', 'Politique', 'Efficacité']
  },
  {
    id: 'stormtrooper',
    name: 'Stormtrooper',
    faction: 'empire',
    icon: 'noun-storm-trooper-49992.svg',
    attributes: {
      force: 25,
      combat: 70,
      diplomacy: 20,
      survival: 50,
      stealth: 40,
      intelligence: 45
    },
    skills: ['Combat', 'Discipline', 'Tir', 'Loyauté']
  },
  
  // Republic Roles
  {
    id: 'senator',
    name: 'Sénateur',
    faction: 'republic',
    icon: 'brand-galactic-republic-svgrepo-com.svg',
    attributes: {
      force: 20,
      combat: 25,
      diplomacy: 95,
      survival: 40,
      stealth: 30,
      intelligence: 90
    },
    skills: ['Rhétorique', 'Négociation', 'Réseau', 'Influence']
  },
  {
    id: 'clone_trooper',
    name: 'Clone Trooper',
    faction: 'republic',
    icon: 'noun-storm-trooper-49992.svg',
    attributes: {
      force: 30,
      combat: 80,
      diplomacy: 35,
      survival: 60,
      stealth: 35,
      intelligence: 55
    },
    skills: ['Combat', 'Stratégie', 'Loyauté', 'Endurance']
  },
  
  // Mandalorian Roles
  {
    id: 'mandalorian_warrior',
    name: 'Guerrier Mandalorien',
    faction: 'mandalore',
    icon: 'mandalorian-svgrepo-com.svg',
    attributes: {
      force: 40,
      combat: 90,
      diplomacy: 45,
      survival: 85,
      stealth: 60,
      intelligence: 65
    },
    skills: ['Combat', 'Survie', 'Jetpack', 'Honorables']
  },
  
  // Bounty Hunter / Neutral Roles
  {
    id: 'bounty_hunter',
    name: 'Chasseur de Primes',
    faction: 'neutral',
    icon: 'scifi-starwars-boba-fett-svgrepo-com.svg',
    attributes: {
      force: 35,
      combat: 85,
      diplomacy: 40,
      survival: 75,
      stealth: 70,
      intelligence: 75
    },
    skills: ['Pistage', 'Combat', 'Armement', 'Survie']
  },
  {
    id: 'smuggler',
    name: 'Contrebandier',
    faction: 'neutral',
    icon: 'millennium-falcon-svgrepo-com.svg',
    attributes: {
      force: 25,
      combat: 55,
      diplomacy: 65,
      survival: 70,
      stealth: 80,
      intelligence: 70
    },
    skills: ['Commerce', 'Pilotage', 'Ruse', 'Réseau']
  },
  {
    id: 'scavenger',
    name: 'Éclaireur',
    faction: 'neutral',
    icon: 'alone-characterized-embodied-svgrepo-com.svg',
    attributes: {
      force: 30,
      combat: 50,
      diplomacy: 45,
      survival: 90,
      stealth: 75,
      intelligence: 60
    },
    skills: ['Survie', 'Exploration', 'Adaptation', 'Discrétion']
  },
  {
    id: 'force_sensitive',
    name: 'Sensible à la Force',
    faction: 'neutral',
    icon: 'lightsaber-svgrepo-com.svg',
    attributes: {
      force: 60,
      combat: 45,
      diplomacy: 50,
      survival: 55,
      stealth: 60,
      intelligence: 65
    },
    skills: ['Force', 'Intuition', 'Perception', 'Potentiel']
  },
  
  // First Order Roles
  {
    id: 'first_order_trooper',
    name: 'Soldat du Premier Ordre',
    faction: 'first_order',
    icon: 'Emblem_of_the_First_Order.svg',
    attributes: {
      force: 25,
      combat: 75,
      diplomacy: 25,
      survival: 55,
      stealth: 45,
      intelligence: 50
    },
    skills: ['Combat', 'Discipline', 'Technologie', 'Loyauté']
  },
  
  // Resistance / Rebel Roles
  {
    id: 'resistance_member',
    name: 'Membre de la Résistance',
    faction: 'rebels',
    icon: 'millennium-falcon-svgrepo-com.svg',
    attributes: {
      force: 35,
      combat: 65,
      diplomacy: 60,
      survival: 65,
      stealth: 55,
      intelligence: 70
    },
    skills: ['Guérilla', 'Pilotage', 'Espionnage', 'Détermination']
  },
  
  // Hutt Cartel Roles
  {
    id: 'hutt_enforcer',
    name: 'Main du Hutt',
    faction: 'hutt',
    icon: 'Desilijic_clan_vector.svg',
    attributes: {
      force: 50,
      combat: 70,
      diplomacy: 55,
      survival: 75,
      stealth: 45,
      intelligence: 65
    },
    skills: ['Intimidation', 'Commerce', 'Combat', 'Réseau']
  },
  
  // Jedi Exile
  {
    id: 'jedi_exile',
    name: 'Jedi Banni',
    faction: 'neutral',
    icon: 'luke-skywalker-lightsaber-svgrepo-com.svg',
    attributes: {
      force: 70,
      combat: 60,
      diplomacy: 45,
      survival: 65,
      stealth: 55,
      intelligence: 75
    },
    skills: ['Force', 'Héritage Jedi', 'Adaptation', 'Méditation']
  }
];

/* ─── Ships (Story Choice Elements) ─────────────────────────────────
   Used for: Story moments, action sequences, travel choices */
export const SHIPS = [
  {
    id: 'millennium_falcon',
    name: 'Faucon Millenium',
    icon: 'millennium-falcon-svgrepo-com.svg',
    description: 'Le cargo le plus rapide de la galaxie',
    capabilities: ['Hyperspace', 'Combat', 'Contrebande', 'Évasion']
  },
  {
    id: 'xwing',
    name: 'X-Wing',
    icon: 'noun-storm-trooper-49992.svg', // TODO: Create X-wing icon
    description: 'Chasseur starfighter de choix des Rebelles',
    capabilities: ['Dogfight', 'Hyperspace', 'Attaque', 'Maniabilité']
  },
  {
    id: 'tie_fighter',
    name: 'TIE Fighter',
    icon: 'Emblem_of_the_First_Galactic_Empire.svg', // TODO: Create TIE icon
    description: 'Le chasseur emblématique de l Empire',
    capabilities: ['Vitesse', 'Maniabilité', 'Attaque', 'Détresse']
  },
  {
    id: 'star_destroyer',
    name: 'Star Destroyer',
    icon: 'Emblem_of_the_First_Galactic_Empire.svg', // TODO: Create ISD icon
    description: 'Capitale de classe destroyer',
    capabilities: ['Tir', 'Stratégie', ' intimidation', 'Puissance']
  }
];

/* ─── Story Choice Types ─────────────────────────────────────────────
   These define the types of choices players can make */
export const CHOICE_TYPES = {
  // Force-related choices
  FORCE: {
    id: 'force',
    name: 'Choix de la Force',
    icons: ['lightsaber-svgrepo-com.svg', 'luke-skywalker-lightsaber-svgrepo-com.svg'],
    color: '#4ec9b0'
  },
  
  // Combat choices
  COMBAT: {
    id: 'combat',
    name: 'Combat',
    icons: ['noun-storm-trooper-49992.svg', 'mandalorian-svgrepo-com.svg'],
    color: '#e51414'
  },
  
  // Diplomatic choices
  DIPLOMACY: {
    id: 'diplomacy',
    name: 'Diplomatie',
    icons: ['brand-galactic-republic-svgrepo-com.svg'],
    color: '#3498db'
  },
  
  // Stealth choices
  STEALTH: {
    id: 'stealth',
    name: 'Discrétion',
    icons: ['alone-characterized-embodied-svgrepo-com.svg', 'scifi-starwars-boba-fett-svgrepo-com.svg'],
    color: '#95a5a6'
  },
  
  // Survival choices
  SURVIVAL: {
    id: 'survival',
    name: 'Survie',
    icons: ['alone-characterized-embodied-svgrepo-com.svg'],
    color: '#27ae60'
  },
  
  // Ship/Travel choices
  SHIP: {
    id: 'ship',
    name: 'Choix de vaisseau',
    icons: ['millennium-falcon-svgrepo-com.svg'],
    color: '#f39c12'
  }
};

/* ─── Era Configuration ──────────────────────────────────────────────
   Historical periods of the Star Wars galaxy */
export const ERAS = [
  {
    id: 'old_republic',
    name: 'Ancienne République',
    years: '25 000 - 1000 AVBY',
    description: 'Les Guerres Mandaloriennes et les conflits Jedi-Sith'
  },
  {
    id: 'clone_wars',
    name: 'Guerres des Clones',
    years: '22 - 19 AVBY',
    description: 'Le conflit galaxy-wide entre République et Confédération'
  },
  {
    id: 'imperial',
    name: 'Ère Impériale',
    years: '19 - 4 AVBY',
    description: 'L oppression de l Empire et la montée des Rebel'
  },
  {
    id: 'new_republic',
    name: 'Nouvelle République',
    years: '4 - 28 APBY',
    description: 'La reconstruction et les menaces restantes de l Empire',
    icon: 'NR_Seal.svg'
  },
  {
    id: 'first_order',
    name: 'Premier Ordre',
    years: '28 - 35 APBY',
    description: 'Le successor de l Empire et la Résistance'
  }
];

/* ─── Helper Functions ─────────────────────────────────────────────── */
export function getFactionById(id: string) {
  return FACTIONS.find(f => f.id === id);
}

export function getRoleById(id: string) {
  return ROLES.find(r => r.id === id);
}

export function getShipById(id: string) {
  return SHIPS.find(s => s.id === id);
}

export function getEraById(id: string) {
  return ERAS.find(e => e.id === id);
}

export function getRolesByFaction(factionId: string) {
  return ROLES.filter(r => r.faction === factionId);
}

export function getChoiceTypeById(id: string) {
  return Object.values(CHOICE_TYPES).find(c => c.id === id);
}

/* ─── SVG Path Mapping ─────────────────────────────────────────────── */
export const SVG_PATHS: Record<string, string> = {
  // Faction emblems
  'jedi-order-svgrepo-com.svg': '/svg/jedi-order-svgrepo-com.svg',
  'starwars-sith-svgrepo-com.svg': '/svg/starwars-sith-svgrepo-com.svg',
  'SithEmblem-Traced-TORkit.svg': '/svg/SithEmblem-Traced-TORkit.svg',
  'Emblem_of_the_First_Galactic_Empire.svg': '/svg/Emblem_of_the_First_Galactic_Empire.svg',
  'Emblem_of_the_First_Order.svg': '/svg/Emblem_of_the_First_Order.svg',
  'brand-galactic-republic-svgrepo-com.svg': '/svg/brand-galactic-republic-svgrepo-com.svg',
  'NR_Seal.svg': '/svg/NR_Seal.svg',
  'AncientRepublic.svg': '/svg/AncientRepublic.svg',
  'Desilijic_clan_vector.svg': '/svg/Desilijic_clan_vector.svg',
  
  // Characters
  'noun-storm-trooper-49992.svg': '/svg/noun-storm-trooper-49992.svg',
  'scifi-starwars-boba-fett-svgrepo-com.svg': '/svg/scifi-starwars-boba-fett-svgrepo-com.svg',
  'mandalorian-svgrepo-com.svg': '/svg/mandalorian-svgrepo-com.svg',
  'alone-characterized-embodied-svgrepo-com.svg': '/svg/alone-characterized-embodied-svgrepo-com.svg',
  
  // Ships
  'millennium-falcon-svgrepo-com.svg': '/svg/millennium-falcon-svgrepo-com.svg',
  
  // Lightsabers
  'lightsaber-svgrepo-com.svg': '/svg/lightsaber-svgrepo-com.svg',
  'luke-skywalker-lightsaber-svgrepo-com.svg': '/svg/luke-skywalker-lightsaber-svgrepo-com.svg'
};

export function getSvgPath(filename: string): string {
  return SVG_PATHS[filename] || `/svg/${filename}`;
}