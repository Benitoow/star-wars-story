import { logger } from '$lib/utils/logger';
import type {
  BackgroundWorldEvent,
  BackgroundWorldGenerationResult,
  BackgroundWorldInput,
  ChatMessage,
  NpcRelation,
  StateUpdate,
  StoryChapter,
  StoryChoice,
  StoryMemoryUpdates,
  StoryNarrative,
  StoryProviderConfig,
  StoryTurnGenerationResult,
  StoryPromptMode
} from './types';
import {
  callOpenAiCompatibleRaw,
  callTextModel,
  detectModelCapabilities,
  normalizeProviderId,
  supportsAgenticToolCalling,
  type ModelCapabilities
} from './providers';
import {
  coerceMemoryUpdates,
  coerceNarrative,
  coerceStateUpdate,
  parseJsonSafely,
  parseStoryResponse,
  sanitizeNarrativeText
} from './parsing';
import { ensureWorldStateFallbacks, isUnknownLocation } from './worldStateFallbacks';

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r/g, '\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, maxLength);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeStringLists(...lists: string[][]): string[] {
  return Array.from(new Set(lists.flatMap(list => list.map(item => cleanText(item, 140)).filter(Boolean))));
}

function mergeInventoryEntries(left: { name: string; qty: number }[] = [], right: { name: string; qty: number }[] = []): { name: string; qty: number }[] {
  const index = new Map<string, { name: string; qty: number }>();
  for (const item of [...left, ...right]) {
    const name = cleanText(item.name, 80);
    const qty = Math.max(1, Number(item.qty) || 1);
    if (!name) continue;
    const key = name.toLowerCase();
    const current = index.get(key);
    if (current) current.qty += qty;
    else index.set(key, { name, qty });
  }
  return Array.from(index.values());
}

function mergeNpcEntries(left: Array<Partial<NpcRelation> & { name: string }> = [], right: Array<Partial<NpcRelation> & { name: string }> = []): Array<Partial<NpcRelation> & { name: string }> {
  const index = new Map<string, Partial<NpcRelation> & { name: string }>();
  for (const npc of [...left, ...right]) {
    const name = cleanText(npc.name, 80);
    if (!name) continue;
    const key = name.toLowerCase();
    const current = index.get(key);
    index.set(key, { ...(current || { name }), ...npc, name });
  }
  return Array.from(index.values());
}

function mergeStateUpdates(base: StateUpdate | undefined, patch: StateUpdate | undefined): StateUpdate | undefined {
  if (!base) return patch;
  if (!patch) return base;

  const merged: StateUpdate = { ...base, ...patch };
  if (base.hp !== undefined || patch.hp !== undefined) merged.hp = (base.hp ?? 0) + (patch.hp ?? 0);
  if (base.credits !== undefined || patch.credits !== undefined) merged.credits = (base.credits ?? 0) + (patch.credits ?? 0);
  if (base.factions || patch.factions) {
    const factionIndex: Record<string, number> = {};
    for (const [id, delta] of Object.entries(base.factions ?? {})) factionIndex[id] = delta;
    for (const [id, delta] of Object.entries(patch.factions ?? {})) factionIndex[id] = (factionIndex[id] ?? 0) + delta;
    merged.factions = factionIndex;
  }
  if (base.clocks_new || patch.clocks_new) merged.clocks_new = [...(base.clocks_new ?? []), ...(patch.clocks_new ?? [])];
  if (base.clocks_advance || patch.clocks_advance) {
    const clockAdv: Record<string, number> = { ...(base.clocks_advance ?? {}) };
    for (const [id, delta] of Object.entries(patch.clocks_advance ?? {})) clockAdv[id] = (clockAdv[id] ?? 0) + delta;
    merged.clocks_advance = clockAdv;
  }
  if (base.sector_influence || patch.sector_influence) {
    const sectInf: Record<string, number> = { ...(base.sector_influence ?? {}) };
    for (const [id, delta] of Object.entries(patch.sector_influence ?? {})) sectInf[id] = (sectInf[id] ?? 0) + delta;
    merged.sector_influence = sectInf;
  }
  merged.rumors_new = mergeStringLists(base.rumors_new ?? [], patch.rumors_new ?? []);
  if (patch.environment_status !== undefined) merged.environment_status = patch.environment_status;
  if (patch.director_instruction !== undefined) merged.director_instruction = patch.director_instruction;

  merged.injuries_resolved = mergeStringLists(base.injuries_resolved ?? [], patch.injuries_resolved ?? []);
  merged.injuries_new = [...(base.injuries_new ?? []), ...(patch.injuries_new ?? [])].filter(entry => cleanText(entry.description, 120));
  merged.inventory_gained = mergeInventoryEntries(base.inventory_gained, patch.inventory_gained);
  merged.inventory_lost = mergeInventoryEntries(base.inventory_lost, patch.inventory_lost);
  merged.npcs = mergeNpcEntries(base.npcs, patch.npcs);
  return merged;
}

