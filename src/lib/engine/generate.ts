/* ═══════════════════════════════════════════════
   Turn orchestration. Dispatches on the generation mode:
   - structured-json: one call → [system, …raw transcript, user] → parse
   - agentic-subagents: Director → Writer → Reviewer → Brain
   The RAW recent history is sent verbatim within the model's context budget;
   only the overflow (oldest turns) is compressed into a campaign archive.
══════════════════════════════════════════════ */
import { runAgenticTurn } from './agentic';
import { buildNarrativeContext, DEFAULT_CONTEXT_BUDGET } from './context';
import { parseStoryResponse } from './parsing';
import { buildContinuePrompt, buildStartPrompt, buildSystemPrompt, summarizeChapterForPrompt } from './prompts';
import { callTextModel } from './provider';
import { cleanText } from './text';
import type {
  StoryChapter,
  StoryGenerationMode,
  StoryProviderConfig,
  StorySetup,
  StoryTurnResult,
  WorldState
} from './types';
import { applyStateUpdate, initWorldState } from './worldState';

export interface TurnInput {
  setup: StorySetup;
  worldState: WorldState;
  turnNumber: number;
  actionText: string;
  memoryFacts?: string[];
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
  options: { trameLabel?: string | null; mode?: StoryGenerationMode } = {}
): Promise<StoryTurnResult> {
  const world = initWorldState(setup);
  let chapter: StoryChapter;
  let rawResponse: string;
  let mode: StoryGenerationMode;

  if (options.mode === 'agentic-subagents') {
    const r = await runAgenticTurn(
      { setup, worldState: world, turnNumber: 1, actionText: OPENING_ACTION, situation: cleanText(setup.premise, 800), transcript: [], archive: [] },
      provider
    );
    chapter = r.chapter;
    rawResponse = r.raw;
    mode = 'agentic-subagents';
  } else {
    const messages = [
      { role: 'system' as const, content: buildSystemPrompt(setup, [], world, 1) },
      { role: 'user' as const, content: buildStartPrompt(setup, options.trameLabel) }
    ];
    rawResponse = await callTextModel(messages, provider, { jsonMode: true });
    chapter = parseStoryResponse(rawResponse, 1);
    mode = 'structured-json';
  }

  return { chapter, worldState: applyStateUpdate(world, chapter), rawResponse, mode };
}

/** Turn N — react to the player's action and advance the world. */
export async function generateTurn(
  input: TurnInput,
  provider: StoryProviderConfig,
  options: { mode?: StoryGenerationMode } = {}
): Promise<StoryTurnResult> {
  const history = input.chapterHistory ?? [];
  const budget = input.contextBudget ?? DEFAULT_CONTEXT_BUDGET;
  const { transcript, archive } = buildNarrativeContext(history, input.actionHistory ?? [], budget);
  const recentSectionTypes = history.slice(-6).map((c) => c.section_type);
  const recentChoiceTexts = history.slice(-4).flatMap((c) => c.choices.map((ch) => ch.text));

  let chapter: StoryChapter;
  let rawResponse: string;
  let mode: StoryGenerationMode;

  if (options.mode === 'agentic-subagents') {
    // The Director plans from a condensed story-so-far (archive + a short recap);
    // the Writer reads the raw transcript.
    const situation = [...archive, ...history.slice(-2).map(summarizeChapterForPrompt)].join('\n');
    const r = await runAgenticTurn(
      {
        setup: input.setup,
        worldState: input.worldState,
        turnNumber: input.turnNumber,
        actionText: input.actionText,
        situation,
        transcript,
        archive,
        outcomeDirective: input.outcomeDirective,
        playerDirectives: input.playerDirectives
      },
      provider
    );
    chapter = r.chapter;
    rawResponse = r.raw;
    mode = 'agentic-subagents';
  } else {
    const messages = [
      { role: 'system' as const, content: buildSystemPrompt(input.setup, input.memoryFacts ?? [], input.worldState, input.turnNumber, input.playerDirectives ?? [], archive) },
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
          input.playerDirectives ?? []
        )
      }
    ];
    rawResponse = await callTextModel(messages, provider, { jsonMode: true });
    chapter = parseStoryResponse(rawResponse, input.turnNumber);
    mode = 'structured-json';
  }

  return { chapter, worldState: applyStateUpdate(input.worldState, chapter), rawResponse, mode };
}
