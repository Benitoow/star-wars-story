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
import { ERA_COHERENCE, styleDirective } from './prompts/style';
import type { StoryChapter, StoryProviderConfig, StorySetup } from './types';

const DIRECTOR_SYSTEM = `Tu es le DIRECTEUR de scène d'une campagne Star Wars. Tu transformes l'action du joueur en brief de scène concret et court. Réponds UNIQUEMENT en JSON valide, aucune prose autour.`;

const BRAIN_SYSTEM = `Tu es le CERVEAU mécanique d'une campagne Star Wars. Tu extrais les conséquences d'une scène déjà écrite. Réponds UNIQUEMENT en JSON valide, aucune prose autour.`;

function writerSystem(setup: StorySetup, turnNumber: number): string {
  const protagonist = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'Le protagoniste';
  const prologue = turnNumber <= 1
    ? `\n- TOUR 1 : commence par une riche introduction du protagoniste (${protagonist}) — origines liées à son rôle (${setup.role}) et sa faction (${setup.faction}), situation actuelle, tension immédiate — avant l'action.`
    : '';
  return `${languageInstruction(setup.language)}

Tu es l'ÉCRIVAIN d'une campagne Star Wars d'élite : prose cinématique, immersive, soignée.
Protagoniste : ${protagonist} | Ère : ${setup.era} | Faction : ${setup.faction} | Rôle : ${setup.role}
Style : ${setup.writingStyle || 'cinématique'} · Ton : ${setup.writingTone || 'aventure'}

RÈGLES :
1. Écris 2 à 3 paragraphes. Aucune sortie technique (ni JSON, ni markdown, ni liste).
2. Ne propose AUCUN choix.
3. DIRECTIVE : ${styleDirective(setup.writingStyle, setup.writingTone)}
4. ${ERA_COHERENCE}
5. RÔLE CANONIQUE IMMUABLE : garde le rôle "${setup.role}".
6. Dialogues : chaque réplique sur sa ligne, format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).${prologue}`;
}

function directorUser(summary: string, action: string, turnNumber: number): string {
  return `Tour ${turnNumber}. Situation : ${cleanText(summary, 1200) || '(ouverture)'}
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

function writerUser(summary: string, brief: Record<string, unknown>, action: string, outcomeDirective: string): string {
  const mustInclude = Array.isArray(brief.must_include) ? brief.must_include.map((m) => `- ${cleanText(m, 100)}`).join('\n') : '- Conséquence directe de l\'action';
  return `Situation : ${cleanText(summary, 1000) || '(ouverture de l\'aventure)'}
But de scène : ${cleanText(brief.scene_goal, 200)}
Tension : ${cleanText(brief.tension, 200)}
Éléments obligatoires :
${mustInclude}

ACTION À RENDRE : ${cleanText(action, 240)}
${outcomeDirective ? `${outcomeDirective}\n` : ''}Écris la scène maintenant (2 à 3 paragraphes). La première impulsion montre la conséquence directe de l'action.`;
}

function brainUser(prose: string, brief: Record<string, unknown>): string {
  return `Voici la scène qui vient de se dérouler :
${cleanText(prose, 2800)}

Déduis-en les conséquences mécaniques et propose 3 à 4 choix concrets, uniques à cette scène (INTERDIT : choix génériques type "Observer", "Méditer"). Réponds en JSON strict :
{
  "chapter_title": "Titre évocateur — jamais Chapitre N",
  "section_type": "${cleanText(brief.section_type, 40) || 'action'}",
  "narrative": { "atmosphere": "${cleanText(brief.atmosphere, 40) || 'tense'}" },
  "state_update": { "hp": 0, "credits": 0, "location": "", "npcs": [], "factions": {}, "injuries_new": [], "inventory_gained": [] },
  "memory_updates": { "relations": [], "places": [], "notes": [] },
  "choices": [ { "text": "", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 3, "faction_impact": {} } ]
}`;
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
  turnNumber: number;
  actionText: string;
  summary: string;
  outcomeDirective?: string;
}

/** Run Director → Writer → Brain and assemble a StoryChapter (raw = writer prose). */
export async function runAgenticTurn(
  ctx: AgenticContext,
  provider: StoryProviderConfig
): Promise<{ chapter: StoryChapter; raw: string }> {
  const lang = ctx.setup.language || 'fr';

  // 1. Director — scene brief (JSON)
  const briefRaw = await callTextModel(
    [{ role: 'system', content: `${languageInstruction(lang)}\n\n${DIRECTOR_SYSTEM}` }, { role: 'user', content: directorUser(ctx.summary, ctx.actionText, ctx.turnNumber) }],
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

  // 2. Writer — cinematic prose
  const prose = await callTextModel(
    [{ role: 'system', content: writerSystem(ctx.setup, ctx.turnNumber) }, { role: 'user', content: writerUser(ctx.summary, brief, ctx.actionText, ctx.outcomeDirective ?? '') }],
    provider
  );

  // 3. Brain — mechanical consequences + choices (JSON)
  const brainRaw = await callTextModel(
    [{ role: 'system', content: `${languageInstruction(lang)} TOUT le texte est en ${languageName(lang)}.\n\n${BRAIN_SYSTEM}` }, { role: 'user', content: brainUser(prose, brief) }],
    provider,
    { jsonMode: true }
  );

  // Assemble: writer prose into narrative, brain JSON for mechanics — then reuse
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