function dedupeChoices(choices: StoryChoice[]): StoryChoice[] {
  return Array.from(new Map(choices.map(choice => ({ ...choice, text: cleanText(choice.text, 220) })).filter(choice => Boolean(choice.text)).map(choice => [choice.text.toLowerCase(), choice] as const)).values()).slice(0, 4);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isOpenRouterGrok41Fast(config: StoryProviderConfig): boolean {
  const providerId = normalizeProviderId(config.providerId);
  if (providerId !== 'openrouter') return false;
  return /x-ai\/grok-4\.1-fast/i.test(cleanText(config.model, 160));
}

function isOpenRouterMimoV2Flash(config: StoryProviderConfig): boolean {
  const providerId = normalizeProviderId(config.providerId);
  if (providerId !== 'openrouter') return false;
  return /xiaomi\/mimo-v2-flash/i.test(cleanText(config.model, 160));
}

function getStoryExtractionMaxTokens(caps: ModelCapabilities, config: StoryProviderConfig): number {
  const tierScale = caps.tier === 'large' ? 0.3 : caps.tier === 'medium' ? 0.34 : 0.38;
  const adaptive = Math.round(caps.maxOutputTokens * tierScale);
  const base = clamp(adaptive, 700, 1200);
  if (isOpenRouterMimoV2Flash(config)) return Math.min(base, 900);
  return isOpenRouterGrok41Fast(config) ? Math.min(base, 1000) : base;
}

function getBackgroundExtractionMaxTokens(caps: ModelCapabilities, config: StoryProviderConfig): number {
  const adaptive = Math.round(caps.maxOutputTokens * 0.24);
  const base = clamp(adaptive, 520, 900);
  if (isOpenRouterMimoV2Flash(config)) return Math.min(base, 680);
  return isOpenRouterGrok41Fast(config) ? Math.min(base, 760) : base;
}

type AgenticDraft = {
  chapter_title: string;
  section_type: string;
  narrative: StoryNarrative;
  memory_updates: StoryMemoryUpdates;
  choices: StoryChoice[];
  state_update?: StateUpdate;
  scene_description: string;
  user_edits_applied: string | null;
  done: boolean;
};

type BackgroundEventDraft = { event: BackgroundWorldEvent; done: boolean };

function createAgenticDraft(turnNumber: number): AgenticDraft {
  return {
    chapter_title: turnNumber <= 1 ? 'Prologue' : `Tour ${turnNumber}`,
    section_type: 'action',
    narrative: { context: '', action: '', dialogue: '', reflection: '', atmosphere: 'tense' },
    memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] },
    choices: [],
    state_update: undefined,
    scene_description: 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: null,
    done: false
  };
}

function parseToolArguments(rawArgs: string): Record<string, unknown> {
  return parseJsonSafely(rawArgs) ?? {};
}

type ParsedPseudoToolCall = { name: string; args: Record<string, unknown> };

const SUPPORTED_AGENTIC_TOOL_NAMES = new Set<string>(['set_scene', 'update_world', 'update_npc', 'update_faction', 'add_memory', 'offer_choices', 'finalize_turn']);

function isSupportedAgenticToolName(name: string | undefined): boolean {
  return SUPPORTED_AGENTIC_TOOL_NAMES.has(String(name || '').trim().toLowerCase());
}

function parseLooseJsonObject(rawObject: string): Record<string, unknown> | null {
  const direct = parseJsonSafely(rawObject);
  if (direct) return direct;
  const normalized = String(rawObject || '').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3').replace(/,\s*([}\]])/g, '$1');
  return parseJsonSafely(normalized);
}

function extractPseudoToolCalls(rawText: string): ParsedPseudoToolCall[] {
  const text = String(rawText || '');
  const calls: ParsedPseudoToolCall[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const callIndex = text.indexOf('call:', cursor);
    if (callIndex === -1) break;
    let nameStart = callIndex + 5;
    while (nameStart < text.length && /\s/.test(text[nameStart])) nameStart += 1;
    let nameEnd = nameStart;
    while (nameEnd < text.length && /[A-Za-z0-9_]/.test(text[nameEnd])) nameEnd += 1;
    const name = text.slice(nameStart, nameEnd).trim().toLowerCase();
    if (!name) { cursor = callIndex + 5; continue; }
    while (nameEnd < text.length && /\s/.test(text[nameEnd])) nameEnd += 1;
    if (text[nameEnd] !== '{') { cursor = nameEnd; continue; }
    const braceStart = nameEnd;
    let depth = 0; let inString = false; let escaping = false; let braceEnd = -1;
    for (let i = braceStart; i < text.length; i += 1) {
      const char = text[i];
      if (inString) { if (escaping) { escaping = false; continue; } if (char === '\\') { escaping = true; continue; } if (char === '"') inString = false; continue; }
      if (char === '"') { inString = true; continue; }
      if (char === '{') { depth += 1; continue; }
      if (char === '}') { depth -= 1; if (depth === 0) { braceEnd = i; break; } }
    }
    if (braceEnd === -1) break;
    const rawArgs = text.slice(braceStart, braceEnd + 1);
    calls.push({ name, args: parseLooseJsonObject(rawArgs) ?? {} });
    cursor = braceEnd + 1;
  }
  return calls;
}

