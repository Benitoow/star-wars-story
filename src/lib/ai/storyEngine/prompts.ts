import type {
  ChatMessage,
  SectionType,
  StoryChapter,
  StoryPromptMode,
  StorySetupSnapshot,
  WorldState
} from './types';
import { sanitizeNarrativeText } from './parsing';
import { cleanText, extractCanonicalPlayerAction } from './utils/shared';

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

export const STORY_PIPELINE_SCRIBE_SYSTEM_PROMPT = `Tu es le SCRIBE de continuité d'une campagne Star Wars.
Ta mission est la synthèse factuelle, pas la narration.
Règles absolues:
- Résume en 150 mots maximum.
- Conserve uniquement: situation actuelle, personnages présents, tension immédiate.
- Ne pas inventer de faits.
- Pas de JSON, pas de markdown, pas de liste, texte brut uniquement.`;

export const STORY_PIPELINE_DIRECTOR_SYSTEM_PROMPT = `Tu es le DIRECTEUR de scène d'une campagne Star Wars.
Tu répartis le travail pour les autres agents.
Règles absolues:
- Réponds uniquement avec un objet JSON valide.
- Pas de prose hors JSON.
- Tu transformes l'action du joueur en brief de scène exécutable, concret et court.
- Tu imposes au moins 1 signal monde à produire dans le tour.
- Tu n'inventes ni résolution complète ni choix joueur finaux.`;

export const STORY_PIPELINE_WRITER_SYSTEM_PROMPT = `Tu es l'ÉCRIVAIN narratif d'une campagne Star Wars.
Tu écris une prose cinématique, claire et immersive.
Règles absolues:
- Écris 2 à 3 paragraphes.
- Action, ambiance et dialogue crédibles, sans méta-commentaire.
- Aucune sortie technique: pas de JSON, pas de markdown, pas de listes.
- Ne propose pas de choix au joueur.
- Conserve la continuité du résumé fourni.`;

export const STORY_PIPELINE_BRAIN_SYSTEM_PROMPT = `Tu es le CERVEAU mécanique d'une campagne Star Wars.
Tu extrais uniquement les conséquences de la scène.
Règles absolues:
- Réponds uniquement avec un objet JSON valide.
- Aucune prose hors JSON.
- Le JSON doit contenir exactement les clés de premier niveau suivantes:
  - state_update
  - memory_updates
  - choices
- choices doit contenir 3 à 4 choix concrets.`;

function formatPipelineMessageHistory(messages: ChatMessage[], limit = 14): string {
  const trimmed = messages
    .filter(message => message.role !== 'system')
    .slice(-limit)
    .map(message => {
      const label = message.role === 'assistant' ? 'Narrateur' : 'Joueur';
      const content = message.role === 'assistant'
        ? cleanText(message.content, 420)
        : extractCanonicalPlayerAction(message.content);
      return `${label}: ${content}`;
    })
    .filter(Boolean);

  return trimmed.length ? trimmed.join('\n') : '(historique indisponible)';
}

export function buildPipelineScribeUserPrompt(messages: ChatMessage[], turnNumber: number): string {
  const systemContext = cleanText(
    messages.find(message => message.role === 'system')?.content,
    3600
  ) || '(contexte système indisponible)';
  const historyBlock = formatPipelineMessageHistory(messages, 16);
  const latestUserAction = cleanText(
    extractCanonicalPlayerAction([...messages].reverse().find(message => message.role === 'user')?.content || ''),
    320
  ) || '(action joueur indisponible)';

  return `Voici l'historique récent et l'état du monde. Le joueur vient d'agir au tour ${turnNumber}.

CONTEXTE SYSTÈME DE CAMPAGNE:
${systemContext}

HISTORIQUE RÉCENT:
${historyBlock}

ACTION JOUEUR EN COURS:
${latestUserAction}

Fais un résumé de 150 mots maximum de la situation exacte, des personnages présents et de la tension immédiate.`;
}

export function buildPipelineWriterUserPrompt(scribeSummary: string): string {
  return `Résumé validé de la situation:
${cleanText(scribeSummary, 1500)}

Écris la suite immédiate de la scène en 2 à 3 paragraphes, avec une prose Star Wars forte (action, ambiance, dialogue).`;
}

