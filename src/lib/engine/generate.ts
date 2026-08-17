/* ═══════════════════════════════════════════════
   Turn orchestration. Dispatches on the generation mode:
   - structured-json: one call → [system, …raw transcript, user] → parse
   - agentic-subagents: Director → Writer → Reviewer → Brain
   The RAW recent history is sent verbatim within the model's context budget;
   only the overflow (oldest turns) is compressed into a campaign archive.
══════════════════════════════════════════════ */
import { runAgenticTurn } from './agentic';
import { buildNarrativeContext, detectOverusedTerms, DEFAULT_CONTEXT_BUDGET } from './context';
import { extractStreamingJsonField, parseStoryResponse } from './parsing';
import { buildContinuePrompt, buildStartPrompt, buildStableSystemPrompt, buildTurnContextBlock, summarizeChapterForPrompt } from './prompts';
import { callTextModel, callTextModelStream } from './provider';
import { cleanText } from './text';
import { buildMemoryQuery, retrieveMemory } from './memoryRetrieval';
import { embeddingCache } from '$lib/persistence';
import type {
  ChatMessage,
  MemoryFact,
  StoryChapter,
  StoryGenerationMode,
  StoryProviderConfig,
  StorySetup,
  StoryTurnResult,
  WorldState
} from './types';
import { applyStateUpdate, initWorldState } from './worldState';

/** Live preview of the turn being generated — title + narrative prose so far. */
export interface GeneratePartial {
  title: string;
  text: string;
}

export interface GenerateOptions {
  trameLabel?: string | null;
  mode?: StoryGenerationMode;
  onPartial?: (partial: GeneratePartial) => void; // stream the scene as it writes itself
}

/**
 * One structured-json completion. With onPartial, the JSON is STREAMED and the
 * chapter_title / narrative.action fields are surfaced live as they arrive;
 * any stream failure falls back to the plain (retried) non-streaming call.
 */
async function callStructuredJson(
  messages: ChatMessage[],
  provider: StoryProviderConfig,
  onPartial?: (partial: GeneratePartial) => void
): Promise<string> {
  if (onPartial) {
    try {
      let buffer = '';
      const raw = await callTextModelStream(
        messages,
        provider,
        (delta) => {
          buffer += delta;
          const title = extractStreamingJsonField(buffer, 'chapter_title') ?? '';
          const text = extractStreamingJsonField(buffer, 'action') ?? '';
          if (title || text) onPartial({ title, text });
        },
        { jsonMode: true }
      );
      if (raw.trim()) return raw;
    } catch {
      /* stream failed — retry below over the sturdier non-streaming path */
    }
  }
  return callTextModel(messages, provider, { jsonMode: true });
}

export interface TurnInput {
  setup: StorySetup;
  worldState: WorldState;
  turnNumber: number;
  actionText: string;
  memory?: MemoryFact[];           // structured narrative memory (categorized, turn-stamped)
  memoryEmbeddings?: boolean;      // semantic retrieval via embeddings (falls back to lexical)
  chapterHistory?: StoryChapter[]; // full history — kept raw up to the budget
  actionHistory?: string[];        // player actions paired with the chapters
  contextBudget?: number;          // token budget for the raw transcript
  playerDirectives?: string[];     // recent player actions/statements — canon to respect
  outcomeDirective?: string;       // hidden dice-roll result that biases the scene
}

const OPENING_ACTION = "Entrer dans la scène d'ouverture et survivre aux premières secondes.";

/** Turn 1 — generate the opening scene from setup (no history yet). */
export async function generateOpening(
  setup: StorySetup,
  provider: StoryProviderConfig,
  options: GenerateOptions = {}
): Promise<StoryTurnResult> {
  const world = initWorldState(setup);
  let chapter: StoryChapter;
  let rawResponse: string;
  let mode: StoryGenerationMode;

  if (options.mode === 'agentic-subagents') {
    const r = await runAgenticTurn(
      { setup, worldState: world, turnNumber: 1, actionText: OPENING_ACTION, situation: cleanText(setup.premise, 800), transcript: [], archive: [], onPartial: options.onPartial },
      provider
    );
    chapter = r.chapter;
    rawResponse = r.raw;
    mode = 'agentic-subagents';
  } else {
    // Opening turn: fresh world, no history — the stable prompt (with the
    // turn-1 prologue) is all the GM needs.
    const messages = [
      { role: 'system' as const, content: buildStableSystemPrompt(setup, 1) },
      { role: 'user' as const, content: buildStartPrompt(setup, options.trameLabel) }
    ];
    rawResponse = await callStructuredJson(messages, provider, options.onPartial);
    chapter = parseStoryResponse(rawResponse, 1);
    mode = 'structured-json';
  }

  return { chapter, worldState: applyStateUpdate(world, chapter), rawResponse, mode };
}