function draftHasWorldSignals(draft: AgenticDraft): boolean {
  const state = draft.state_update;
  if (state) {
    if (state.location && !isUnknownLocation(state.location)) return true;
    if ((state.npcs ?? []).length > 0) return true;
    if (Object.keys(state.factions ?? {}).length > 0) return true;
    if (state.hp !== undefined || state.credits !== undefined || state.date_advance) return true;
    if ((state.injuries_new ?? []).length > 0 || (state.inventory_gained ?? []).length > 0 || (state.inventory_lost ?? []).length > 0) return true;
    if ((state.clocks_new ?? []).length > 0 || Object.keys(state.clocks_advance ?? {}).length > 0) return true;
    if (Object.keys(state.sector_influence ?? {}).length > 0 || (state.rumors_new ?? []).length > 0) return true;
    if (state.environment_status || state.director_instruction) return true;
  }
  return draft.memory_updates.relations.length > 0 || draft.memory_updates.places.length > 0;
}

const UNUSABLE_STORY_OUTPUT_PATTERN = /n'a pas renvoyé de sortie exploitable/i;
const TOOL_CALL_LEAK_PATTERN = /<\|?tool_call\|?>|tool_call|(?:^|\s)call:[a-z_]+\s*\{/i;

function hasPlayableChapterContent(chapter: StoryChapter): boolean {
  const action = cleanText(chapter.narrative.action, 280);
  if (!action) return false;
  return !UNUSABLE_STORY_OUTPUT_PATTERN.test(action) && !TOOL_CALL_LEAK_PATTERN.test(action);
}

function hasUsableStoryTurnOutput(rawResponse: string, chapter: StoryChapter): boolean {
  const raw = cleanText(rawResponse, 12000);
  if (hasPlayableChapterContent(chapter)) return true;
  if (!raw) return false;
  if (UNUSABLE_STORY_OUTPUT_PATTERN.test(raw)) return false;
  if (TOOL_CALL_LEAK_PATTERN.test(raw)) return false;
  return chapter.choices.length > 0;
}

function buildStrictJsonRecoveryMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages, { role: 'user', content: `MODE DE REPLI TECHNIQUE (obligatoire):\n- N'utilise aucun tool call.\n- N'écris jamais de balise <tool_call>, <|tool_call|> ni de syntaxe call:xxx.\n- Réponds UNIQUEMENT avec un JSON valide (pas de markdown).\n- Champs requis: chapter_title, chapter_number, section_type, narrative{context,action,dialogue,reflection,atmosphere}, choices(3-4), memory_updates, state_update, scene_description, user_edits_applied.` }];
}

function defaultMemoryUpdates(): StoryMemoryUpdates { return { relations: [], places: [], injuries: [], resources: [], notes: [] }; }

function fallbackChapter(rawText: string, turnNumber: number): StoryChapter {
  return {
    chapter_title: turnNumber === 1 ? 'Prologue' : `Tour ${turnNumber}`,
    chapter_number: turnNumber,
    section_type: 'action',
    narrative: { context: '', action: sanitizeNarrativeText(rawText, 2200) || `Le récit reprend en mode de secours.` , dialogue: '', reflection: '', atmosphere: 'tense' },
    choices: [],
    memory_updates: defaultMemoryUpdates(),
    scene_description: 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: null
  };
}

function mergeBackgroundEvent(base: BackgroundWorldEvent, patch: BackgroundWorldEvent): BackgroundWorldEvent {
  return {
    title: patch.title || base.title,
    summary_public: patch.summary_public || base.summary_public,
    summary_private: patch.summary_private || base.summary_private,
    inject_now: patch.inject_now || base.inject_now,
    prompt_hook: patch.prompt_hook || base.prompt_hook,
    memory_updates: {
      relations: mergeStringLists(base.memory_updates.relations, patch.memory_updates.relations),
      places: mergeStringLists(base.memory_updates.places, patch.memory_updates.places),
      injuries: mergeStringLists(base.memory_updates.injuries, patch.memory_updates.injuries),
      resources: mergeStringLists(base.memory_updates.resources, patch.memory_updates.resources),
      notes: mergeStringLists(base.memory_updates.notes, patch.memory_updates.notes)
    },
    state_update: mergeStateUpdates(base.state_update, patch.state_update)
  };
}

function createBackgroundEventDraft(): BackgroundEventDraft {
  return { event: { title: 'Mouvement de la galaxie', summary_public: '', summary_private: undefined, inject_now: false, memory_updates: defaultMemoryUpdates(), state_update: undefined, prompt_hook: undefined }, done: false };
}

function hasBackgroundEventImpact(event: BackgroundWorldEvent | null): boolean {
  return Boolean(event && (event.inject_now || event.summary_public || event.summary_private || event.prompt_hook || event.state_update || event.memory_updates.notes.length || event.memory_updates.relations.length || event.memory_updates.places.length || event.memory_updates.injuries.length || event.memory_updates.resources.length));
}

