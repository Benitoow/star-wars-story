import type {
  SectionType,
  StoryChapter,
  StoryPromptMode,
  StorySetupSnapshot,
  WorldState
} from './types';
import { sanitizeNarrativeText } from './parsing';

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

const ERA_CONTEXT: Record<string, string> = {
  old_republic: 'Ancienne République — guerres mandaloriennes, Jedi au zénith, Sith encore tapis dans l\'ombre.',
  clone_wars: 'Guerres des Clones — la galaxie se déchire, les Jedi deviennent généraux et Palpatine tisse son plan.',
  imperial: 'Ère Impériale — l\'Empire règne par la peur, les Jedi sont traqués et la Rébellion cherche des alliés.',
  empire: 'Empire galactique — l\'Empire impose son ordre, la surveillance s\'étend et la moindre dissidence devient un risque.',
  new_republic: 'Nouvelle République — l\'Empire s\'effondre, le pouvoir se reconstruit et les menaces de l\'ancien monde persistent.',
  first_order: 'Premier Ordre — la République vacille, la Résistance survit et les vieux fantômes de l\'Empire reviennent.',
  high_republic: 'Haute République — âge d\'or de la galaxie, expansion, exploration et menaces aux confins de l\'espace.'
};

const ACTION_HEAVY: SectionType[] = ['action', 'confrontation'];

