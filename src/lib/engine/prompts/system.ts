import { cleanText } from '../text';
import type { StorySetup, StoryChapter, WorldState } from '../types';
import { languageInstruction, languageName } from './language';
import { ERA_COHERENCE, styleDirective } from './style';

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
  return `Lieu : ${p.location} | PV : ${p.hp}/100 (${hpLabel}) | Crédits : ₡${p.credits}
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
  const critical = p.condition === 'critical'
    ? `\n\nÉTAT CRITIQUE (OBLIGATOIRE) : le protagoniste est tombé à 0 PV — mourant ou capturé. Ce tour est une tentative de survie/sauvetage, PAS une mort définitive. Montre le danger immédiat et une porte de sortie crédible (secours, soin, reddition, fuite). S'il survit, hp doit redevenir > 0.`
    : '';

  return `
ÉTAT DU MONDE ACTUEL :
Protagoniste : ${protagonist}
HP : ${p.hp}/100 (${hpLabel}) | Crédits : ₡${p.credits}
Lieu : ${p.location} | Date : ${p.date}
Blessures :
${injuries}
Inventaire :
${inventory}
PNJs connus :
${npcs}${deadLine}
Réputation par faction :
${factions}${env}${rumors}${critical}`;
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
10. ESCALADE MESURÉE & ÉCHELLE : un lieu civil (marché, cantina, quartier) reste civil tant qu'aucune escalade n'est fortement justifiée par les actions du joueur. N'invoque pas de forces militaires lourdes (stormtroopers en masse, marcheurs/AT-ST) sans cause claire et proportionnée — et jamais d'engins de combat (marcheurs) pour du maintien de l'ordre dans une foule.`;

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
    { "text": "Action concrète, immédiate et unique à cette scène (PAS d'abstraction générique comme 'Observer' ou 'Méditer')", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 3, "faction_impact": {} }
  ],
  "state_update": {
    "hp": -15, "credits": -300,
    "location": "Lieu actuel (obligatoire au tour 1)",
    "date_advance": "quelques heures",
    "npcs": [{ "name": "Nom exact", "affinity": 60, "status": "ally|neutral|hostile", "alive": true, "note": "contexte bref" }],
    "factions": { "empire": -10 },
    "injuries_new": [{ "description": "blessure précise", "severity": "light|moderate|severe" }],
    "injuries_resolved": ["fragment de description"],
    "inventory_gained": [{ "name": "objet", "qty": 1 }],
    "inventory_lost": [{ "name": "objet", "qty": 1 }]
  },
  "memory_updates": { "relations": [], "places": [], "injuries": [], "resources": [], "notes": [] }
}`;
}

export function renderPlayerCanon(playerDirectives: string[] = []): string {
  const recent = playerDirectives.map((d) => d.trim()).filter(Boolean).slice(-6);
  if (!recent.length) return '';
  return `\nCANON DU JOUEUR — ce qu'il a fait/établi récemment (à respecter, ne jamais contredire) :\n${recent.map((d) => `- ${d}`).join('\n')}`;
}

export function buildSystemPrompt(
  setup: StorySetup,
  memoryFacts: string[] = [],
  worldState?: WorldState,
  turnNumber?: number,
  playerDirectives: string[] = [],
  campaignArchive: string[] = []
): string {
  const protagonist = protagonistName(setup);
  const lang = setup.language || 'fr';
  const langName = languageName(lang);
  const worldBlock = worldState ? renderWorldBlock(worldState, protagonist) : '';
  const memory = memoryFacts.length ? `\nMÉMOIRE NARRATIVE (faits établis) :\n${memoryFacts.map((f) => `- ${f}`).join('\n')}` : '';
  const archive = campaignArchive.length
    ? `\nRÉSUMÉ DES TOURS ANCIENS (condensés pour la continuité — ne pas répéter mot à mot) :\n${campaignArchive.map((a) => `- ${a}`).join('\n')}`
    : '';
  const canon = renderPlayerCanon(playerDirectives);
  const isTurn1 = turnNumber === 1 || !worldState || worldState.chronology.length === 0;
  const prologue = isTurn1
    ? `\n12. PROLOGUE (TOUR 1) : commence par une riche introduction du protagoniste (${protagonist}) — apparence, origines liées à son rôle (${setup.role}) et sa faction (${setup.faction}), situation actuelle et tension immédiate. Pose le décor (state_update.location) avec soin avant l'action.`
    : '';

  return `${languageInstruction(lang)}

Tu es un Maître du Jeu Star Wars d'élite. Tu écris avec précision et cinéma — chaque ligne crée tension, émotion ou révélation. Zéro remplissage.

Protagoniste : ${protagonist} | Ère : ${setup.era} | Faction : ${setup.faction} | Rôle : ${setup.role}
Prémisse : ${setup.premise || 'Libre'}
Style : ${setup.writingStyle || 'cinématique'} · Ton : ${setup.writingTone || 'aventure'} · POV : ${setup.writingPov || 'première personne'} · Longueur : ${setup.writingLength || 'moyen'} · Contenu : ${setup.contentMode || 'cinematic'}
${worldBlock}${memory}${archive}${canon}

${GM_RULES}
11. DIRECTIVE STYLISTIQUE : ${styleDirective(setup.writingStyle, setup.writingTone)}
${ERA_COHERENCE}${prologue}

${jsonContract(langName)}`;
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