function coerceBackgroundWorldEvent(source: unknown): BackgroundWorldEvent | null {
  if (!isObjectRecord(source)) return null;
  const title = cleanText(source.title ?? source.event_title, 90);
  const summaryPublic = cleanText(source.summary_public ?? source.summary ?? source.event_summary_public, 260);
  const summaryPrivate = cleanText(source.summary_private ?? source.event_summary_private, 420);
  const promptHook = cleanText(source.prompt_hook, 220);
  const injectNow = typeof source.inject_now === 'boolean' ? source.inject_now : typeof source.inject_now === 'string' ? /^(true|yes|1)$/i.test(source.inject_now.trim()) : false;
  const memoryUpdates = coerceMemoryUpdates(source.memory_updates ?? source);
  const stateUpdate = coerceStateUpdate(source.state_update ?? source);
  const hasSignal = Boolean(title || summaryPublic || summaryPrivate || promptHook || stateUpdate || memoryUpdates.notes.length || memoryUpdates.relations.length || memoryUpdates.places.length || memoryUpdates.injuries.length || memoryUpdates.resources.length);
  if (!hasSignal) return null;
  return { title: title || 'Mouvement de la galaxie', summary_public: summaryPublic, summary_private: summaryPrivate || undefined, inject_now: injectNow, memory_updates: memoryUpdates, state_update: stateUpdate, prompt_hook: promptHook || undefined };
}

function mergeBackgroundEventDraft(base: BackgroundEventDraft, patch: BackgroundWorldEvent): void {
  base.event = mergeBackgroundEvent(base.event, patch);
}

function applyAgenticToolCall(draft: AgenticDraft, toolName: string, args: Record<string, unknown>): { ok: boolean; note: string } {
  if (toolName === 'set_scene') {
    if (typeof args.chapter_title === 'string') draft.chapter_title = cleanText(args.chapter_title, 90) || draft.chapter_title;
    if (typeof args.section_type === 'string') draft.section_type = cleanText(args.section_type, 40) || draft.section_type;
    if (typeof args.scene_description === 'string') draft.scene_description = cleanText(args.scene_description, 180) || draft.scene_description;
    if (isObjectRecord(args.narrative)) draft.narrative = { ...draft.narrative, ...coerceNarrative(args.narrative) };
    if (typeof args.context === 'string') draft.narrative.context = cleanText(args.context, 1200);
    if (typeof args.action === 'string') draft.narrative.action = cleanText(args.action, 2200);
    if (typeof args.dialogue === 'string') draft.narrative.dialogue = cleanText(args.dialogue, 1600);
    if (typeof args.reflection === 'string') draft.narrative.reflection = cleanText(args.reflection, 1400);
    if (typeof args.atmosphere === 'string') draft.narrative.atmosphere = cleanText(args.atmosphere, 80) || draft.narrative.atmosphere;
    return { ok: true, note: 'scene updated' };
  }
  if (toolName === 'update_world') {
    const patch = coerceStateUpdate(isObjectRecord(args.state_update) ? args.state_update : args);
    draft.state_update = mergeStateUpdates(draft.state_update, patch);
    return { ok: true, note: patch ? 'world updated' : 'no world delta detected' };
  }
  if (toolName === 'update_npc') {
    const patch = coerceStateUpdate({ npcs: [isObjectRecord(args.npc) ? args.npc : args] });
    draft.state_update = mergeStateUpdates(draft.state_update, patch);
    return { ok: true, note: patch?.npcs?.length ? 'npc updated' : 'invalid npc payload' };
  }
  if (toolName === 'update_faction') {
    const factionDeltas: Record<string, number> = {};
    if (isObjectRecord(args.factions)) for (const [id, value] of Object.entries(args.factions)) { const delta = Number(value); if (Number.isFinite(delta)) factionDeltas[cleanText(id, 60)] = delta; }
    const singleFaction = cleanText(args.faction, 60);
    const singleDelta = Number(args.delta);
    if (singleFaction && Number.isFinite(singleDelta)) factionDeltas[singleFaction] = (factionDeltas[singleFaction] ?? 0) + singleDelta;
    const patch = coerceStateUpdate({ factions: factionDeltas });
    draft.state_update = mergeStateUpdates(draft.state_update, patch);
    return { ok: Object.keys(factionDeltas).length > 0, note: Object.keys(factionDeltas).length ? 'faction delta applied' : 'no valid faction delta' };
  }
  if (toolName === 'add_memory') {
    const source = isObjectRecord(args.memory_updates) ? args.memory_updates : args;
    draft.memory_updates = {
      relations: mergeStringLists(draft.memory_updates.relations, coerceMemoryUpdates(source).relations),
      places: mergeStringLists(draft.memory_updates.places, coerceMemoryUpdates(source).places),
      injuries: mergeStringLists(draft.memory_updates.injuries, coerceMemoryUpdates(source).injuries),
      resources: mergeStringLists(draft.memory_updates.resources, coerceMemoryUpdates(source).resources),
      notes: mergeStringLists(draft.memory_updates.notes, coerceMemoryUpdates(source).notes)
    };
    return { ok: true, note: 'memory updated' };
  }
  if (toolName === 'offer_choices') {
    const sourceChoices = Array.isArray(args.choices) ? args.choices : (args.choice ? [args.choice] : []);
    const parsedChoices = sourceChoices.map(item => ({ text: cleanText((item as Record<string, unknown>).text ?? item, 220), attribute: 'survival', difficulty: 2, faction_impact: {} }))
      .filter(choice => choice.text)
      .map(choice => ({ ...choice, attribute: 'survival' as const }));
    draft.choices = dedupeChoices([...draft.choices, ...parsedChoices]);
    return { ok: parsedChoices.length > 0, note: parsedChoices.length ? 'choices registered' : 'no valid choices' };
  }
  if (toolName === 'finalize_turn') {
    if (typeof args.user_edits_applied === 'string') draft.user_edits_applied = cleanText(args.user_edits_applied, 180) || null;
    draft.done = true;
    return { ok: true, note: 'turn finalized' };
  }
  return { ok: false, note: `unknown tool: ${toolName}` };
}

