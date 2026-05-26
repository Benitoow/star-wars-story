/* ═══════════════════════════════════════════════
   "Mode Direct" engine — live NPC conversation.
   npcReply(): one light, streamed, in-character reply per message.
   resolveConversation(): on exit, distill consequences + a recap chapter.
══════════════════════════════════════════════ */
import { parseStoryResponse } from './parsing';
import { buildNpcSystemPrompt, RESOLVE_SYSTEM, buildResolveUser } from './prompts/chat';
import { languageInstruction, languageName } from './prompts/language';
import { renderPlayerCanon } from './prompts/system';
import { callTextModel, callTextModelStream } from './provider';
import type {
  ChatMessage,
  ChatTurn,
  NpcRelation,
  StoryProviderConfig,
  StorySetup,
  StoryTurnResult,
  WorldState
} from './types';
import { applyStateUpdate } from './worldState';

export interface NpcReplyInput {
  setup: StorySetup;
  worldState: WorldState;
  npc: NpcRelation;
  sceneSummary: string;
  turns: ChatTurn[]; // the whole conversation so far, ending with the player's new message
  playerDirectives?: string[];
}

/** Stream one in-character NPC reply. Returns the full text (also fed via onToken). */
export async function npcReply(
  input: NpcReplyInput,
  provider: StoryProviderConfig,
  onToken: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const system = buildNpcSystemPrompt(
    input.setup,
    input.worldState,
    input.npc,
    input.sceneSummary,
    renderPlayerCanon(input.playerDirectives)
  );
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...input.turns.map((t): ChatMessage => ({ role: t.speaker === 'player' ? 'user' : 'assistant', content: t.content }))
  ];
  return callTextModelStream(messages, provider, onToken, { skipReasoning: true, signal });
}

export interface ResolveConversationInput {
  setup: StorySetup;
  worldState: WorldState;
  npc: NpcRelation;
  sceneSummary: string;
  turns: ChatTurn[];
  turnNumber: number;
}

/** Exit debrief — turns the conversation into a recap chapter + applied consequences. */
export async function resolveConversation(
  input: ResolveConversationInput,
  provider: StoryProviderConfig
): Promise<StoryTurnResult> {
  const lang = input.setup.language || 'fr';
  const messages: ChatMessage[] = [
    { role: 'system', content: `${languageInstruction(lang)}\n\n${RESOLVE_SYSTEM}` },
    { role: 'user', content: buildResolveUser(input.setup, input.worldState, input.npc, input.sceneSummary, input.turns, languageName(lang)) }
  ];
  const rawResponse = await callTextModel(messages, provider, { jsonMode: true });
  const chapter = parseStoryResponse(rawResponse, input.turnNumber);
  return { chapter, worldState: applyStateUpdate(input.worldState, chapter), rawResponse, mode: 'structured-json' };
}