export function buildPipelineDirectorUserPrompt(
  scribeSummary: string,
  playerAction: string,
  turnNumber: number
): string {
  return `Tour ${turnNumber}. Résumé validé de la situation:
${cleanText(scribeSummary, 1200)}

ACTION JOUEUR CANONIQUE:
${cleanText(playerAction, 240)}

Réponds EXCLUSIVEMENT en JSON strict avec ce contrat:
{
  "player_action": "reformulation courte et fidèle",
  "scene_goal": "but dramatique immédiat de la scène",
  "tension": "pression ou menace immédiate",
  "must_include": ["2 à 4 éléments concrets à montrer"],
  "required_world_signals": ["location|npc|factions|hp|credits|injury|inventory"],
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "atmosphere": "tense|calm|mysterious|eerie|heroic"
}

Contraintes:
- "player_action" doit rester très proche de l'action du joueur.
- "must_include" = détails visuels/comportementaux, pas des abstractions creuses.
- "required_world_signals" doit contenir au moins un signal monde réellement exploitable.`;
}

export function buildPipelineWriterUserPromptWithDirector(
  scribeSummary: string,
  directorBrief: {
    player_action: string;
    scene_goal: string;
    tension: string;
    must_include: string[];
    required_world_signals: string[];
    section_type?: string;
    atmosphere?: string;
  }
): string {
  const mustInclude = directorBrief.must_include.length
    ? directorBrief.must_include.map(item => `- ${cleanText(item, 100)}`).join('\n')
    : '- Montrer une conséquence immédiate de l’action du joueur';

  const worldSignals = directorBrief.required_world_signals.length
    ? directorBrief.required_world_signals.map(item => `- ${cleanText(item, 40)}`).join('\n')
    : '- location';

  return `Résumé validé de la situation:
${cleanText(scribeSummary, 1200)}

BRIEF DU DIRECTEUR:
- Action joueur: ${cleanText(directorBrief.player_action, 200)}
- But de scène: ${cleanText(directorBrief.scene_goal, 200)}
- Tension: ${cleanText(directorBrief.tension, 200)}
- Section visée: ${cleanText(directorBrief.section_type, 40) || 'action'}
- Atmosphère: ${cleanText(directorBrief.atmosphere, 40) || 'tense'}

Éléments obligatoires:
${mustInclude}

Signaux monde à rendre exploitables:
${worldSignals}

ACTION À RENDRE (NON NÉGOCIABLE):
${cleanText(directorBrief.player_action, 240)}

Écris la scène maintenant.
Contraintes:
- 2 à 3 paragraphes maximum.
- La première impulsion de la scène doit montrer la conséquence directe de l'action joueur.
- Si l'action est impossible, traite-la comme tentative crédible et montre un résultat concret (coût, échec partiel, opportunité, blessure, dette, révélation).
- Action et narration dans la prose.
- Les dialogues vont dans des répliques séparées au format "Nom : réplique".
- Pas de choix, pas de JSON, pas de markdown.`;
}

export function buildPipelineBrainUserPrompt(
  writerScene: string,
  directorBrief?: {
    player_action?: string;
    required_world_signals?: string[];
    section_type?: string;
    atmosphere?: string;
  }
): string {
  const expectedPlayerAction = cleanText(directorBrief?.player_action, 240);
  const playerActionBlock = expectedPlayerAction
    ? `\nACTION JOUEUR APPLIQUÉE (référence canonique):\n${expectedPlayerAction}`
    : '';
  const requiredSignals = directorBrief?.required_world_signals?.length
    ? `\nSIGNAUX MONDE ATTENDUS:\n${directorBrief.required_world_signals.map(item => `- ${cleanText(item, 40)}`).join('\n')}`
    : '';

  const expectedSectionType = cleanText(directorBrief?.section_type, 40);
  const expectedAtmosphere = cleanText(directorBrief?.atmosphere, 40);

  return `Voici la scène qui vient de se dérouler:
${cleanText(writerScene, 2800)}${playerActionBlock}${requiredSignals}

Déduis-en les conséquences mécaniques et propose 3 choix pour la suite.
Réponds EXCLUSIVEMENT en JSON strict (sans markdown) avec ce contrat:
{
  "chapter_title": "Titre court, évocateur et créatif (ex: 'Ombres du Passé', 'Péril à l'Enclave'). JAMAIS 'Tour N' ou 'Chapitre N'.",
  "section_type": "${expectedSectionType || 'action'}",
  "atmosphere": "${expectedAtmosphere || 'tense'}",
  "state_update": {
    "hp": 0,
    "credits": 0,
    "location": "",
    "date_advance": "",
    "npcs": [{ "name": "", "affinity": 0, "status": "neutral", "alive": true }],
    "factions": {},
    "injuries_new": [],
    "injuries_resolved": [],
    "inventory_gained": [],
    "inventory_lost": []
  },
  "memory_updates": {
    "relations": [],
    "places": [],
    "injuries": [],
    "resources": [],
    "notes": []
  },
  "choices": [
    { "text": "", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 2, "faction_impact": {} }
  ]
}

- "chapter_title": Doit être un titre de scène extrêmement soigné, évocateur, captivant et entièrement rédigé en FRANÇAIS (ou la langue de la scène). Évite absolument les redondances ou de simplement copier la première phrase.
- Les choices doivent découler de la conséquence directe de l'action joueur ci-dessus.
- "section_type" et "atmosphere" doivent coller à la scène réellement écrite.
- Les champs non pertinents peuvent être omis.`;
}