export async function generateStoryTurn(messages: ChatMessage[], config: StoryProviderConfig, turnNumber: number): Promise<StoryTurnGenerationResult> {
  const normalizedProviderId = normalizeProviderId(config.providerId);
  const normalizedConfig = normalizedProviderId === config.providerId ? config : { ...config, providerId: normalizedProviderId };

  if (supportsAgenticToolCalling(normalizedProviderId, normalizedConfig.model)) {
    try {
      const result = await generateStoryTurnWithTools(messages, normalizedConfig, turnNumber);
      if (hasUsableStoryTurnOutput(result.rawResponse, result.chapter)) return result;
      logger.warn('storyEngine: sortie agentique inexploitable, fallback JSON.');
    } catch (error) {
      logger.warn('storyEngine: mode agentique indisponible, fallback JSON.', error);
    }
  }

  try {
    const rawResponse = await callTextModel(messages, normalizedConfig);
    const chapter = parseStoryResponse(rawResponse, turnNumber);
    if (!hasUsableStoryTurnOutput(rawResponse, chapter)) {
      const recoveryRaw = await callTextModel(buildStrictJsonRecoveryMessages(messages), normalizedConfig);
      const recoveryChapter = parseStoryResponse(recoveryRaw, turnNumber);
      if (hasUsableStoryTurnOutput(recoveryRaw, recoveryChapter)) return { chapter: recoveryChapter, rawResponse: recoveryRaw, mode: 'structured-json', steps: 2, toolCalls: 0 };
      return { chapter: fallbackChapter('Le flux IA était instable sur ce tour. Le récit continue avec des choix sûrs.', turnNumber), rawResponse: JSON.stringify(fallbackChapter('Le flux IA était instable sur ce tour. Le récit continue avec des choix sûrs.', turnNumber)), mode: 'structured-json', steps: 2, toolCalls: 0 };
    }
    return { chapter, rawResponse, mode: 'structured-json', steps: 1, toolCalls: 0 };
  } catch (error) {
    logger.warn('storyEngine: requête texte indisponible, fallback local.', error);
    const emergencyChapter = fallbackChapter('Le générateur IA a mis trop de temps à répondre.', turnNumber);
    return { chapter: emergencyChapter, rawResponse: JSON.stringify(emergencyChapter), mode: 'structured-json', steps: 0, toolCalls: 0 };
  }
}

