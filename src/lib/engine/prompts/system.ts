import { foldArchive, renderMemoryBlock } from '../memory';
import { cleanText } from '../text';
import type { MemoryFact, StorySetup, StoryChapter, WorldState } from '../types';
import { languageInstruction, languageName } from './language';
import { ERA_COHERENCE, styleDirective, contentModeDirective } from './style';

function protagonistName(setup: StorySetup): string {
  return [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'Le protagoniste';
}

/** Compact one-glance world summary — for sub-agents that don't need the full block. */
export function renderWorldDigest(world: WorldState): string {
  const p = world.player;
  const hpLabel = p.hp >= 80 ? 'en forme' : p.hp >= 50 ? 'légèrement blessé' : p.hp >= 20 ? 'blessé' : 'critique';
  const alive = world.npcs.filter((n) => n.alive !== false).slice(0, 8)
    .map((n) => `${n.name} (${n.affinity > 30 ? 'allié' : n.affinity < -30 ? 'hostile' : 'neutre'})`).join(', ') || 'aucun';
  const dead = world.npcs.filter((n) => n.alive === false).map((n) => n.name);
  const deadLine = dead.length ? ` | Morts (ne pas ressusciter) : ${dead.join(', ')}` : '';
  const factions = Object.entries(world.factions).filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4)
    .map(([id, s]) => `${id} ${s > 0 ? '+' : ''}${s}`).join(', ') || 'neutre';
  const env = world.environment_status ? ` | Environnement : ${world.environment_status}` : '';
  const campaign = world.campaign
    ? `\nFIL ROUGE : ${world.campaign.title} | Objectif : ${world.campaign.objective} | Progression : ${world.campaign.progress}`
    : '';
  const events = world.world_events?.length
    ? `\nÉVÉNEMENTS HORS CHAMP RÉCENTS : ${world.world_events.slice(0, 3).map((e) => e.summary).join(' ; ')}`
    : '';
  return `Lieu : ${p.location} | PV : ${p.hp}/100 (${hpLabel}) | Crédits : ₡${p.credits}${env}${campaign}${events}
Aptitudes : ${Object.entries(p.skills ?? {}).map(([id, score]) => `${id} ${score}/5`).join(', ') || 'profil à établir'}
PNJ présents : ${alive}${deadLine}
Factions : ${factions}`;
}

