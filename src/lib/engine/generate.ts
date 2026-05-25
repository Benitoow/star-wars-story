/* ═══════════════════════════════════════════════
   Turn orchestration. A turn is stateless per call:
   the system prompt carries the live world + memory, so
   we send just [system, user] and apply the reducer.
══════════════════════════════════════════════ */
import type {
  ChatMessage,
  StoryGenerationMode,
  StoryProviderConfig,
  StorySetup,
  StoryTurnResult,
  WorldState
} from './types';
import { buildSystemPrompt, buildStartPrompt, buildContinuePrompt } from './prompts';
import { parseStoryResponse } from './parsing';
import { callTextModel } from './provider';
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
}

async function runStructuredJson(messages: ChatMessage[], provider: StoryProviderConfig): Promise<string> {
  return callTextModel(messages, provider, { jsonMode: true });
}

/** Dispatch to the chosen generation strategy. Agentic pipeline lands in a later module. */
async function runTurn(
  messages: ChatMessage[],
  provider: StoryProviderConfig,
  mode: StoryGenerationMode
): Promise<{ raw: string; mode: StoryGenerationMode }> {
  // 'agentic-subagents' is wired in ./agentic and selected here once available.
  void mode;
  return { raw: await runStructuredJson(messages, provider), mode: 'structured-json' };
}

/** Turn 1 — generate the opening scene from setup. */
export async function generateOpening(
  setup: StorySetup,
  provider: StoryProviderConfig,
  options: { trameLabel?: string | null; mode?: StoryGenerationMode } = {}
): Promise<StoryTurnResult> {
  const world = initWorldState(setup);
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(setup, [], world, 1) },
    { role: 'user', content: buildStartPrompt(setup, options.trameLabel) }
  ];

  const { raw, mode } = await runTurn(messages, provider, options.mode ?? 'structured-json');
  const chapter = parseStoryResponse(raw, 1);
  return { chapter, worldState: applyStateUpdate(world, chapter), rawResponse: raw, mode };
}

/** Turn N — react to the player's action and advance the world. */
export async function generateTurn(
  input: TurnInput,
  provider: StoryProviderConfig,
  options: { mode?: StoryGenerationMode } = {}
): Promise<StoryTurnResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt(input.setup, input.memoryFacts ?? [], input.worldState, input.turnNumber)
    },
    {
      role: 'user',
      content: buildContinuePrompt(
        input.actionText,
        input.turnNumber,
        input.recentSummary ?? [],
        input.recentSectionTypes ?? [],
        input.recentChoiceTexts ?? [],
        input.setup.language
      )
    }
  ];

  const { raw, mode } = await runTurn(messages, provider, options.mode ?? 'structured-json');
  const chapter = parseStoryResponse(raw, input.turnNumber);
  return { chapter, worldState: applyStateUpdate(input.worldState, chapter), rawResponse: raw, mode };
}