async function generateStoryTurnWithTools(messages: ChatMessage[], config: StoryProviderConfig, turnNumber: number): Promise<StoryTurnGenerationResult> {
  const stepCaps: ModelCapabilities = detectModelCapabilities(config);
  const extractionMaxTokens = getStoryExtractionMaxTokens(stepCaps, config);
  const extractionTemperature = isOpenRouterGrok41Fast(config)
    ? 0.35
    : isOpenRouterMimoV2Flash(config)
      ? 0.32
      : 0.4;
  const baseConversation = messages.map(message => ({ role: message.role, content: message.content }));
  const phase1Response = await callOpenAiCompatibleRaw(baseConversation, config, { maxTokens: stepCaps.maxOutputTokens, temperature: stepCaps.idealTemperature, skipReasoning: false });
  const phase1Text = cleanText(phase1Response.content, 8000);
  const phase1Json = parseJsonSafely(phase1Text);
  if (phase1Json) {
    const chapter = parseStoryResponse(phase1Text, turnNumber);
    if (hasPlayableChapterContent(chapter)) return { chapter, rawResponse: phase1Text, mode: 'structured-json', steps: 1, toolCalls: 0 };
  }
  if (!phase1Text) throw new Error('[storyEngine] Phase 1 retourna une réponse vide.');

  const draft = createAgenticDraft(turnNumber);
  if (!phase1Json) draft.narrative.action = phase1Text;

  const phase1AssistantTurn: Record<string, unknown> = { role: 'assistant', content: phase1Text };
  if (typeof phase1Response.reasoning === 'string' && phase1Response.reasoning.trim()) {
    phase1AssistantTurn.reasoning = phase1Response.reasoning;
  }
  if (typeof phase1Response.reasoning_content === 'string' && phase1Response.reasoning_content.trim()) {
    phase1AssistantTurn.reasoning_content = phase1Response.reasoning_content;
  }
  if (Array.isArray(phase1Response.reasoning_details) && phase1Response.reasoning_details.length) {
    phase1AssistantTurn.reasoning_details = phase1Response.reasoning_details;
  }

  const extractionConversation: any[] = [
    ...baseConversation,
    phase1AssistantTurn,
    {
      role: 'user',
      content: `Extrais les données structurées de cette scène (sans réécrire la narration):\n• update_world\n• update_npc\n• offer_choices\n• finalize_turn`
    }
  ];
  const rawChunks: string[] = [phase1Text];
  let totalToolCalls = 0;
  let steps = 1;

  for (let step = 1; step <= 6; step += 1) {
    steps = step + 1;
    const extractMsg = await callOpenAiCompatibleRaw(extractionConversation, config, {
      tools: AGENTIC_GM_TOOLS,
      toolChoice: 'auto',
      maxTokens: extractionMaxTokens,
      temperature: extractionTemperature,
      skipReasoning: true
    });
    const assistantContent = cleanText(extractMsg.content, 4000);
    if (assistantContent) rawChunks.push(assistantContent);
    const toolCalls = Array.isArray(extractMsg.tool_calls) ? extractMsg.tool_calls : [];
    if (!toolCalls.length) {
      for (const tc of extractPseudoToolCalls(assistantContent).filter(tc => isSupportedAgenticToolName(tc.name))) { totalToolCalls += 1; applyAgenticToolCall(draft, tc.name, tc.args); }
      break;
    }
    const assistantTurn: Record<string, unknown> = {
      role: 'assistant',
      content: extractMsg.content ?? '',
      tool_calls: toolCalls
    };
    if (typeof extractMsg.reasoning === 'string' && extractMsg.reasoning.trim()) {
      assistantTurn.reasoning = extractMsg.reasoning;
    }
    if (typeof extractMsg.reasoning_content === 'string' && extractMsg.reasoning_content.trim()) {
      assistantTurn.reasoning_content = extractMsg.reasoning_content;
    }
    if (Array.isArray(extractMsg.reasoning_details) && extractMsg.reasoning_details.length) {
      assistantTurn.reasoning_details = extractMsg.reasoning_details;
    }
    extractionConversation.push(assistantTurn);
    for (const tc of toolCalls) {
      totalToolCalls += 1;
      const args = parseToolArguments(tc.function.arguments);
      const result = applyAgenticToolCall(draft, tc.function.name, args);
      extractionConversation.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
    }
    if (draft.done && draft.choices.length > 0 && draftHasWorldSignals(draft)) break;
  }

  if (!draftHasWorldSignals(draft)) {
    const repaired = ensureWorldStateFallbacks(draft.narrative, draft.state_update, draft.memory_updates);
    draft.state_update = repaired.stateUpdate;
    draft.memory_updates = repaired.memoryUpdates;
  }

  return { chapter: parseStoryResponse(JSON.stringify({ chapter_title: draft.chapter_title, chapter_number: turnNumber, section_type: draft.section_type, narrative: draft.narrative, choices: draft.choices, memory_updates: draft.memory_updates, state_update: draft.state_update, scene_description: draft.scene_description, user_edits_applied: draft.user_edits_applied }), turnNumber), rawResponse: rawChunks.join('\n\n').trim(), mode: 'agentic-tools', steps, toolCalls: totalToolCalls };
}

