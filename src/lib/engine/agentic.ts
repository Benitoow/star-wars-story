/* ═══════════════════════════════════════════════
   Agentic multi-agent pipeline. The Scribe step is the
   precomputed recap (recentSummary), so the live calls are
   Director → Writer → Brain. Richer, slower than one-shot
   structured-json; same StoryChapter contract out.
══════════════════════════════════════════════ */
import { foldArchive, renderMemoryBlock } from './memory';
import { cleanText, isRecord } from './text';
import { parseStoryResponse, sanitizeProse } from './parsing';
import { looksLikeSpeakerLine } from './dialogue';
import { callTextModel, callTextModelStream } from './provider';
import { languageInstruction, languageName } from './prompts/language';
import { ERA_COHERENCE, ERA_HONESTY, styleDirective, contentModeDirective, lengthDirective, povDirective, renderGenesis } from './prompts/style';
import { renderWorldBlock, renderWorldDigest } from './prompts/system';
import type { CodexEntry } from './codex';
import type { ChatMessage, MemoryFact, StoryChapter, StoryProviderConfig, StorySetup, WorldState } from './types';

const DIRECTOR_SYSTEM = `Tu es le DIRECTEUR de scène d'une campagne Star Wars. Tu transformes l'action du joueur en brief de scène concret et court. Réponds UNIQUEMENT en JSON valide, aucune prose autour.\n\n${ERA_HONESTY}`;

const BRAIN_SYSTEM = `Tu es le CERVEAU mécanique d'une campagne Star Wars. Tu extrais les conséquences d'une scène déjà écrite. Réponds UNIQUEMENT en JSON valide, aucune prose autour.`;

const REVIEWER_SYSTEM = `Tu es le RELECTEUR d'une campagne Star Wars : tu transformes une scène brute en version finale, plus forte, SANS en changer les faits.
Règles ABSOLUES :
- Ne change NI les événements, NI les personnages, NI le lieu, NI l'issue de l'action — uniquement l'écriture.
- Supprime les répétitions et les formules creuses ; renforce la première phrase ; resserre le rythme.
- VARIÉTÉ : si des mots reviennent trop d'une scène à l'autre (couleurs, images « signatures »), remplace-les activement par des synonymes ou d'autres images. Ne laisse pas un tic de vocabulaire s'installer.
- 2 à 3 paragraphes. Aucune sortie technique (ni JSON, ni markdown, ni liste). Aucun choix.
- Dialogues : chaque réplique sur sa ligne, format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
- Réponds UNIQUEMENT avec la scène finale réécrite.`;

function writerSystem(setup: StorySetup, turnNumber: number, overusedTerms: string[], campaignDossier?: string): string {
  const protagonist = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'Le protagoniste';
  const prologue = turnNumber <= 1
    ? `\n- TOUR 1 : commence par une riche introduction du protagoniste (${protagonist}) — origines liées à son rôle (${setup.role}) et sa faction (${setup.faction}), situation actuelle, tension immédiate — avant l'action.`
    : '';
  const dossier = campaignDossier
    ? `\n\nDOSSIER DE CAMPAGNE (contexte factuel — repères d'époque à respecter, mais ne décide AUCUN événement au-delà de ce cadre) :\n${campaignDossier}`
    : '';
  // STABLE by design: world state, retrieved memory, archive, codex and player
  // canon travel in the final user message so the input cache covers this prefix.
  return `${languageInstruction(setup.language)}

Tu es l'ÉCRIVAIN d'une campagne Star Wars d'élite : prose cinématique, immersive, soignée. Les messages précédents sont la scène déjà jouée — écris la SUITE en continuité.
Protagoniste : ${protagonist} | Ère : ${setup.era} | Faction : ${setup.faction} | Rôle : ${setup.role}
Style : ${setup.writingStyle || 'cinématique'} · Ton : ${setup.writingTone || 'aventure'} · Contenu : ${setup.contentMode || 'cinematic'}${renderGenesis(setup.genesis)}${dossier}

RÈGLES :
1. LONGUEUR : ${lengthDirective(setup.writingLength)} Aucune sortie technique (ni JSON, ni markdown, ni liste).
2. ${povDirective(setup.writingPov)}
3. Ne propose AUCUN choix.
4. COHÉRENCE MONDE : respecte scrupuleusement l'état fourni dans le message utilisateur — lieu actuel, PV/blessures, et surtout les PNJ (n'utilise QUE des personnages vivants connus ou nouvellement introduits ; ne fais jamais réapparaître un mort).
5. DIRECTIVE STYLE : ${styleDirective(setup.writingStyle, setup.writingTone)}
6. DIRECTIVE CONTENU : ${contentModeDirective(setup.contentMode)}
7. ${ERA_COHERENCE}
8. RÔLE CANONIQUE IMMUABLE : garde le rôle "${setup.role}".
9. Dialogues : chaque réplique sur sa ligne, format "Nom : réplique" (INTERDICTION du tiret cadratin '—' ou de tout tiret en début de ligne).
10. CANON DU JOUEUR & ESCALADE : respecte les faits que le joueur a établis (fournis dans le message utilisateur) ; ne les contredis jamais et n'introduis pas un groupe/élément qu'il a exclu. Un lieu civil (marché, cantina) reste civil sans escalade fortement justifiée — pas de stormtroopers en masse ni de marcheurs/AT-ST surgissant sans cause proportionnée. CONSÉQUENCES DURABLES : les forces ennemies sont FINIES — une troupe décimée ou une armée vaincue reste vaincue, pas de vague identique au tour suivant ni de renforts surgis de nulle part ; montre les effets durables d'une victoire (silence, survivants en fuite, répit crédible) et ne ressuscite jamais un ennemi vaincu sans cause visible (vaisseau, appel radio).
11. FIL ROUGE & PROGRESSION : cette scène doit faire avancer l'objectif de campagne ou montrer clairement le prix d'un retard. Le monde ne remplace pas la quête principale par une succession de rencontres aléatoires.
12. INVENTAIRE : l'état contient les seuls objets disponibles. Si un objet est pertinent, le Cerveau devra proposer une option qui l'utilise ; n'en invente aucun.
13. RYTHME : si le contexte indique deux scènes action/confrontation consécutives, écris une accalmie, un dialogue ou une exploration. Ne rajoute pas un combat par réflexe.
14. ${ERA_HONESTY}${prologue}${varietyNote(overusedTerms)}`;
}

