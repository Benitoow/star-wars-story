import { ERA_CONTEXT } from '$lib/content/catalog';
import { cleanText } from '../text';
import type { SectionType, StorySetup } from '../types';
import { languageName } from './language';
import { styleDirective } from './style';

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
- Donne une tension claire, un lieu vivant, un objectif, et au moins 1 PNJ mémorable avec un agenda propre.
- 3 à 4 choix concrets et contrastés, ancrés dans la scène.
- Respecte strictement le rôle canonique (${setup.role}) — pas de promotion au lancement.
- Dialogues isolés sur leur ligne au format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
- chapter_number = 1.`;
}

/** Subsequent turns — react to the player's action with real consequences. */
export function buildContinuePrompt(
  actionText: string,
  turnNumber: number,
  recentSummary: string[] = [],
  recentSectionTypes: string[] = [],
  recentChoiceTexts: string[] = [],
  languageCode?: string,
  outcomeDirective = ''
): string {
  const langName = languageName(languageCode || 'fr');
  const action = cleanText(actionText, 280);

  const outcome = outcomeDirective ? `${outcomeDirective}\n` : '';
  const history = recentSummary.length ? `\nRésumé récent :\n${recentSummary.map((s) => `- ${s}`).join('\n')}` : '';

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

  return `ACTION JOUEUR CANONIQUE : ${action}
${outcome}OBLIGATION : la scène suivante traite cette action comme cause immédiate (ou tentative avec conséquence concrète), rédigée ENTIÈREMENT EN ${langName}.

Tour ${turnNumber}.${history}${choicesBlock}${pacing}

Écris une scène forte et précise — conséquences réelles, PNJs avec mémoire et intention propre.
Aucun markdown, aucun titre interne, aucun bloc de choix dans le récit.
Dialogues : chaque réplique sur sa ligne au format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
Propose 3 à 4 choix physiques, verbaux ou tactiques très précis et ancrés dans cette scène exacte (INTERDIT : "Observer les alentours", "Méditer", "Négocier", "Préparer un plan").
Fournis au moins un signal monde (location ou PNJ nommé).
chapter_number = ${turnNumber}.`;
}