const AGENTIC_GM_TOOLS: any[] = [
  { type: 'function', function: { name: 'set_scene', description: 'Définit la scène narrative (titre, type, blocs narratifs, prompt image).', parameters: { type: 'object', properties: { chapter_title: { type: 'string' }, section_type: { type: 'string' }, narrative: { type: 'object' }, context: { type: 'string' }, action: { type: 'string' }, dialogue: { type: 'string' }, reflection: { type: 'string' }, atmosphere: { type: 'string' }, scene_description: { type: 'string' } } } } },
  { type: 'function', function: { name: 'update_world', description: 'Applique les conséquences mécaniques globales.', parameters: { type: 'object', properties: { state_update: { type: 'object' } } } } },
  { type: 'function', function: { name: 'update_npc', description: 'Met à jour ou crée un PNJ précis.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'update_faction', description: 'Applique un delta de réputation de faction.', parameters: { type: 'object', properties: { faction: { type: 'string' }, delta: { type: 'number' }, factions: { type: 'object' } } } } },
  { type: 'function', function: { name: 'add_memory', description: 'Ajoute des faits persistants.', parameters: { type: 'object', properties: { memory_updates: { type: 'object' }, relations: { type: 'array' }, places: { type: 'array' }, injuries: { type: 'array' }, resources: { type: 'array' }, notes: { type: 'array' } } } } },
  { type: 'function', function: { name: 'offer_choices', description: 'Propose 3 à 4 choix jouables.', parameters: { type: 'object', properties: { choices: { type: 'array' } } } } },
  { type: 'function', function: { name: 'finalize_turn', description: 'Indique que le tour est complet.', parameters: { type: 'object', properties: { user_edits_applied: { type: 'string' } } } } }
];

const AGENTIC_BACKGROUND_TOOLS: any[] = [
  { type: 'function', function: { name: 'queue_world_event', description: 'Crée ou met à jour un événement hors-écran du monde.', parameters: { type: 'object', properties: { title: { type: 'string' }, summary_public: { type: 'string' }, summary_private: { type: 'string' }, inject_now: { type: 'boolean' }, prompt_hook: { type: 'string' }, memory_updates: { type: 'object' }, state_update: { type: 'object' }, hp: { type: 'number' }, credits: { type: 'number' }, location: { type: 'string' }, date_advance: { type: 'string' }, npcs: { type: 'array' }, factions: { type: 'object' }, injuries_new: { type: 'array' }, injuries_resolved: { type: 'array' }, inventory_gained: { type: 'array' }, inventory_lost: { type: 'array' }, clocks_new: { type: 'array' }, clocks_advance: { type: 'object' }, sector_influence: { type: 'object' }, rumors_new: { type: 'array' }, environment_status: { type: 'string' }, director_instruction: { type: 'string' } } } } },
  { type: 'function', function: { name: 'finalize_background_tick', description: 'Termine le tick de monde hors-écran.', parameters: { type: 'object', properties: { done: { type: 'boolean' }, reason: { type: 'string' } } } } }
];

function buildBackgroundWorldSystemPrompt(input: BackgroundWorldInput, promptMode: StoryPromptMode = 'json'): string {
  const setup = input.setup;
  const protagonist = [setup.protagonistFirstName || '', setup.protagonistLastName || ''].join(' ').trim() || 'Le protagoniste';
  const recentBlock = input.recentSummary.length ? `\nRÉSUMÉ RÉCENT:\n${input.recentSummary.map(item => `- ${cleanText(item, 220)}`).join('\n')}` : '';
  const memoryBlock = input.memoryFacts.length ? `\nMÉMOIRE LONG TERME:\n${input.memoryFacts.slice(-20).map(item => `- ${cleanText(item, 200)}`).join('\n')}` : '';
  let worldBlock = '\nÉTAT MONDE: indisponible';
  if (input.worldState) {
    const p = input.worldState.player;
    const topFactions = Object.entries(input.worldState.factions).sort(([, left], [, right]) => right - left).slice(0, 5).map(([id, score]) => `${id}=${score > 0 ? '+' : ''}${score}`).join(', ');
    const npcs = input.worldState.npcs.filter(npc => npc.alive !== false).slice(0, 8).map(npc => `${npc.name}(${npc.status}, aff=${npc.affinity})`).join(', ');
    const envStr = input.worldState.environment_status ? `\n- Météo/Env=${input.worldState.environment_status}` : '';
    const clocksStr = Object.entries(input.worldState.clocks ?? {}).map(([id, c]) => `${id}(${c.current}/${c.max})`).join(', ');
    const rumorsStr = (input.worldState.rumors ?? []).join(' | ');
    const sectorsStr = Object.entries(input.worldState.sector_influence ?? {}).map(([id, val]) => `${id}=${val}%`).join(', ');
    
    worldBlock = `\nÉTAT MONDE:\n- HP=${p.hp}/100 | Crédits=${p.credits}\n- Lieu=${p.location} | Date=${p.date}${envStr}\n- PNJs=${npcs || 'aucun'}\n- Factions=${topFactions || 'neutre'}\n- Tensions (Clocks)=${clocksStr || 'aucune'}\n- Influence Sectorielle=${sectorsStr || 'neutre'}\n- Rumeurs Actuelles=${rumorsStr || 'aucune'}`;
  }
  const base = `Tu es le Simulateur Galactique hors-écran d'une campagne Star Wars.\nTu résous uniquement les dynamiques de fond entre les tours du joueur. Tu peux manipuler les Horloges (clocks), propager des rumeurs, ou changer le climat (environment_status).\n\nSETUP:\n- Protagoniste: ${protagonist}\n- Ère: ${setup.era} | Faction: ${setup.faction} | Rôle: ${setup.role}\n- Prémisse: ${setup.premise || 'Libre'}${worldBlock}${recentBlock}${memoryBlock}`;
  const jsonContract = `Réponds UNIQUEMENT en JSON valide: {"title":"Titre court","summary_public":"Message bref","summary_private":"Contexte MJ optionnel","inject_now":false,"prompt_hook":"Consigne courte","memory_updates":{"relations":[],"places":[],"injuries":[],"resources":[],"notes":[]},"state_update":{"hp":0,"credits":0,"location":"","date_advance":"","npcs":[],"factions":{},"injuries_new":[],"injuries_resolved":[],"inventory_gained":[],"inventory_lost":[],"gm_note":""}}`;
  return `${base}\n\n${jsonContract}`;
}

function buildBackgroundWorldTickPrompt(turnNumber: number): string {
  return `Résous le tick hors-écran après le tour ${turnNumber}.`;
}

function applyBackgroundToolCall(draft: BackgroundEventDraft, toolName: string, args: Record<string, unknown>): { ok: boolean; note: string } {
  if (toolName === 'queue_world_event') {
    const patch = coerceBackgroundWorldEvent(args);
    if (!patch) return { ok: false, note: 'no background event payload' };
    mergeBackgroundEventDraft(draft, patch);
    return { ok: true, note: 'background event updated' };
  }
  if (toolName === 'finalize_background_tick') { draft.done = true; return { ok: true, note: 'background tick finalized' }; }
  return { ok: false, note: `unknown tool: ${toolName}` };
}

async function generateBackgroundWorldEventWithTools(input: BackgroundWorldInput, config: StoryProviderConfig): Promise<BackgroundWorldGenerationResult> {
  const stepCaps: ModelCapabilities = detectModelCapabilities(config);
  const extractionMaxTokens = getBackgroundExtractionMaxTokens(stepCaps, config);
  const firstStepTemperature = isOpenRouterGrok41Fast(config)
    ? 0.72
    : isOpenRouterMimoV2Flash(config)
      ? 0.68
      : 0.8;
  const followupStepTemperature = isOpenRouterGrok41Fast(config)
    ? 0.58
    : isOpenRouterMimoV2Flash(config)
      ? 0.54
      : 0.65;
  const conversation: ChatMessage[] = [{ role: 'system', content: buildBackgroundWorldSystemPrompt(input, 'tool-calls') }, { role: 'user', content: buildBackgroundWorldTickPrompt(input.turnNumber) }];
  const draft = createBackgroundEventDraft();
  const rawChunks: string[] = [];
  let totalToolCalls = 0; let steps = 0;
  for (let step = 1; step <= 5; step += 1) {
    steps = step;
    const assistantMessage = await callOpenAiCompatibleRaw(conversation as any, config, {
      tools: AGENTIC_BACKGROUND_TOOLS as any,
      toolChoice: 'auto',
      maxTokens: extractionMaxTokens,
      temperature: step === 1 ? firstStepTemperature : followupStepTemperature,
      skipReasoning: true
    });
    const assistantContent = cleanText(assistantMessage.content, 8000);
    if (assistantContent) rawChunks.push(assistantContent);
    const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
    if (!toolCalls.length) { if (assistantContent) { const parsed = parseJsonSafely(assistantContent); const patch = coerceBackgroundWorldEvent(parsed); if (patch) mergeBackgroundEventDraft(draft, patch); } break; }
    const assistantTurn: Record<string, unknown> = { role: 'assistant', content: assistantMessage.content ?? '', tool_calls: toolCalls };
    if (typeof assistantMessage.reasoning === 'string' && assistantMessage.reasoning.trim()) {
      assistantTurn.reasoning = assistantMessage.reasoning;
    }
    if (typeof assistantMessage.reasoning_content === 'string' && assistantMessage.reasoning_content.trim()) {
      assistantTurn.reasoning_content = assistantMessage.reasoning_content;
    }
    if (Array.isArray(assistantMessage.reasoning_details) && assistantMessage.reasoning_details.length) {
      assistantTurn.reasoning_details = assistantMessage.reasoning_details;
    }
    conversation.push(assistantTurn as any);
    for (const toolCall of toolCalls) { totalToolCalls += 1; const args = parseToolArguments(toolCall.function.arguments); const result = applyBackgroundToolCall(draft, toolCall.function.name, args); conversation.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(result) } as any); }
    if (draft.done) break;
  }
  return { event: hasBackgroundEventImpact(draft.event) ? draft.event : null, rawResponse: rawChunks.join('\n\n').trim() || JSON.stringify(draft.event), mode: 'agentic-tools', steps: Math.max(1, steps), toolCalls: totalToolCalls };
}