/** Era references, marked OPTIONAL so they inform the scene without steering it. */
function codexBlock(codex: CodexEntry[] = []): string {
  return codex.length
    ? `\nCODEX DE L'ÉPOQUE (contexte optionnel — utilise-le seulement si pertinent, ne le force jamais) :\n${codex.map((e) => `- ${e.text}`).join('\n')}`
    : '';
}

function directorUser(summary: string, action: string, turnNumber: number, digest: string, canon: string, recentSectionTypes: string[] = [], codex: CodexEntry[] = [], opening = ''): string {
  let consecutiveIntense = 0;
  for (let i = recentSectionTypes.length - 1; i >= 0; i -= 1) {
    if (['action', 'confrontation'].includes(recentSectionTypes[i])) consecutiveIntense += 1;
    else break;
  }
  const pacing = consecutiveIntense >= 2
    ? `\nRYTHME OBLIGATOIRE : ${consecutiveIntense} scènes intenses viennent de s'enchaîner. Planifie une scène de repos, dialogue ou exploration ; aucune nouvelle bataille sans nécessité exceptionnelle.`
    : '';
  return `${opening ? `${opening}\n\n` : ''}Tour ${turnNumber}. Situation : ${cleanText(summary, 2600) || '(ouverture)'}

ÉTAT DU MONDE :
${digest}${canon}${codexBlock(codex)}${pacing}

Action joueur : ${cleanText(action, 240)}

Réponds en JSON strict :
{
  "scene_goal": "but dramatique immédiat relié au FIL ROUGE",
  "tension": "pression ou menace immédiate proportionnée",
  "must_include": ["2 à 4 éléments concrets à montrer"],
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "atmosphere": "tense|calm|mysterious|eerie|heroic"
}`;
}

function writerUser(
  brief: Record<string, unknown>,
  action: string,
  outcomeDirective: string,
  world: WorldState,
  canon: string,
  archive: string[],
  memory: MemoryFact[],
  setup: StorySetup,
  codex: CodexEntry[] = [],
  openingBrief = ''
): string {
  const protagonist = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'Le protagoniste';
  const foldedArchive = foldArchive(archive);
  const archiveBlock = foldedArchive.length
    ? `\nRÉSUMÉ DES TOURS ANCIENS (continuité, ne pas répéter mot à mot) :\n${foldedArchive.map((a) => `- ${a}`).join('\n')}`
    : '';
  const context = `${renderWorldBlock(world, protagonist)}${renderMemoryBlock(memory)}${archiveBlock}${codexBlock(codex)}${canon}\n\n`;
  const opening = openingBrief ? `${openingBrief}\n\n` : '';
  const mustInclude = Array.isArray(brief.must_include) ? brief.must_include.map((m) => `- ${cleanText(m, 100)}`).join('\n') : '- Conséquence directe de l\'action';
  return `${context}${opening}But de scène : ${cleanText(brief.scene_goal, 200)}
Tension : ${cleanText(brief.tension, 200)}
Éléments obligatoires :
${mustInclude}

ACTION À RENDRE : ${cleanText(action, 240)}
${outcomeDirective ? `${outcomeDirective}\n` : ''}Écris la suite immédiate (2 à 3 paragraphes), en continuité directe de la scène précédente ci-dessus. La première impulsion montre la conséquence de l'action.`;
}