/** Turn N — react to the player's action and advance the world. */
export async function generateTurn(
  input: TurnInput,
  provider: StoryProviderConfig,
  options: GenerateOptions = {}
): Promise<StoryTurnResult> {
  const history = input.chapterHistory ?? [];
  const budget = input.contextBudget ?? DEFAULT_CONTEXT_BUDGET;
  const { transcript, archive } = buildNarrativeContext(history, input.actionHistory ?? [], budget);
  const recentSectionTypes = history.slice(-6).map((c) => c.section_type);
  const recentChoiceTexts = history.slice(-4).flatMap((c) => c.choices.map((ch) => ch.text));
  const overusedTerms = detectOverusedTerms(history, {
    excludeTerms: [input.worldState.player.location, ...input.worldState.npcs.map((npc) => npc.name)]
  });
  // Mnemosyne-style retrieval: only the facts relevant to the current scene
  // are injected, so long campaigns stay focused instead of flooding the prompt.
  const memoryQuery = buildMemoryQuery([
    input.actionText,
    input.worldState.player.location,
    history.at(-1)?.chapter_title,
    history.at(-1)?.narrative.action
  ]);
  const memory = await retrieveMemory(input.memory ?? [], memoryQuery, {
    provider,
    enableEmbeddings: input.memoryEmbeddings === true,
    currentTurn: input.turnNumber,
    cache: embeddingCache
  });

  let chapter: StoryChapter;
  let rawResponse: string;
  let mode: StoryGenerationMode;

  if (options.mode === 'agentic-subagents') {
    // The Director plans from the MOST RECENT chapter summaries. Dropping the
    // oldest lines when over budget (instead of tail-truncating the joined
    // text) keeps the freshest situation in view on long campaigns.
    const situationLines = history.slice(-10).map(summarizeChapterForPrompt);
    while (situationLines.length > 1 && situationLines.join('\n').length > 2400) situationLines.shift();
    const situation = situationLines.join('\n');
    const r = await runAgenticTurn(
      {
        setup: input.setup,
        worldState: input.worldState,
        turnNumber: input.turnNumber,
        actionText: input.actionText,
        situation,
        transcript,
        archive,
        memory,
        recentSectionTypes,
        outcomeDirective: input.outcomeDirective,
        playerDirectives: input.playerDirectives,
        overusedTerms,
        onPartial: options.onPartial
      },
      provider
    );
    chapter = r.chapter;
    rawResponse = r.raw;
    mode = 'agentic-subagents';
  } else {
    // Stable prefix for the provider's input cache: the system prompt carries
    // only instructions; world/memory/archive live in the final user message.
    const contextBlock = buildTurnContextBlock(input.setup, input.worldState, memory, archive);
    const messages = [
      { role: 'system' as const, content: buildStableSystemPrompt(input.setup, input.turnNumber) },
      ...transcript,
      {
        role: 'user' as const,
        content: buildContinuePrompt(
          input.actionText,
          input.turnNumber,
          recentSectionTypes,
          recentChoiceTexts,
          input.setup.language,
          input.outcomeDirective ?? '',
          input.playerDirectives ?? [],
          overusedTerms,
          contextBlock
        )
      }
    ];
    rawResponse = await callStructuredJson(messages, provider, options.onPartial);
    chapter = parseStoryResponse(rawResponse, input.turnNumber);
    mode = 'structured-json';
  }

  return { chapter, worldState: applyStateUpdate(input.worldState, chapter), rawResponse, mode };
}
