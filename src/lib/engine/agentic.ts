/* ═══════════════════════════════════════════════
   Agentic multi-agent pipeline. The Scribe step is the
   precomputed recap (recentSummary), so the live calls are
   Director → Writer → Brain. Richer, slower than one-shot
   structured-json; same StoryChapter contract out.
══════════════════════════════════════════════ */
import { cleanText, isRecord } from './text';
import { parseStoryResponse, sanitizeProse } from './parsing';
import { callTextModel } from './provider';
import { languageInstruction, languageName } from './prompts/language';
import { ERA_COHERENCE, styleDirective, contentModeDirective } from './prompts/style';
import { renderWorldBlock, renderWorldDigest } from './prompts/system';
import type { ChatMessage, StoryChapter, StoryProviderConfig, StorySetup, WorldState } from './types';

const DIRECTOR_SYSTEM = `Tu es le DIRECTEUR de scène d'une campagne Star Wars. Tu transformes l'action du joueur en brief de scène concret et court. Réponds UNIQUEMENT en JSON valide, aucune prose autour.`;

const BRAIN_SYSTEM = `Tu es le CERVEAU mécanique d'une campagne Star Wars. Tu extrais les conséquences d'une scène déjà écrite. Réponds UNIQUEMENT en JSON valide, aucune prose autour.`;

const REVIEWER_SYSTEM = `Tu es le RELECTEUR d'une campagne Star Wars : tu transformes une scène brute en version finale, plus forte, SANS en changer les faits.
Règles ABSOLUES :
- Ne change NI les événements, NI les personnages, NI le lieu, NI l'issue de l'action — uniquement l'écriture.
- Supprime les répétitions et les formules creuses ; renforce la première phrase ; resserre le rythme.
- VARIÉTÉ : si des mots reviennent trop d'une scène à l'autre (couleurs, images « signatures »), remplace-les activement par des synonymes ou d'autres images. Ne laisse pas un tic de vocabulaire s'installer.
- 2 à 3 paragraphes. Aucune sortie technique (ni JSON, ni markdown, ni liste). Aucun choix.
- Dialogues : chaque réplique sur sa ligne, format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
- Réponds UNIQUEMENT avec la scène finale réécrite.`;

function writerSystem(setup: StorySetup, turnNumber: number, world: WorldState, canon: string, archive: string[], overusedTerms: string[]): string {
  const protagonist = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'Le protagoniste';
  const prologue = turnNumber <= 1
    ? `\n- TOUR 1 : commence par une riche introduction du protagoniste (${protagonist}) — origines liées à son rôle (${setup.role}) et sa faction (${setup.faction}), situation actuelle, tension immédiate — avant l'action.`
    : '';
  const archiveBlock = archive.length
    ? `\nRÉSUMÉ DES TOURS ANCIENS (continuité, ne pas répéter mot à mot) :\n${archive.map((a) => `- ${a}`).join('\n')}`
    : '';
  return `${languageInstruction(setup.language)}

Tu es l'ÉCRIVAIN d'une campagne Star Wars d'élite : prose cinématique, immersive, soignée. Les messages précédents sont la scène déjà jouée — écris la SUITE en continuité.
Protagoniste : ${protagonist} | Ère : ${setup.era} | Faction : ${setup.faction} | Rôle : ${setup.role}
Style : ${setup.writingStyle || 'cinématique'} · Ton : ${setup.writingTone || 'aventure'} · Contenu : ${setup.contentMode || 'cinematic'}
${renderWorldBlock(world, protagonist)}${archiveBlock}

RÈGLES :
1. Écris 2 à 3 paragraphes. Aucune sortie technique (ni JSON, ni markdown, ni liste).
2. Ne propose AUCUN choix.
3. COHÉRENCE MONDE : respecte scrupuleusement l'état ci-dessus — lieu actuel, PV/blessures, et surtout les PNJ (n'utilise QUE des personnages vivants connus ou nouvellement introduits ; ne fais jamais réapparaître un mort).
4. DIRECTIVE STYLE : ${styleDirective(setup.writingStyle, setup.writingTone)}
5. DIRECTIVE CONTENU : ${contentModeDirective(setup.contentMode)}
6. ${ERA_COHERENCE}
6. RÔLE CANONIQUE IMMUABLE : garde le rôle "${setup.role}".
7. Dialogues : chaque réplique sur sa ligne, format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
8. CANON DU JOUEUR & ESCALADE : respecte les faits que le joueur a établis (ci-dessous) ; ne les contredis jamais et n'introduis pas un groupe/élément qu'il a exclu. Un lieu civil (marché, cantina) reste civil sans escalade fortement justifiée — pas de stormtroopers en masse ni de marcheurs/AT-ST surgissant sans cause proportionnée.${prologue}${canon}${varietyNote(overusedTerms)}`;
}