function brainUser(prose: string, brief: Record<string, unknown>, digest: string, memory: MemoryFact[] = []): string {
  return `ÉTAT ACTUEL DU MONDE (avant cette scène) :
${digest}
${renderMemoryBlock(memory)}

Voici la scène qui vient de se dérouler :
${cleanText(prose, 2800)}

Déduis-en les conséquences mécaniques, COHÉRENTES avec l'état ci-dessus :
- hp et credits sont des DELTAS signés (ex: hp:-15) ; ne ressuscite jamais un mort ; réutilise les PNJ existants par leur nom EXACT (pas de doublon).
- APTITUDES : les choix utilisent l'aptitude correspondante ; le profil affiché est mécanique et ne change pas sans entraînement explicite.
- FIL ROUGE : mets à jour campaign_update.progress pour relier la scène à l'objectif ; completed uniquement si l'objectif est accompli.
- MONDE HORS CHAMP : world_events_new contient 0 à 2 événements externes plausibles seulement si le temps ou l'action le justifie.
- CHOIX : 3 à 4 options réellement différentes et mutuellement exclusives ; au moins deux ont des coûts opposés et remplissent tradeoff/stakes. Si un objet est pertinent, une option doit le consommer via requires_items/consumes_items.
- ENJEUX : si le protagoniste est critique, hp doit redevenir > 0 ; s'il reste à 0 après cette dernière chance, ending peut être death. Un échec d'objectif explicite peut utiliser defeat.
- BLESSURES : les blessures sont RARES — seuls des événements véritablement dangereux (chute de grande hauteur, explosion, combat violent, tir direct) justifient injuries_new. Des coups, chutes légères ou efforts physiques ne comptent pas. Maximum 1 blessure toutes les 4-5 scènes. Si justifié, remplis injuries_new (description + severity light|moderate|severe). Ce qui se soigne va dans injuries_resolved.
- TEMPS : si du temps passe (repos, soin, voyage, ellipse), renseigne date_advance (ex: "quelques heures").
- CHOIX : 3 à 4, concrets et uniques à cette scène (INTERDIT : "Observer", "Méditer"). difficulty calibrée selon l'action réelle (1 trivial … 5 héroïque) — la plupart valent 2-3, réserve 4-5 aux exploits, NE mets PAS 5 partout (une attelle = 2).
- CONSÉQUENCES DURABLES : les forces ennemies sont FINIES. Une victoire majeure (armée décimée, patrouille anéantie) doit laisser une trace : renseigne environment_status (ex: « plus un soldat debout, la cour est jonchée de débris ») et consigne le fait dans memory_updates.notes (ex: « l'armée de X est décimée »). Ne consigne JAMAIS une prédiction de menace non réalisée (« la prochaine vague ne tardera pas ») dans memory_updates — une supposition du narrateur n'est pas un fait établi.
- PRÉSENCE : npcs_present = noms EXACTS des PNJ nommés encore physiquement présents à la FIN de la scène (pas ceux partis, morts ou ailleurs) — c'est ce qui détermine à qui le joueur peut parler. Vide si le protagoniste est seul.

Réponds en JSON strict :
{
  "chapter_title": "Titre évocateur — jamais Chapitre N",
  "section_type": "${cleanText(brief.section_type, 40) || 'action'}",
  "narrative": { "atmosphere": "${cleanText(brief.atmosphere, 40) || 'tense'}" },
  "state_update": { "hp": -15, "credits": 0, "experience": 10, "skill_gains": {}, "location": "", "date_advance": "", "campaign_update": {}, "world_events_new": [], "ending": null, "npcs": [], "factions": {}, "injuries_new": [], "injuries_resolved": [], "inventory_gained": [], "inventory_lost": [], "rumors_new": [], "environment_status": "" },
  "memory_updates": { "relations": [], "places": [], "injuries": [], "resources": [], "notes": [] },
  "choices": [ { "text": "", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 2, "tradeoff": "", "stakes": "", "requires_items": [], "consumes_items": [], "faction_impact": {} } ],
  "npcs_present": []
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

/** Split writer prose into action vs "Nom : réplique" lines. The speaker test is
 *  shared with the renderer, so "Attention : …" is no longer filed as speech. */
function splitProse(prose: string): { action: string; dialogue: string } {
  const action: string[] = [];
  const dialogue: string[] = [];
  for (const block of prose.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    (looksLikeSpeakerLine(trimmed.split('\n')[0]) ? dialogue : action).push(trimmed);
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
  archive: string[];            // older turns, condensed (into the Writer's user message)
  memory?: MemoryFact[];        // structured narrative memory (into the Writer's user message)
  recentSectionTypes?: string[]; // pacing signal shared with Director and Writer
  outcomeDirective?: string;
  playerDirectives?: string[];
  overusedTerms?: string[];     // words the model has leaned on across recent scenes
  campaignDossier?: string;     // one-shot factual campaign bible (stable Writer system block)
  openingBrief?: string;        // turn-1 staging spec — agentic mode ignored it entirely before
  codex?: CodexEntry[];         // era references for this scene (optional context)
  onPartial?: (partial: { title: string; text: string }) => void; // live preview of the Writer's draft
}

function varietyNote(overusedTerms: string[] = []): string {
  return overusedTerms.length
    ? `\nVARIÉTÉ (IMPORTANT) : ces mots reviennent trop d'une scène à l'autre — ne les réemploie pas par réflexe, varie le vocabulaire et les images : ${overusedTerms.join(', ')}.`
    : '';
}

function playerCanonBlock(playerDirectives: string[] = []): string {
  const recent = playerDirectives.map((d) => d.trim()).filter(Boolean).slice(-8);
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
    [{ role: 'system', content: `${languageInstruction(lang)}\n\n${DIRECTOR_SYSTEM}` }, { role: 'user', content: directorUser(ctx.situation, ctx.actionText, ctx.turnNumber, digest, canon, ctx.recentSectionTypes ?? [], ctx.codex ?? [], ctx.openingBrief ?? '') }],
    provider,
    { jsonMode: true, skipReasoning: true, label: 'directeur' }
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
  // The variable context (world/memory/archive/canon) travels in the USER
  // message so the system prompt stays stable for the provider input cache.
  // With onPartial the draft STREAMS to the player while Reviewer/Brain run;
  // any stream failure falls back to the plain (retried) call.
  const writerMessages: ChatMessage[] = [
    { role: 'system', content: writerSystem(ctx.setup, ctx.turnNumber, ctx.overusedTerms ?? [], ctx.campaignDossier) },
    ...ctx.transcript,
    { role: 'user', content: writerUser(brief, ctx.actionText, ctx.outcomeDirective ?? '', ctx.worldState, canon, ctx.archive, ctx.memory ?? [], ctx.setup, ctx.codex ?? [], ctx.openingBrief ?? '') }
  ];
  let draft = '';
  if (ctx.onPartial) {
    try {
      let acc = '';
      draft = await callTextModelStream(writerMessages, provider, (delta) => {
        acc += delta;
        ctx.onPartial!({ title: '', text: acc });
      }, { label: 'écrivain (flux)' });
    } catch {
      /* stream failed — retry below over the sturdier non-streaming path */
    }
  }
  if (!draft.trim()) draft = await callTextModel(writerMessages, provider, { label: 'écrivain' });

  // 3. Reviewer — polish the scene (same facts, sharper writing). Falls back to the
  // draft if it returns nothing usable.
  let prose = draft;
  try {
    const reviewed = await callTextModel(
      [{ role: 'system', content: `${languageInstruction(lang)}\n\n${REVIEWER_SYSTEM}` }, { role: 'user', content: reviewerUser(draft, brief, digest, ctx.overusedTerms ?? []) }],
      provider,
      { label: 'relecteur' }
    );
    if (reviewed.trim().length >= 40) prose = reviewed;
  } catch {
    /* keep the draft — a reviewer failure must never lose the scene */
  }

  // 4. Brain — mechanical consequences + choices (JSON) from the final prose
  const brainRaw = await callTextModel(
    [{ role: 'system', content: `${languageInstruction(lang)} TOUT le texte est en ${languageName(lang)}.\n\n${BRAIN_SYSTEM}` }, { role: 'user', content: brainUser(prose, brief, digest, ctx.memory ?? []) }],
    provider,
    { jsonMode: true, label: 'cerveau' }
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