export function getPromptLanguageInstructions(languageCode?: string): { name: string; instruction: string } {
  const code = (languageCode || 'fr').toLowerCase().trim();

  const langNames: Record<string, string> = {
    fr: 'FRANÇAIS',
    en: 'ENGLISH',
    es: 'ESPAÑOL',
    de: 'DEUTSCH',
    it: 'ITALIANO',
    pt: 'PORTUGUÊS',
    ja: '日本語 (JAPANESE)',
    zh: '中文 (CHINESE)'
  };

  const targetLang = langNames[code] || 'FRANÇAIS';

  return {
    name: targetLang,
    instruction: `LANGUE OBLIGATOIRE — ${targetLang}: tout le texte que tu génères (chapter_title, narrative.action, narrative.dialogue, narrative.reflection, atmosphere, et chaque choices[].text) doit être rédigé ENTIÈREMENT EN ${targetLang}, quelle que soit la langue de la prémisse, de la mémoire ou de l'action du joueur. Ne change JAMAIS de langue. N'écris pas d'autres langues. Ne réponds jamais en anglais si la langue demandée est différente.`
  };
}

export function buildSystemPrompt(
  setup: StorySetupSnapshot & { language?: string },
  memoryFacts: string[],
  worldState?: WorldState,
  _promptMode: StoryPromptMode = 'json',
  campaignArchive: string[] = [],
  languageCode?: string
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

    const criticalStr = p.condition === 'critical'
      ? `\n\nÉTAT CRITIQUE (OBLIGATOIRE): le protagoniste est tombé à 0 PV — hors-combat, mourant ou capturé. Ce tour est une tentative de survie/sauvetage: PAS de mort définitive. Montre le danger immédiat et une porte de sortie crédible (secours, soin, reddition, fuite). Si le joueur survit/est soigné, hp doit redevenir > 0.`
      : '';
    const envStr = worldState.environment_status ? `\nCondition Environnementale:\n  • ${worldState.environment_status}` : '';
    const clocksStr = Object.keys(worldState.clocks || {}).length ? `\nHorloges de Tension:\n${Object.entries(worldState.clocks || {}).map(([id, c]) => `  • ${id} [${c.current}/${c.max}]`).join('\n')}` : '';
    const rumorsStr = (worldState.rumors || []).length ? `\nRumeurs locales:\n${(worldState.rumors || []).map(r => `  • ${r}`).join('\n')}` : '';
    const sectorsStr = Object.keys(worldState.sector_influence || {}).length ? `\nInfluence Sectorielle:\n${Object.entries(worldState.sector_influence || {}).map(([id, val]) => `  • ${id}: ${val}%`).join('\n')}` : '';
    const directorStr = worldState.director_instruction ? `\n\nDIRECTIVE DU DIRECTEUR DE JEU (OBLIGATOIRE):\n" ${worldState.director_instruction} "` : '';

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
${factionLines}${envStr}${clocksStr}${sectorsStr}${rumorsStr}${directorStr}${criticalStr}`;
  }

  // ── Memory block ──────────────────────────────
  const memoryContext = memoryFacts.length
    ? `\nMÉMOIRE NARRATIVE (faits établis):\n${memoryFacts.map(item => `- ${item}`).join('\n')}`
    : '';

  const campaignArchiveContext = campaignArchive.length
    ? `\nRÉSUMÉ DE CAMPAGNE (tours anciens condensés):\n${campaignArchive.map(item => `- ${cleanText(item, 260)}`).join('\n')}`
    : '';

  const lang = languageCode || setup.language || 'fr';
  const { name: langName, instruction: langInstruction } = getPromptLanguageInstructions(lang);

  const basePrompt = `${langInstruction}

Tu es un Maître du Jeu Star Wars d'élite. Tu écris avec précision et cinéma — chaque ligne doit créer tension, émotion ou révélation. Zéro remplissage.

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
13. DIALOGUES: chaque réplique doit être sur son propre paragraphe, au format "Nom : réplique" (préfixe "—" optionnel), et placée dans "narrative.dialogue". Ne colle jamais une réplique au milieu d'un paragraphe d'action.
14. DIALOGUES OBLIGATOIREMENT DANS narrative.dialogue: chaque échange verbal doit être placé dans le champ "dialogue", jamais dans "action". "action" = narration pure et actions, "dialogue" = tous les échanges verbaux. Si un personnage parle, utilise ce champ dédié.;`;

  const jsonContract = `Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour. TOUT le texte des champs est rédigé ENTIÈREMENT EN ${langName} (jamais dans une autre langue). Priorité absolue: prose narrative riche dans "action" (2-4 paragraphes). Remplis state_update avec toutes les conséquences.

{
  "chapter_title": "Titre de scène évocateur — jamais Chapitre N",
  "chapter_number": "entier (le numéro du tour actuel)",
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "narrative": {
    "action": "Narration pure — actions, descriptions, sensations, tensions. AUCUN dialogue ici. Max 3 paragraphes.",
    "dialogue": "Tous les échanges verbaux — chaque réplique sur sa propre ligne au format Nom : réplique (préfixe — optionnel). Ex: Leia : « Je comprends votre inquiétude. »",
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

  return `${basePrompt}${narrativeProseRule}\n\n${jsonContract}`;
}

export function buildStartPrompt(
  setup: StorySetupSnapshot & { language?: string },
  selectedTrameLabel?: string | null,
  _promptMode: StoryPromptMode = 'json',
  languageCode?: string
): string {
  const firstName = cleanText(setup.protagonistFirstName, 60);
  const lastName = cleanText(setup.protagonistLastName, 60);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'le protagoniste';

  const eraContext = ERA_CONTEXT[setup.era || ''] || 'Galaxie lointaine, très lointaine — une époque de conflits, de choix lourds et de destins qui basculent.';

  const lang = languageCode || setup.language || 'fr';
  const { name: langName } = getPromptLanguageInstructions(lang);

  return `Lance une histoire interactive Star Wars avec un prologue immédiatement jouable.

ACTION JOUEUR CANONIQUE: Entrer dans la scène d'ouverture et survivre aux premières secondes.

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
- Ouvre in medias res, sans préambule explicatif, rédigé ENTIÈREMENT EN ${langName} (jamais dans une autre langue).
- Donne immédiatement une tension claire, un lieu vivant et un objectif en ${langName}.
- Introduis au moins 1 PNJ mémorable avec un agenda distinct.
- Fais émerger un enjeu politique, relationnel ou moral dès l'ouverture.
- Les 3-4 choix doivent être concrets, contrastés, rédigés en ${langName} et portés par la scène.
- Respecte strictement le rôle canonique choisi (${setup.role}). N'invente pas de promotion de rang au lancement.
- Le lieu de départ doit être explicite et exploitable pour l'état monde.
- Le texte de scène ne doit contenir ni markdown ni liste de choix.
- Tout dialogue doit être isolé sur sa propre ligne, au format "Nom : réplique" (préfixe — optionnel), et séparé du reste de l'action par un retour à la ligne.
- chapter_number = 1
- Les dialogues vont dans le champ "dialogue", jamais dans "action".
- Le tour 1 doit permettre d'extraire state_update.location et au moins un PNJ nommé.`;
}

export function buildContinuePrompt(
  actionText: string,
  turnNumber: number,
  recentSummary: string[],
  _promptMode: StoryPromptMode = 'json',
  recentSectionTypes: string[] = [],
  recentChoiceTexts: string[] = [],
  sceneAnchor: string = '',
  outcomeDirective: string = '',
  languageCode?: string
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
  const outcomeBlock = outcomeDirective ? `${outcomeDirective}\n` : '';

  const lang = languageCode || 'fr';
  const { name: langName } = getPromptLanguageInstructions(lang);

  return `${anchorBlock}ACTION JOUEUR CANONIQUE: ${cleanText(actionText, 280)}
${outcomeBlock}OBLIGATION: la scène suivante doit traiter cette action comme cause immédiate (ou tentative avec conséquence concrète), rédigée ENTIÈREMENT EN ${langName} (jamais dans une autre langue).

Tour ${turnNumber}. Action: "${cleanText(actionText, 280)}".${history}${recentChoicesBlock}${pacingDirective}

Écris une scène forte et précise en ${langName} — conséquences réelles, PNJs avec mémoire et intention propre.
Ne mets aucun markdown, aucun titre interne et aucun bloc de choix dans le récit.
Chaque réplique doit être sur une ligne distincte, au format "Nom : réplique" (préfixe — optionnel), et jamais noyée dans un paragraphe d'action.
Propose 3-4 choix distincts, concrets, rédigés en ${langName}, ancrés dans cette scène précise (pas génériques).
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
    ...chapter.memory_updates.relations.slice(0, 5).map(item => cleanText(item, 80)),
    ...chapter.memory_updates.places.slice(0, 3).map(item => cleanText(item, 80)),
    ...chapter.memory_updates.injuries.slice(0, 3).map(item => cleanText(item, 80)),
    ...chapter.memory_updates.resources.slice(0, 3).map(item => cleanText(item, 80)),
    ...chapter.memory_updates.notes.slice(0, 4).map(item => cleanText(item, 100))
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
