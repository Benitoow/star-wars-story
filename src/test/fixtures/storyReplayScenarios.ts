type ReplayScenario = {
  id: string;
  turnNumber: number;
  userAction: string;
  scribe: string;
  director: Record<string, unknown>;
  writer: string;
  brain: Record<string, unknown>;
};

const LOCATIONS = [
  'Nar Shaddaa',
  'Coruscant',
  'Tatooine',
  'Corellia',
  'Mustafar',
  'Naboo',
  'Bespin',
  'Hoth',
  'Kamino',
  'Mandalore',
  'Jedha',
  'Kessel'
];

const NPCS = ['Lira Voss', 'Kesh', 'Mara Dune', 'Rax Sol', 'Venn Tor', 'Syla', 'Jorren', 'Tala', 'Dax', 'Nima', 'Rhett', 'Calo'];
const SECTION_TYPES = ['action', 'dialogue', 'exploration', 'tension', 'revelation', 'interlude'];

export const STORY_REPLAY_SCENARIOS: ReplayScenario[] = LOCATIONS.map((location, index) => {
  const npc = NPCS[index];
  const sectionType = SECTION_TYPES[index % SECTION_TYPES.length];
  const turnNumber = index + 1;
  const creditsDelta = index % 2 === 0 ? 50 : -35;
  const hpDelta = index % 3 === 0 ? -8 : index % 3 === 1 ? -3 : 4;
  const action = `Je sécurise ${location} avec ${npc} avant l'arrivée des renforts.`;

  return {
    id: `scenario-${turnNumber}`,
    turnNumber,
    userAction: action,
    scribe: `Tour ${turnNumber}. ${location} se crispe. ${npc} reste au contact pendant que le protagoniste tente de reprendre l'initiative.`,
    director: {
      player_action: action,
      scene_goal: `Montrer la conséquence immédiate de l'action du joueur à ${location}.`,
      tension: `${npc} pense que la fenêtre de manœuvre se referme.`,
      must_include: ['Une conséquence immédiate', 'Un détail de lieu concret', 'Un signal politique ou relationnel'],
      required_world_signals: ['location', 'npc'],
      section_type: sectionType,
      atmosphere: index % 2 === 0 ? 'tense' : 'charged'
    },
    writer: [
      `Les alarmes grondent dans ${location} pendant que tu coupes à travers la foule avec une précision presque insolente.`,
      `${npc} te rattrape d'un pas sec, observe les lignes de tir puis te balance à voix basse ce que personne n'avait envie d'entendre.`,
      `"${turnNumber % 2 === 0 ? 'On tient encore dix secondes, pas plus.' : 'Si on hésite maintenant, on perd tout.'}"`,
      `L'air sent le métal chaud, la panique contenue, et cette seconde exacte où une mission peut encore virer du bon côté.`
    ].join('\n\n'),
    brain: {
      chapter_title: `${location} sous pression`,
      section_type: sectionType,
      atmosphere: index % 2 === 0 ? 'tense' : 'charged',
      scene_description: `Scène critique à ${location}`,
      choices: [
        { text: `Forcer le passage avec ${npc}`, attribute: 'combat', difficulty: 2, faction_impact: { empire: -2 } },
        { text: `Négocier une sortie à ${location}`, attribute: 'diplomacy', difficulty: 3, faction_impact: { rebels: 1 } },
        { text: `Contourner la zone par les ombres`, attribute: 'stealth', difficulty: 2, faction_impact: {} }
      ],
      memory_updates: {
        relations: [`${npc} reste engagé à tes côtés.`],
        places: [location],
        injuries: hpDelta < 0 ? [`Impact reçu à ${location}`] : [],
        resources: creditsDelta > 0 ? [`Prime récupérée à ${location}`] : [`Pot-de-vin payé à ${location}`],
        notes: [`Tour ${turnNumber}: ${location} devient un point chaud.`]
      },
      state_update: {
        location,
        hp: hpDelta,
        credits: creditsDelta,
        npcs: [{ name: npc, affinity: 12 + turnNumber, status: turnNumber % 5 === 0 ? 'hostile' : 'ally', alive: true, current_location: location }],
        factions: { empire: -2, rebels: 1 },
        rumors_new: [`${location} bascule dans l'instabilité au tour ${turnNumber}.`],
        environment_status: `${location} sous tension`,
        director_instruction: `Conserver la pression de ${location} au tour suivant.`
      }
    }
  };
});