function directorUser(summary: string, action: string, turnNumber: number, digest: string, canon: string): string {
  return `Tour ${turnNumber}. Situation : ${cleanText(summary, 1200) || '(ouverture)'}

ÉTAT DU MONDE :
${digest}${canon}

Action joueur : ${cleanText(action, 240)}

Réponds en JSON strict :
{
  "scene_goal": "but dramatique immédiat",
  "tension": "pression ou menace immédiate",
  "must_include": ["2 à 4 éléments concrets à montrer"],
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "atmosphere": "tense|calm|mysterious|eerie|heroic"
}`;
}

function writerUser(brief: Record<string, unknown>, action: string, outcomeDirective: string): string {
  const mustInclude = Array.isArray(brief.must_include) ? brief.must_include.map((m) => `- ${cleanText(m, 100)}`).join('\n') : '- Conséquence directe de l\'action';
  return `But de scène : ${cleanText(brief.scene_goal, 200)}
Tension : ${cleanText(brief.tension, 200)}
Éléments obligatoires :
${mustInclude}

ACTION À RENDRE : ${cleanText(action, 240)}
${outcomeDirective ? `${outcomeDirective}\n` : ''}Écris la suite immédiate (2 à 3 paragraphes), en continuité directe de la scène précédente ci-dessus. La première impulsion montre la conséquence de l'action.`;
}

function brainUser(prose: string, brief: Record<string, unknown>, digest: string): string {
  return `ÉTAT ACTUEL DU MONDE (avant cette scène) :
${digest}

Voici la scène qui vient de se dérouler :
${cleanText(prose, 2800)}

Déduis-en les conséquences mécaniques, COHÉRENTES avec l'état ci-dessus : hp et credits sont des DELTAS signés (ex: hp:-15) ; ne ressuscite jamais un mort ; réutilise les PNJ existants par leur nom EXACT (pas de doublon). Propose 3 à 4 choix concrets, uniques à cette scène (INTERDIT : choix génériques type "Observer", "Méditer"). Réponds en JSON strict :
{
  "chapter_title": "Titre évocateur — jamais Chapitre N",
  "section_type": "${cleanText(brief.section_type, 40) || 'action'}",
  "narrative": { "atmosphere": "${cleanText(brief.atmosphere, 40) || 'tense'}" },
  "state_update": { "hp": 0, "credits": 0, "location": "", "npcs": [], "factions": {}, "injuries_new": [], "inventory_gained": [] },
  "memory_updates": { "relations": [], "places": [], "notes": [] },
  "choices": [ { "text": "", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 3, "faction_impact": {} } ]
}`;
}

function reviewerUser(draft: string, brief: Record<string, unknown>, digest: string, overusedTerms: string[]): string {
  const mustInclude = Array.isArray(brief.must_include) ? brief.must_include.map((m) => cleanText(m, 80)).filter(Boolean).join(' ; ') : '';
  return `ÉTAT DU MONDE (à respecter, ne rien contredire) :
${digest}
${mustInclude ? `\nÉléments imposés de la scène : ${mustInclude}` : ''}${varietyNote(overusedTerms)}

SCÈNE BRUTE À PEAUFINER :
${cleanText(draft, 3000)}

Livre la version finale : mêmes faits, même issue, meilleure écriture (et vocabulaire varié si des mots récurrents sont signalés ci-dessus).`;
}

/** Split mixed writer prose into action vs "Nom : réplique" dialogue lines. */
function splitProse(prose: string): { action: string; dialogue: string } {
  const speaker = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9'’ .-]{2,40}\s*:\s+\S/;
  const action: string[] = [];
  const dialogue: string[] = [];
  for (const block of prose.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    (speaker.test(trimmed) ? dialogue : action).push(trimmed);
  }
  return { action: action.join('\n\n'), dialogue: dialogue.join('\n') };
}