export function renderWorldBlock(world: WorldState, protagonist: string): string {
  const p = world.player;
  const hpLabel = p.hp >= 80 ? 'en forme' : p.hp >= 50 ? 'légèrement blessé' : p.hp >= 20 ? 'blessé' : 'état critique';
  const injuries = p.injuries.length ? p.injuries.map((i) => `  • ${i.description} [${i.severity}]`).join('\n') : '  (aucune)';
  const inventory = p.inventory.length ? p.inventory.map((i) => `  • ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join('\n') : '  (rien de notable)';
  const livingNpcs = world.npcs.filter((n) => n.alive !== false);
  const npcs = livingNpcs.length
    ? livingNpcs.map((n) => {
        const tag = n.affinity > 30 ? '★ allié' : n.affinity < -30 ? '✖ hostile' : '~ neutre';
        return `  • ${n.name} [${tag}${n.faction ? `, ${n.faction}` : ''}]${n.note ? ` — ${n.note}` : ''}`;
      }).join('\n')
    : '  (aucun PNJ connu)';
  const dead = world.npcs.filter((n) => n.alive === false);
  const deadLine = dead.length ? `\nMorts : ${dead.map((n) => n.name).join(', ')}` : '';
  const factions = Object.entries(world.factions).sort(([, a], [, b]) => b - a)
    .map(([id, s]) => `  • ${id} : ${s > 0 ? '+' : ''}${s}`).join('\n') || '  (neutre partout)';
  const env = world.environment_status ? `\nEnvironnement : ${world.environment_status}` : '';
  const rumors = world.rumors?.length ? `\nRumeurs locales :\n${world.rumors.map((r) => `  • ${r}`).join('\n')}` : '';
  const skills = `\nAptitudes du protagoniste (1–5, le jet utilise l'aptitude du choix) : ${Object.entries(p.skills ?? {}).map(([id, score]) => `${id}=${score}`).join(' · ')}`;
  const campaign = world.campaign
    ? `\n\nFIL ROUGE / OBJECTIF DE CAMPAGNE :\nTitre : ${world.campaign.title}\nObjectif : ${world.campaign.objective}\nProgression : ${world.campaign.progress}\nStatut : ${world.campaign.status}`
    : '';
  const events = world.world_events?.length
    ? `\nÉvénements hors champ récents :\n${world.world_events.slice(0, 5).map((e) => `  • T${e.turn} — ${e.summary}`).join('\n')}`
    : '';
  const ending = world.ending ? `\n\nCAMPAGNE TERMINÉE : ${world.ending.type} — ne propose plus de choix jouables.` : '';
  const critical = p.condition === 'critical'
    ? `\n\nÉTAT CRITIQUE (OBLIGATOIRE) : le protagoniste est tombé à 0 PV — mourant ou capturé. Montre le danger immédiat et une porte de sortie crédible (secours, soin, reddition, fuite). C'est la dernière chance : si la scène suivante ne le remet pas au-dessus de 0 PV, la campagne se termine. S'il survit, hp doit redevenir > 0.`
    : '';

  return `
ÉTAT DU MONDE ACTUEL :
Protagoniste : ${protagonist}
HP : ${p.hp}/100 (${hpLabel}) | Crédits : ₡${p.credits} | Niveau : ${p.level} | XP : ${p.experience}
Lieu : ${p.location} | Date : ${p.date}${skills}
Blessures :
${injuries}
Inventaire :
${inventory}
PNJs connus :
${npcs}${deadLine}
Réputation par faction :
${factions}${env}${rumors}${campaign}${events}${ending}${critical}`;
}

const GM_RULES = `RÈGLES DU MAÎTRE DU JEU :
1. Coûts réels : blessure → hp négatif, dépense → credits négatif, échec → conséquence concrète.
2. PNJs autonomes : agendas cachés, mémoire des événements, évolution propre — ils agissent pour eux, pas pour servir le joueur.
3. Rythme : après 2 scènes intenses (action/confrontation), la suivante DOIT être repos, dialogue ou exploration.
4. Deltas : hp et credits sont TOUJOURS des deltas signés. hp:-15 = perd 15 PV ; credits:500 = reçoit 500. JAMAIS un total absolu.
5. Titre : chapter_title = titre de scène évocateur. INTERDIT d'y mettre un numéro ou "Chapitre N".
6. PNJs nommés : si un personnage nommé parle/apparaît, ajoute/mets à jour une entrée dans state_update.npcs (jamais de doublon — mets à jour l'entrée existante).
7. État monde : chaque tour met à jour au moins un signal via state_update (location, npcs, factions, hp/credits, blessures ou inventaire). location est obligatoire au tour 1.
8. Rôle canonique IMMUABLE : le protagoniste garde son rôle. Ne le promeus/rétrograde jamais sans validation explicite du joueur.
9. CANON DU JOUEUR (PRIORITÉ ABSOLUE) : respecte les faits et contraintes que le joueur a établis sur la scène ou le lieu (ambiance, présence ou ABSENCE de tel groupe). Ne les contredis JAMAIS d'un tour à l'autre. N'introduis pas un élément, un PNJ ou une faction que le joueur a explicitement exclus. Si le joueur établit une contrainte (ex : « il n'y a pas de soldats ici »), consigne-la dans memory_updates.notes pour t'en souvenir.
10. ESCALADE MESURÉE & ÉCHELLE : un lieu civil (marché, cantina, quartier) reste civil tant qu'aucune escalade n'est fortement justifiée par les actions du joueur. N'invoque pas de forces militaires lourdes (stormtroopers en masse, marcheurs/AT-ST) sans cause claire et proportionnée — et jamais d'engins de combat (marcheurs) pour du maintien de l'ordre dans une foule.
11. BLESSURES RÉELLES : les blessures sont RARES et graves. La plupart des scènes d'action ne doivent PAS infliger de blessure — seuls des événements véritablement dangereux (chute de grande hauteur, explosion, combat au corps à corps violent, tir direct) justifient injuries_new. Des coups, chutes légères ou efforts physiques ne sont PAS des blessures. Maximum 1 blessure toutes les 4-5 scènes. Si tu en infliges une, mets-la dans state_update.injuries_new (description + severity: light|moderate|severe). Ce qui se soigne va dans injuries_resolved. Une blessure décrite dans la prose ne doit jamais rester invisible dans l'état.
12. ÉCOULEMENT DU TEMPS : quand du temps passe réellement (repos, soin, voyage, ellipse), renseigne state_update.date_advance (ex: "quelques heures", "1 jour"). Si la scène est continue (même instant), laisse-le vide.
13. DIFFICULTÉ DES CHOIX : calibre chaque difficulty selon l'action RÉELLE — 1 = trivial, 2 = facile, 3 = incertain, 4 = difficile, 5 = héroïque/quasi-impossible. La plupart des actions valent 2-3 ; réserve 4-5 aux vrais exploits. NE mets PAS 5 partout (fabriquer une attelle = 2, pas 5).
14. CONSÉQUENCES DURABLES & RESSOURCES FINIES : les forces ennemies ne sont pas infinies. Une troupe décimée, une patrouille anéantie ou une armée vaincue RESTE vaincue : pas de vague suivante identique au tour d'après, pas de renforts surgis de nulle part. Après une victoire majeure, montre ses effets durables (silence, fuite des survivants, répit crédible) et consigne-les dans state_update.environment_status (ex: « la cour est jonchée de débris, plus un soldat debout ») et dans memory_updates.notes (ex: « l'armée de X est décimée »). Un retour ennemi n'est permis qu'avec une cause visible et proportionnée (vaisseau qui atterrit, appel radio, renforts annoncés), jamais comme un réflexe. INVERSE : ne consigne JAMAIS une prédiction de menace non réalisée comme un fait établi (« la prochaine vague ne tardera pas » n'est pas un fait, c'est une supposition du narrateur — ne la mets pas dans memory_updates).
15. APTITUDES & AGENCE : l'attribut de chaque choix est mécanique. Le joueur est meilleur dans ses aptitudes affichées ; respecte ces forces et faiblesses dans la fiction. Ne rends pas une action facile artificiellement difficile, et ne transforme pas une spécialité en échec arbitraire.
16. FIL ROUGE : fais progresser l'objectif de campagne à chaque scène ou explique concrètement pourquoi il est retardé. N'abandonne pas l'objectif pour une suite de rencontres aléatoires. Mets à jour campaign_update.progress et ne marque completed que si l'objectif est réellement résolu.
17. CHOIX & ARBITRAGES : propose 3 à 4 options vraiment distinctes et mutuellement exclusives. Au moins deux choix doivent sacrifier quelque chose d'important l'un par rapport à l'autre (temps, sécurité, allié, argent, information, réputation). Chaque choix doit remplir tradeoff et stakes en une phrase concrète. Évite les variantes cosmétiques d'une même attaque.
18. INVENTAIRE UTILE : si un objet pertinent est disponible, propose au moins un choix qui l'utilise et renseigne requires_items/consumes_items. Ne fais jamais apparaître un objet dans une scène si l'état ne le contient pas.
19. MONDE HORS CHAMP : lorsqu'un voyage, un repos, une ellipse ou une action du joueur laisse du temps au monde, fais évoluer au maximum 1 ou 2 événements externes plausibles via world_events_new. Ils doivent découler des faits établis, pas créer une nouvelle armée sans cause.
20. ENJEUX : à 0 PV, donne une dernière scène de survie crédible. Si le protagoniste reste à 0 PV après cette chance, renseigne ending.type = death et ne propose plus de choix jouables. Une campagne peut aussi se terminer par victory, defeat ou une retraite explicitement choisie.
21. PROGRESSION : attribue de l'expérience seulement pour une action significative (en général 5 à 25 XP), et un skill_gains uniquement pour un entraînement ou une révélation exceptionnelle.`;
function jsonContract(langName: string): string {
  return `Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour. TOUT le texte des champs est rédigé ENTIÈREMENT EN ${langName}. Priorité : prose riche dans "action" (2 à 4 paragraphes). Remplis state_update avec toutes les conséquences.

{
  "chapter_title": "Titre de scène évocateur — jamais Chapitre N",
  "chapter_number": 0,
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "narrative": {
    "action": "Narration pure — actions, descriptions, sensations. AUCUN dialogue ici. Max 3 paragraphes.",
    "dialogue": "Échanges verbaux — chaque réplique sur sa ligne au format 'Nom : réplique' (INTERDICTION ABSOLUE d'un tiret cadratin '—' ou de tout tiret en début de ligne).",
    "reflection": "Pensées internes du protagoniste (optionnel)",
    "atmosphere": "tense|calm|mysterious|eerie|heroic"
  },
  "choices": [
    { "text": "Action concrète, immédiate et unique à cette scène (PAS d'abstraction générique comme 'Observer' ou 'Méditer')", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 3, "tradeoff": "ce que ce choix sacrifie", "stakes": "conséquence concrète en cas de revers", "requires_items": [], "consumes_items": [], "faction_impact": {} }
  ],
  "state_update": {
    "hp": -15, "credits": -300, "experience": 10, "skill_gains": {},
    "location": "Lieu actuel (obligatoire au tour 1)",
    "date_advance": "quelques heures (durée courte uniquement)",
    "campaign_update": { "title": "", "objective": "", "progress": "", "status": "active|completed|failed" },
    "world_events_new": [],
    "ending": null,
    "npcs": [{ "name": "Nom exact", "affinity": 60, "status": "ally|neutral|hostile", "alive": true, "note": "contexte bref" }],
    "factions": { "empire": -10 },
    "injuries_new": [],
    "injuries_resolved": ["fragment de description"],
    "inventory_gained": [{ "name": "objet", "qty": 1 }],
    "inventory_lost": [{ "name": "objet", "qty": 1 }]
  },
  "memory_updates": { "relations": [], "places": [], "injuries": [], "resources": [], "notes": [] },
  "npcs_present": ["Noms EXACTS des PNJ nommés physiquement présents (ou à portée de voix) à la FIN de la scène"]
}
- "npcs_present" détermine à qui le joueur peut parler après la scène : liste UNIQUEMENT les PNJ encore sur place à la fin (pas ceux partis, morts ou restés ailleurs). Vide si le protagoniste est seul.`;
}

export function renderPlayerCanon(playerDirectives: string[] = []): string {
  const recent = playerDirectives.map((d) => d.trim()).filter(Boolean).slice(-8);
  if (!recent.length) return '';
  return `\nCANON DU JOUEUR — ce qu'il a fait/établi récemment (à respecter, ne jamais contredire) :\n${recent.map((d) => `- ${d}`).join('\n')}`;
}

/** Stable header: language + GM identity + protagonist line. Never varies across turns. */
function buildStableHeader(setup: StorySetup): string {
  const protagonist = protagonistName(setup);
  const lang = setup.language || 'fr';
  return `${languageInstruction(lang)}

Tu es un Maître du Jeu Star Wars d'élite. Tu écris avec précision et cinéma — chaque ligne crée tension, émotion ou révélation. Zéro remplissage.

Protagoniste : ${protagonist} | Ère : ${setup.era} | Faction : ${setup.faction} | Rôle : ${setup.role}
Prémisse : ${setup.premise || 'Libre'}
Style : ${setup.writingStyle || 'cinématique'} · Ton : ${setup.writingTone || 'aventure'} · POV : ${setup.writingPov || 'première personne'} · Longueur : ${setup.writingLength || 'moyen'} · Contenu : ${setup.contentMode || 'cinematic'}`;
}

/** Stable tail: rules, style directives, era coherence, JSON contract. Never varies across turns. */
function buildRulesTail(setup: StorySetup, isTurn1: boolean): string {
  const protagonist = protagonistName(setup);
  const langName = languageName(setup.language || 'fr');
  const prologue = isTurn1
    ? `\n17. PROLOGUE (TOUR 1) : commence par une riche introduction du protagoniste (${protagonist}) — apparence, origines liées à son rôle (${setup.role}) et sa faction (${setup.faction}), situation actuelle et tension immédiate. Pose le décor (state_update.location) avec soin avant l'action.`
    : '';
  return `${GM_RULES}
15. DIRECTIVE STYLISTIQUE : ${styleDirective(setup.writingStyle, setup.writingTone)}
16. DIRECTIVE DE CONTENU : ${contentModeDirective(setup.contentMode)}
${ERA_COHERENCE}${prologue}

${jsonContract(langName)}`;
}

/**
 * System prompt with a STABLE prefix for the OpenRouter/OpenAI input cache:
 * every variable block (world state, retrieved memory, archive, player canon)
 * lives in the final user message, so the system + raw transcript prefix stays
 * byte-identical between turns and the provider serves it from cache.
 */
export function buildStableSystemPrompt(setup: StorySetup, turnNumber?: number): string {
  return `${buildStableHeader(setup)}

${buildRulesTail(setup, turnNumber === 1)}`;
}

export function buildSystemPrompt(
  setup: StorySetup,
  memory: MemoryFact[] = [],
  worldState?: WorldState,
  turnNumber?: number,
  playerDirectives: string[] = [],
  campaignArchive: string[] = []
): string {
  const protagonist = protagonistName(setup);
  const worldBlock = worldState ? renderWorldBlock(worldState, protagonist) : '';
  const memoryBlock = renderMemoryBlock(memory);
  const foldedArchive = foldArchive(campaignArchive);
  const archive = foldedArchive.length
    ? `\nRÉSUMÉ DES TOURS ANCIENS (condensés pour la continuité — ne pas répéter mot à mot) :\n${foldedArchive.map((a) => `- ${a}`).join('\n')}`
    : '';
  const canon = renderPlayerCanon(playerDirectives);
  const isTurn1 = turnNumber === 1 || !worldState || worldState.chronology.length === 0;

  return `${buildStableHeader(setup)}${worldBlock}${memoryBlock}${archive}${canon}

${buildRulesTail(setup, isTurn1)}`;
}

/** Condense a played chapter into one recap line for the prompt history. */
export function summarizeChapterForPrompt(chapter: StoryChapter): string {
  const bits: string[] = [`Tour ${chapter.chapter_number} : ${cleanText(chapter.chapter_title, 72)} (${chapter.section_type})`];
  const action = cleanText(chapter.narrative.action, 200);
  if (action) bits.push(action);

  const su = chapter.state_update;
  if (su) {
    const state: string[] = [];
    if (su.location) state.push(`lieu : ${cleanText(su.location, 50)}`);
    if (typeof su.hp === 'number' && su.hp !== 0) state.push(`HP${su.hp > 0 ? '+' : ''}${su.hp}`);
    if (typeof su.credits === 'number' && su.credits !== 0) state.push(`crédits${su.credits > 0 ? '+' : ''}${su.credits}`);
    const npcs = (su.npcs ?? []).map((n) => cleanText(n.name, 40)).filter(Boolean).slice(0, 3);
    if (npcs.length) state.push(`PNJs : ${npcs.join(', ')}`);
    if (state.length) bits.push(`Conséquences : ${state.join(' ; ')}`);
  }
  return cleanText(bits.join(' — '), 420);
}
