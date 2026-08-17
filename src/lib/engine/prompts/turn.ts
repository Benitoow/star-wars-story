import { ERA_CONTEXT } from '$lib/content/catalog';
import { cleanText } from '../text';
import type { MemoryFact, SectionType, StorySetup, WorldState } from '../types';
import { languageName } from './language';
import { styleDirective } from './style';
import { renderWorldBlock } from './system';
import { foldArchive, renderMemoryBlock } from '../memory';

const ACTION_HEAVY: SectionType[] = ['action', 'confrontation'];

function displayName(setup: StorySetup): string {
  return [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'le protagoniste';
}

/** Turn 1 — open the adventure with an immediately playable prologue. */
export function buildStartPrompt(setup: StorySetup, trameLabel?: string | null): string {
  const lang = setup.language || 'fr';
  const langName = languageName(lang);
  const eraContext = ERA_CONTEXT[setup.era] || 'Galaxie lointaine — une époque de conflits et de destins qui basculent.';

  return `Lance une histoire interactive Star Wars avec un prologue immédiatement jouable.

ACTION JOUEUR CANONIQUE : entrer dans la scène d'ouverture et survivre aux premières secondes.

DIRECTIVE STYLISTIQUE : ${styleDirective(setup.writingStyle, setup.writingTone)}

CADRE D'OUVERTURE :
- Protagoniste : ${displayName(setup)}
- Ère : ${setup.era} — ${eraContext}
- Faction : ${setup.faction || 'libre'} · Rôle : ${setup.role || 'aventurier'}
- Trame : ${trameLabel || 'Libre'}
- Prémisse : ${setup.premise || 'Crée une situation tendue et immédiatement jouable.'}

EXIGENCES DU PREMIER TOUR (rédige ENTIÈREMENT EN ${langName}) :
- Ouvre par une vraie introduction cinématique du protagoniste : qui il est, son background immédiat lié à son rôle (${setup.role}) et sa trame, pourquoi il est là, la tension qui pèse.
- Choisis un lieu de départ cohérent avec le protagoniste et sa trame, et renseigne-le dans state_update.location.
- Donne une tension claire, un lieu vivant, un objectif de campagne et au moins 1 PNJ mémorable avec un agenda propre.
- Initialise campaign_update avec un titre, un objectif concret et une première progression vérifiable.
- 3 à 4 choix concrets et contrastés, dont au moins deux avec des coûts opposés ; chaque choix renseigne tradeoff et stakes.
- Si un objet de départ est pertinent, une option le référence via requires_items/consumes_items.
- Attribue 5 à 15 XP pour le lancement, pas davantage.
- Respecte strictement le rôle canonique (${setup.role}) — pas de promotion au lancement.
- Dialogues isolés sur leur ligne au format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
- chapter_number = 1.`;
}

/**
 * The variable context of a turn (world state, retrieved memory, archive) —
 * injected into the FINAL user message so the system prompt stays stable and
 * the provider's input cache keeps covering the system + transcript prefix.
 */
export function buildTurnContextBlock(
  setup: StorySetup,
  world: WorldState,
  memory: MemoryFact[],
  archive: string[] = []
): string {
  const protagonist = displayName(setup);
  const blocks: string[] = [renderWorldBlock(world, protagonist)];
  const memoryBlock = renderMemoryBlock(memory);
  if (memoryBlock) blocks.push(memoryBlock);
  const foldedArchive = foldArchive(archive);
  if (foldedArchive.length) {
    blocks.push(`RÉSUMÉ DES TOURS ANCIENS (condensés pour la continuité — ne pas répéter mot à mot) :\n${foldedArchive.map((a) => `- ${a}`).join('\n')}`);
  }
  return blocks.filter(Boolean).join('\n');
}

/** Subsequent turns — react to the player's action with real consequences. */
export function buildContinuePrompt(
  actionText: string,
  turnNumber: number,
  recentSectionTypes: string[] = [],
  recentChoiceTexts: string[] = [],
  languageCode?: string,
  outcomeDirective = '',
  playerDirectives: string[] = [],
  overusedTerms: string[] = [],
  contextBlock = ''
): string {
  const langName = languageName(languageCode || 'fr');
  const action = cleanText(actionText, 280);
  const variety = overusedTerms.length
    ? `\nVARIÉTÉ : ces mots reviennent trop dans l'histoire — évite de les réemployer par réflexe, varie le vocabulaire : ${overusedTerms.join(', ')}.`
    : '';

  // History is carried by the raw transcript messages now — this prompt only
  // adds the current action, the player canon, choice de-dup and pacing.
  const outcome = outcomeDirective ? `${outcomeDirective}\n` : '';
  const recentDirectives = playerDirectives.map((d) => d.trim()).filter(Boolean).slice(-8);
  const canon = recentDirectives.length
    ? `\nCANON DU JOUEUR (à respecter absolument, ne jamais contredire — ex: ne pas faire apparaître un groupe qu'il a exclu) :\n${recentDirectives.map((d) => `- ${d}`).join('\n')}`
    : '';

  const recentChoices = Array.from(new Set(recentChoiceTexts.map((c) => cleanText(c, 160)).filter(Boolean))).slice(-20);
  const choicesBlock = recentChoices.length ? `\nChoix déjà proposés à éviter : ${recentChoices.map((c) => `"${c}"`).join(' | ')}` : '';

  let consecutiveIntense = 0;
  for (let i = recentSectionTypes.length - 1; i >= 0; i -= 1) {
    if (ACTION_HEAVY.includes(recentSectionTypes[i] as SectionType)) consecutiveIntense += 1;
    else break;
  }
  const pacing = consecutiveIntense >= 2
    ? `\nRYTHME : ${consecutiveIntense} scènes intenses d'affilée — ce tour DOIT être repos, dialogue ou exploration.`
    : '';

  const context = contextBlock ? `${contextBlock}\n\n` : '';
  return `${context}ACTION JOUEUR CANONIQUE : ${action}
${outcome}OBLIGATION : la scène suivante traite cette action comme cause immédiate (ou tentative avec conséquence concrète), rédigée ENTIÈREMENT EN ${langName}.

Tour ${turnNumber}.${canon}${choicesBlock}${pacing}${variety}

Écris une scène forte et précise — conséquences réelles, PNJs avec mémoire et intention propre.
Aucun markdown, aucun titre interne, aucun bloc de choix dans le récit.
Dialogues : chaque réplique sur sa ligne au format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
Propose 3 à 4 choix physiques, verbaux ou tactiques très précis et ancrés dans cette scène exacte (INTERDIT : "Observer les alentours", "Méditer", "Négocier", "Préparer un plan"). Les choix doivent être mutuellement exclusifs : au moins deux sacrifient des ressources différentes (temps, sécurité, allié, argent ou information) et remplissent tradeoff/stakes.
Si un objet pertinent figure dans l'inventaire, propose une option qui l'utilise avec requires_items/consumes_items ; ne crée jamais d'objet absent.
Mets à jour campaign_update.progress pour dire comment cette scène rapproche ou éloigne l'objectif de campagne. Si du temps passe, ajoute au maximum 1 ou 2 world_events_new plausibles ; ne transforme pas une prédiction en fait.
Fournis au moins un signal monde (location ou PNJ nommé).
chapter_number = ${turnNumber}.`;
}