export interface AgenticContext {
  setup: StorySetup;
  worldState: WorldState;
  turnNumber: number;
  actionText: string;
  situation: string;            // compressed story-so-far for the Director
  transcript: ChatMessage[];    // raw recent scenes (conversation) for the Writer
  archive: string[];            // older turns, condensed (into the Writer's system)
  outcomeDirective?: string;
  playerDirectives?: string[];
  overusedTerms?: string[];     // words the model has leaned on across recent scenes
}

function varietyNote(overusedTerms: string[] = []): string {
  return overusedTerms.length
    ? `\nVARIÉTÉ (IMPORTANT) : ces mots reviennent trop d'une scène à l'autre — ne les réemploie pas par réflexe, varie le vocabulaire et les images : ${overusedTerms.join(', ')}.`
    : '';
}

function playerCanonBlock(playerDirectives: string[] = []): string {
  const recent = playerDirectives.map((d) => d.trim()).filter(Boolean).slice(-6);
  if (!recent.length) return '';
  return `\nCANON DU JOUEUR (à respecter absolument, ne jamais contredire ; n'introduis pas un groupe/élément qu'il a exclu) :\n${recent.map((d) => `- ${d}`).join('\n')}`;
}

/** Run Director → Writer → Brain and assemble a StoryChapter (raw = writer prose). */
export async function runAgenticTurn(
  ctx: AgenticContext,
  provider: StoryProviderConfig
): Promise<{ chapter: StoryChapter; raw: string }> {
  const lang = ctx.setup.language || 'fr';
  const digest = renderWorldDigest(ctx.worldState);
  const canon = playerCanonBlock(ctx.playerDirectives);

  // 1. Director — scene brief (JSON), planned from the condensed story-so-far
  const briefRaw = await callTextModel(
    [{ role: 'system', content: `${languageInstruction(lang)}\n\n${DIRECTOR_SYSTEM}` }, { role: 'user', content: directorUser(ctx.situation, ctx.actionText, ctx.turnNumber, digest, canon) }],
    provider,
    { jsonMode: true, skipReasoning: true }
  );
  const brief = (function () {
    try {
      const p = JSON.parse(briefRaw.replace(/^```json\s*|```$/gi, '').trim());
      return isRecord(p) ? p : {};
    } catch {
      return {};
    }
  })();

  // 2. Writer — cinematic prose, grounded in the world block + archive and
  // reading the RAW recent scenes (transcript) as the conversation so far.
  const draft = await callTextModel(
    [
      { role: 'system', content: writerSystem(ctx.setup, ctx.turnNumber, ctx.worldState, canon, ctx.archive, ctx.overusedTerms ?? []) },
      ...ctx.transcript,
      { role: 'user', content: writerUser(brief, ctx.actionText, ctx.outcomeDirective ?? '') }
    ],
    provider
  );

  // 3. Reviewer — polish the scene (same facts, sharper writing). Falls back to the
  // draft if it returns nothing usable.
  let prose = draft;
  try {
    const reviewed = await callTextModel(
      [{ role: 'system', content: `${languageInstruction(lang)}\n\n${REVIEWER_SYSTEM}` }, { role: 'user', content: reviewerUser(draft, brief, digest, ctx.overusedTerms ?? []) }],
      provider
    );
    if (reviewed.trim().length >= 40) prose = reviewed;
  } catch {
    /* keep the draft — a reviewer failure must never lose the scene */
  }

  // 4. Brain — mechanical consequences + choices (JSON) from the final prose
  const brainRaw = await callTextModel(
    [{ role: 'system', content: `${languageInstruction(lang)} TOUT le texte est en ${languageName(lang)}.\n\n${BRAIN_SYSTEM}` }, { role: 'user', content: brainUser(prose, brief, digest) }],
    provider,
    { jsonMode: true }
  );

  // Assemble: final prose into narrative, brain JSON for mechanics — then reuse
  // parseStoryResponse for sanitization (incl. the dash ban) + validation.
  const brain = parseStoryResponse(brainRaw, ctx.turnNumber);
  const { action, dialogue } = splitProse(prose);
  const assembled: StoryChapter = {
    ...brain,
    section_type: brain.section_type || cleanText(brief.section_type, 40) || 'action',
    narrative: {
      action: sanitizeProse(action || prose, 5500),
      dialogue: sanitizeProse(dialogue, 2200),
      reflection: '',
      atmosphere: brain.narrative.atmosphere || cleanText(brief.atmosphere, 40) || 'tense'
    }
  };
  return { chapter: assembled, raw: prose };
}
