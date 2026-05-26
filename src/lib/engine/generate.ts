/* ═══════════════════════════════════════════════
   Turn orchestration. Dispatches on the generation mode:
   - structured-json: one call, [system, user] → parse
   - agentic-subagents: Director → Writer → Brain pipeline
   Either way the system prompt/summary carries the live
   world, so a turn is stateless per call; the reducer then
   advances the world.
══════════════════════════════════════════════ */
import { runAgenticTurn } from './agentic';
import { parseStoryResponse } from './parsing';
import { buildContinuePrompt, buildStartPrompt, buildSystemPrompt } from './prompts';
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
  recentSummary?: string[];
  recentSectionTypes?: string[];
  recentChoiceTexts?: string[];
  outcomeDirective?: string; // hidden dice-roll result that biases the scene
  playerDirectives?: string[]; // recent player actions/statements — canon to respect
}

const OPENING_ACTION = "Entrer dans la scène d'ouverture et survivre aux premières secondes.";

/** Turn 1 — generate the opening scene from setup. */
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
    const r = await runAgenticTurn({ setup, worldState: world, turnNumber: 1, actionText: OPENING_ACTION, summary: cleanText(setup.premise, 800) }, provider);
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
  let chapter: StoryChapter;
  let rawResponse: string;
  let mode: StoryGenerationMode;

  if (options.mode === 'agentic-subagents') {
    const r = await runAgenticTurn(
      {
        setup: input.setup,
        worldState: input.worldState,
        turnNumber: input.turnNumber,
        actionText: input.actionText,
        summary: (input.recentSummary ?? []).join('\n'),
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
      { role: 'system' as const, content: buildSystemPrompt(input.setup, input.memoryFacts ?? [], input.worldState, input.turnNumber, input.playerDirectives ?? []) },
      {
        role: 'user' as const,
        content: buildContinuePrompt(
          input.actionText,
          input.turnNumber,
          input.recentSummary ?? [],
          input.recentSectionTypes ?? [],
          input.recentChoiceTexts ?? [],
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