export function buildSystemPrompt(
  setup: StorySetupSnapshot,
  memoryFacts: string[],
  worldState?: WorldState,
  promptMode: StoryPromptMode = 'json',
  turnNumber = 1,
  campaignArchive: string[] = []
): string {
  const protagonist = [setup.protagonistFirstName || '', setup.protagonistLastName || ''].join(' ').trim() || 'Le protagoniste';

  // ── World state block ─────────────────────────
  let worldBlock = '';
  if (worldState) {
    const p = worldState.player;
    const hpLabel = p.hp >= 80 ? 'en forme' : p.hp >= 50 ? 'légèrement blessé' : p.hp >= 20 ? 'blessé' : 'état critique';
    const injuryLines = p.injuries.length
      ? p.injuries.map(i => `  • ${i.description} [${i.severity}]`).join('\n')
      : '  (aucune)';
    const inventoryLines = p.inventory.length
      ? p.inventory.map(i => `  • ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join('\n')
      : '  (rien de notable)';
    const npcLines = worldState.npcs.length
      ? worldState.npcs
          .filter(n => n.alive !== false)
          .map(n => {
            const aff = n.affinity > 30 ? '★ allié' : n.affinity < -30 ? '✖ hostile' : '~ neutre';
            return `  • ${n.name} [${aff}${n.faction ? `, ${n.faction}` : ''}]${n.note ? ` — ${n.note}` : ''}`;
          })
          .join('\n')
      : '  (aucun PNJ connu)';
    const deadNpcs = worldState.npcs.filter(n => n.alive === false);
    const deadLines = deadNpcs.length ? `\nMorts: ${deadNpcs.map(n => n.name).join(', ')}` : '';
    const factionLines = Object.entries(worldState.factions)
      .sort(([,a],[,b]) => b - a)
      .map(([id, score]) => `  • ${id}: ${score > 0 ? '+' : ''}${score}`)
      .join('\n') || '  (neutre partout)';

    worldBlock = `
ÉTAT DU MONDE ACTUEL:
Protagoniste: ${protagonist}
HP: ${p.hp}/100 (${hpLabel}) | Crédits: ₡${p.credits}
Lieu: ${p.location} | Date narrative: ${p.date}
Blessures actives:
${injuryLines}
Inventaire notable:
${inventoryLines}
PNJs connus:
${npcLines}${deadLines}
Réputation par faction:
${factionLines}`;
  }

  // ── Memory block ──────────────────────────────
  const memoryContext = memoryFacts.length
    ? `\nMÉMOIRE NARRATIVE (faits établis):\n${memoryFacts.map(item => `- ${item}`).join('\n')}`
    : '';

  const campaignArchiveContext = campaignArchive.length
    ? `\nRÉSUMÉ DE CAMPAGNE (tours anciens condensés):\n${campaignArchive.map(item => `- ${cleanText(item, 260)}`).join('\n')}`
    : '';

  const basePrompt = `Tu es un Maître du Jeu Star Wars d'élite. Tu écris avec précision et cinéma — chaque ligne doit créer tension, émotion ou révélation. Zéro remplissage.

Protagoniste: ${protagonist} | Ère: ${setup.era} | Faction: ${setup.faction} | Rôle: ${setup.role}
Prémisse: ${setup.premise || 'Libre'}
Style: ${setup.writingStyle || 'cinématique'} · Ton: ${setup.writingTone || 'aventure'} · POV: ${setup.writingPov || 'première personne'} · Longueur: ${setup.writingLength || 'moyen'} · Contenu: ${setup.contentMode || 'cinematic'}
${worldBlock}${memoryContext}${campaignArchiveContext}
RÈGLES MJ:
1. Coûts réels: blessure → hp négatif, dépense → credits négatif, échec → conséquence concrète.
2. PNJs autonomes: agendas cachés, mémoire des événements, évolution propre — ils agissent pour eux, pas pour servir le joueur.
3. Rythme: après 2 scènes intenses (action/confrontation), la suivante DOIT être repos/dialogue/exploration.
4. Deltas: hp et credits = TOUJOURS des deltas signés. hp:-15=perd 15PV, credits:500=reçoit 500. JAMAIS un total absolu.
5. Titre: chapter_title = titre de scène évocateur uniquement. INTERDIT d'y mettre un numéro ou "Chapitre N".
6. NPCs: si un inconnu révèle son nom → mettre à jour l'entrée existante, jamais de doublon.
7. ÉTAT MONDE OBLIGATOIRE: chaque tour doit mettre à jour au moins un signal monde via state_update (location, npcs, factions, hp/credits, blessures ou inventaire).
8. LIEU: state_update.location doit refléter la scène actuelle. Au tour 1, il est obligatoire même sans déplacement.
9. PNJs NOMMÉS: si un personnage nommé parle/apparaît, ajoute une entrée dans state_update.npcs.
10. RÔLE CANONIQUE IMMUTABLE: le protagoniste reste "${setup.role}". Ne le promeus/rétrograde jamais (ex: Padawan ≠ Chevalier/Maître) sans validation explicite du joueur.
11. Résumé de campagne: s'il est présent, il représente la continuité condensée des tours anciens — prends-le en compte sans le répéter mot à mot.`;
  const narrativeProseRule = `
12. PROSE UNIQUEMENT dans "narrative.action": pas de markdown, pas de titres H1/H2, pas de listes numérotées, pas de bloc "Que faites-vous ?", pas de répétition des choix. Les choix vivent uniquement dans le tableau "choices".
13. DIALOGUES: chaque réplique doit être sur son propre paragraphe, idéalement précédée d'un tiret cadratin (—) ou placée dans "narrative.dialogue". Ne colle jamais une réplique au milieu d'un paragraphe d'action.
14. DIALOGUES OBLIGATOIREMENT DANS narrative.dialogue: chaque échange verbal doit être placé dans le champ "dialogue", jamais dans "action". "action" = narration pure et actions, "dialogue" = tous les échanges verbaux. Si un personnage parle, utilise ce champ dédié.;`;

  const jsonContract = `Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour. Priorité absolue: prose narrative riche dans "action" (2-4 paragraphes). Remplis state_update avec toutes les conséquences.

{
  "chapter_title": "Titre de scène évocateur — jamais Chapitre N",
  "chapter_number": ${turnNumber},
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "narrative": {
    "action": "Narration pure — actions, descriptions, sensations, tensions. AUCUN dialogue ici. Max 3 paragraphes.",
    "dialogue": "Tous les échanges verbaux — chaque réplique sur sa propre ligne avec — Personnage en début. Ex: — Leia: « Je comprends votre inquiétude. »",
    "reflection": "Pensées internes du protagoniste (optionnel, italique)",
    "atmosphere": "tense|calm|mysterious|eerie|heroic"
  },
  "choices": [
    { "text": "Action précise et directe, réalisable ici et maintenant dans cette scène", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 3, "faction_impact": {} }
  ],
  "state_update": {
    "hp": -15,
    "credits": -300,
    "location": "Lieu actuel de la scène (obligatoire au tour 1, puis mis à jour à chaque changement)",
    "npcs": [{ "name": "Nom exact du PNJ (obligatoire s'il parle/apparaît)", "affinity": 60, "status": "ally|neutral|hostile", "alive": true, "note": "contexte bref" }],
    "factions": { "empire": -10 },
    "injuries_new": [{ "description": "blessure précise", "severity": "light|moderate|severe" }],
    "injuries_resolved": ["fragment de description"],
    "inventory_gained": [{ "name": "objet", "qty": 1 }]
  }
}`;

  const toolCallingContract = `MODE AGENTIQUE — 2 phases distinctes:

PHASE 1 (maintenant): Écris la scène en JSON valide ou en prose libre.
- Aucun outil disponible dans cette phase.
- Priorité absolue: prose narrative vivante, conséquences réelles, PNJs avec mémoire et intentions propres.
- Si JSON: remplis "narrative.action" avec 3-5 paragraphes de prose cinématique.
- Les dialogues doivent être séparés en paragraphes dédiés (de préférence avec —) et ne jamais être noyés dans le bloc d'action.
- Aucun markdown, aucun titre interne et aucun bloc de choix dans "narrative.action".

PHASE 2 (ensuite, automatique): Le système extraira l'état structuré via des outils dédiés.
- Cette extraction doit fournir au minimum: update_world (avec location actuelle) et offer_choices.
- Dès qu'un PNJ nommé intervient, l'extraction doit inclure update_npc.

Tu n'as qu'une seule tâche maintenant: écrire une scène forte.`;

  return `${basePrompt}${narrativeProseRule}\n\n${promptMode === 'tool-calls' ? toolCallingContract : jsonContract}`;
}

export function buildStartPrompt(
  setup: StorySetupSnapshot,
  selectedTrameLabel?: string | null,
  promptMode: StoryPromptMode = 'json'
): string {
  const firstName = cleanText(setup.protagonistFirstName, 60);
  const lastName = cleanText(setup.protagonistLastName, 60);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'le protagoniste';

  const eraContext = ERA_CONTEXT[setup.era || ''] || 'Galaxie lointaine, très lointaine — une époque de conflits, de choix lourds et de destins qui basculent.';

  const modeHint = promptMode === 'tool-calls'
    ? `\nMode agentique actif: utilise les outils pour poser la scène, matérialiser les conséquences puis finaliser le prologue.`
    : '';

  return `Lance une histoire interactive Star Wars avec un prologue immédiatement jouable.

CADRE D'OUVERTURE:
- Protagoniste: ${displayName}
- Ère: ${setup.era || 'inconnue'} — ${eraContext}
- Faction: ${setup.faction || 'libre'}
- Rôle: ${setup.role || 'aventurier'}
- Trame: ${selectedTrameLabel || 'Libre'}
- Prémisse: ${setup.premise || 'Crée une situation tendue et immédiatement jouable.'}
- Style: ${setup.writingStyle || 'cinématique'}
- Ton: ${setup.writingTone || 'aventure'}
- POV: ${setup.writingPov || 'première personne'}
- Longueur: ${setup.writingLength || 'moyen'}
- Contenu: ${setup.contentMode || 'cinematic'}

EXIGENCES DU PREMIER TOUR:
- Ouvre in medias res, sans préambule explicatif.
- Donne immédiatement une tension claire, un lieu vivant et un objectif.
- Introduis au moins 1 PNJ mémorable avec un agenda distinct.
- Fais émerger un enjeu politique, relationnel ou moral dès l'ouverture.
- Les 3-4 choix doivent être concrets, contrastés et portés par la scène.
- Respecte strictement le rôle canonique choisi (${setup.role}). N'invente pas de promotion de rang au lancement.
- Le lieu de départ doit être explicite et exploitable pour l'état monde.
- Le texte de scène ne doit contenir ni markdown ni liste de choix.
- Tout dialogue doit être isolé sur sa propre ligne, idéalement précédé d'un tiret cadratin (—) et séparé du reste de l'action par un retour à la ligne.
- chapter_number = 1${modeHint}
Les dialogues vont dans le champ "dialogue", jamais dans "action".
Le tour 1 doit permettre d'extraire state_update.location et au moins un PNJ nommé.`;
}

export function buildContinuePrompt(
  actionText: string,
  turnNumber: number,
  recentSummary: string[],
  promptMode: StoryPromptMode = 'json',
  recentSectionTypes: string[] = [],
  recentChoiceTexts: string[] = [],
  sceneAnchor: string = ''
): string {
  const history = recentSummary.length
    ? `\nRésumé récent:\n${recentSummary.map(item => `- ${item}`).join('\n')}`
    : '';

  // Dedupe choices — large context window means we can afford to remember many
  const recentChoices = Array.from(new Set(
    recentChoiceTexts
      .map(item => cleanText(item, 160))
      .filter(Boolean)
  )).slice(-20);

  const recentChoicesBlock = recentChoices.length
    ? `\nChoix déjà proposés à éviter: ${recentChoices.map(c => `"${c}"`).join(' | ')}`
    : '';

  // Pacing: single-line directive only when strictly needed
  let consecutiveIntense = 0;
  for (let i = recentSectionTypes.length - 1; i >= 0; i--) {
    if (ACTION_HEAVY.includes(recentSectionTypes[i] as SectionType)) consecutiveIntense++;
    else break;
  }
  const pacingDirective = consecutiveIntense >= 2
    ? `\nRYTHME: ${consecutiveIntense} scènes intenses d'affilée — ce tour DOIT être repos, dialogue ou exploration.`
    : '';

  const anchorBlock = sceneAnchor ? `${sceneAnchor}\n\n` : '';

  return `${anchorBlock}Tour ${turnNumber}. Action: "${cleanText(actionText, 280)}".${history}${recentChoicesBlock}${pacingDirective}

Écris une scène forte et précise — conséquences réelles, PNJs avec mémoire et intention propre.
Ne mets aucun markdown, aucun titre interne et aucun bloc de choix dans le récit.
Chaque réplique doit être sur une ligne distincte, idéalement précédée de —, et jamais noyée dans un paragraphe d'action.
Propose 3-4 choix distincts, concrets, ancrés dans cette scène précise (pas génériques).
Fournis assez d'éléments concrets pour extraire au moins un signal monde (location ou PNJ nommé) à ce tour.
Respecte le rôle canonique du protagoniste défini dans le contexte système (ne pas promouvoir/rétrograder sans validation explicite du joueur).
chapter_number = ${turnNumber}.
Place tous les dialogues dans le champ "dialogue".`;
}

export function summarizeChapterForPrompt(
  chapter: StoryChapter,
  sanitizeNarrative: (value: unknown, maxLength?: number) => string = sanitizeNarrativeText
): string {
  const title = cleanText(chapter.chapter_title, 72);
  const type = cleanText(chapter.section_type, 28) || 'action';
  const action = sanitizeNarrative(chapter.narrative.action || chapter.narrative.context, 190);
  const dialogue = sanitizeNarrative(chapter.narrative.dialogue, 110);
  const reflection = sanitizeNarrative(chapter.narrative.reflection, 110);
  const atmosphere = cleanText(chapter.narrative.atmosphere, 90);

  const stateBits: string[] = [];
  const su = chapter.state_update;
  if (su) {
    if (typeof su.location === 'string' && su.location.trim()) stateBits.push(`déplacement vers ${cleanText(su.location, 50)}`);
    if (typeof su.date_advance === 'string' && su.date_advance.trim()) stateBits.push(`temps avancé de ${cleanText(su.date_advance, 40)}`);
    if (typeof su.hp === 'number' && su.hp !== 0) stateBits.push(`HP${su.hp > 0 ? '+' : ''}${su.hp}`);
    if (typeof su.credits === 'number' && su.credits !== 0) stateBits.push(`crédits${su.credits > 0 ? '+' : ''}${su.credits}`);

    const npcNames = Array.from(new Set(
      (su.npcs || [])
        .map(npc => cleanText(npc.name, 60))
        .filter(Boolean)
    )).slice(0, 3);
    if (npcNames.length) stateBits.push(`PNJs: ${npcNames.join(', ')}`);

    const factionBits = Object.entries(su.factions || {})
      .filter(([, delta]) => typeof delta === 'number' && delta !== 0)
      .slice(0, 3)
      .map(([id, delta]) => `${id}${delta > 0 ? '+' : ''}${delta}`);
    if (factionBits.length) stateBits.push(`factions: ${factionBits.join(', ')}`);

    const injuries = (su.injuries_new || [])
      .map(injury => cleanText(injury.description, 60))
      .filter(Boolean)
      .slice(0, 2);
    if (injuries.length) stateBits.push(`blessures: ${injuries.join(', ')}`);

    const gained = (su.inventory_gained || [])
      .map(item => `${item.qty > 1 ? `${item.qty}× ` : ''}${cleanText(item.name, 50)}`)
      .filter(Boolean)
      .slice(0, 2);
    if (gained.length) stateBits.push(`gain: ${gained.join(', ')}`);

    const resolved = (su.injuries_resolved || [])
      .map(item => cleanText(item, 60))
      .filter(Boolean)
      .slice(0, 2);
    if (resolved.length) stateBits.push(`résolu: ${resolved.join(', ')}`);
  }

  const narrativeBits = [
    action,
    dialogue ? `dialogue: ${dialogue}` : '',
    reflection ? `intérieur: ${reflection}` : ''
  ].filter(Boolean).join(' ');

  const memoryNotes = [
    ...chapter.memory_updates.relations.slice(0, 2).map(item => cleanText(item, 70)),
    ...chapter.memory_updates.places.slice(0, 1).map(item => cleanText(item, 70)),
    ...chapter.memory_updates.notes.slice(0, 1).map(item => cleanText(item, 100))
  ].filter(Boolean);

  const summaryParts = [
    `Tour ${chapter.chapter_number}: ${title} (${type})`,
    narrativeBits,
    stateBits.length ? `Conséquences: ${stateBits.join('; ')}` : '',
    memoryNotes.length ? `Mémoire: ${memoryNotes.join(' · ')}` : '',
    atmosphere ? `Ambiance: ${atmosphere}` : ''
  ].filter(Boolean);

  return cleanText(summaryParts.join(' — '), 420);
}