async function generateBackgroundWorldEventStructured(input: BackgroundWorldInput, config: StoryProviderConfig): Promise<BackgroundWorldGenerationResult> {
  const messages: ChatMessage[] = [{ role: 'system', content: buildBackgroundWorldSystemPrompt(input, 'json') }, { role: 'user', content: buildBackgroundWorldTickPrompt(input.turnNumber) }];
  const rawResponse = await callTextModel(messages, config);
  const parsed = parseJsonSafely(rawResponse);
  const event = coerceBackgroundWorldEvent(parsed);
  return { event: hasBackgroundEventImpact(event) ? event : null, rawResponse, mode: 'structured-json', steps: 1, toolCalls: 0 };
}

export async function generateBackgroundWorldEvent(input: BackgroundWorldInput, config: StoryProviderConfig): Promise<BackgroundWorldGenerationResult> {
  const normalizedProviderId = normalizeProviderId(config.providerId);
  const normalizedConfig = normalizedProviderId === config.providerId ? config : { ...config, providerId: normalizedProviderId };
  if (supportsAgenticToolCalling(normalizedProviderId, normalizedConfig.model)) {
    try { return await generateBackgroundWorldEventWithTools(input, normalizedConfig); } catch (error) { logger.warn('storyEngine: background tool-calling indisponible, fallback JSON.', error); }
  }
  return generateBackgroundWorldEventStructured(input, normalizedConfig);
}
