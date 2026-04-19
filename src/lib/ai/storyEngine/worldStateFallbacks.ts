import type { StateUpdate, StoryMemoryUpdates, StoryNarrative } from './types';

const UNKNOWN_LOCATION_PATTERNS = [
  /^inconnu$/i,
  /^unknown$/i,
  /^n[’'\s-]*a$/i,
  /^n\/a$/i,
  /^non renseign[ée]$/i,
  /^non renseigné$/i,
  /^non renseignée$/i,
  /^undefined$/i,
  /^null$/i,
  /^$/
];

const DIALOGUE_SPEAKER_REGEX = /^\s*(?:[\-•*]+\s*)?(?:[«"']?)([A-ZÀ-ÖØ-Ý][\p{L}\p{N}'’\- ]{1,40}?)(?:[»"']?)\s*[:—-]\s*(.+)$/u;

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isUnknownLocation(value: unknown): boolean {
  const text = cleanText(value, 120).toLowerCase();
  return UNKNOWN_LOCATION_PATTERNS.some(pattern => pattern.test(text));
}

function normalizeNpcName(rawName: string): string {
  return cleanText(rawName, 60)
    .replace(/^\s*(?:[«"']|\(|\[)+/, '')
    .replace(/(?:[»"']|\)|\])+\s*$/, '')
    .trim();
}

function extractNpcNamesFromDialogue(narrative: StoryNarrative): string[] {
  const corpus = [narrative.dialogue, narrative.context, narrative.action].filter(Boolean).join('\n');
  if (!corpus) return [];

  const names = new Set<string>();
  for (const line of corpus.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const speakerMatch = trimmed.match(DIALOGUE_SPEAKER_REGEX);
    if (speakerMatch?.[1]) {
      const candidate = normalizeNpcName(speakerMatch[1]);
      if (candidate && candidate.length >= 2 && !isUnknownLocation(candidate)) {
        names.add(candidate);
      }
    }

    const quotedMatches = trimmed.matchAll(/\b(?:le|la|les|un|une|du|de|des)?\s*([A-ZÀ-ÖØ-Ý][\p{L}\p{N}'’\-]{2,}(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}\p{N}'’\-]{2,}){0,2})\b/gu);
    for (const quotedMatch of quotedMatches) {
      const candidate = normalizeNpcName(quotedMatch[1] || '');
      if (candidate && candidate.length >= 2 && !isUnknownLocation(candidate)) {
        names.add(candidate);
      }
    }
  }

  return Array.from(names).slice(0, 5);
}

function mergeUniqueStrings(existing: string[] | undefined, additions: string[]): string[] {
  const base = Array.isArray(existing) ? existing : [];
  const merged = new Set<string>(base.map(item => cleanText(item, 120)).filter(Boolean));
  for (const item of additions) {
    const clean = cleanText(item, 120);
    if (clean) merged.add(clean);
  }
  return Array.from(merged).slice(0, 10);
}

function seedNpcRelationsFromDialogue(narrative: StoryNarrative, stateUpdate?: StateUpdate): StateUpdate | undefined {
  const names = extractNpcNamesFromDialogue(narrative);
  if (!names.length) return stateUpdate;

  const existingNames = new Set(
    (stateUpdate?.npcs || []).map(npc => cleanText(npc.name, 60).toLowerCase()).filter(Boolean)
  );

  const additions = names
    .filter(name => !existingNames.has(name.toLowerCase()))
    .map(name => ({
      name,
      status: 'neutral' as const,
      affinity: 0,
      alive: true
    }));

  if (!additions.length) return stateUpdate;

  return {
    ...(stateUpdate || {}),
    npcs: [...(stateUpdate?.npcs || []), ...additions]
  };
}

function seedRelationNotesFromDialogue(narrative: StoryNarrative, memoryUpdates: StoryMemoryUpdates): StoryMemoryUpdates {
  const names = extractNpcNamesFromDialogue(narrative);
  if (!names.length) return memoryUpdates;

  const relationSeeds = names.map(name => `Rencontre avec ${name}`);

  return {
    relations: mergeUniqueStrings(memoryUpdates.relations, relationSeeds),
    places: [...memoryUpdates.places],
    injuries: [...memoryUpdates.injuries],
    resources: [...memoryUpdates.resources],
    notes: [...memoryUpdates.notes]
  };
}

function inferLocationFromNarrative(narrative: StoryNarrative): string | undefined {
  const corpus = [narrative.context, narrative.action, narrative.dialogue, narrative.reflection].filter(Boolean).join('\n');
  if (!corpus) return undefined;

  const explicitLocationPatterns: RegExp[] = [
    /\b(?:de|dans|sur|à|au|aux)\s+([A-ZÀ-ÖØ-Ý][\p{L}\p{N}'’\-]+(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}\p{N}'’\-]+){0,3})\b/u,
    /\b(Nar Shaddaa|Coruscant|Tatooine|Bespin|Alderaan|Kashyyyk|Mustafar|Dagobah|Hoth|Endor)\b/iu
  ];

  for (const regex of explicitLocationPatterns) {
    const match = corpus.match(regex);
    if (match?.[1]) {
      const candidate = cleanText(match[1], 80);
      if (candidate && !isUnknownLocation(candidate)) return candidate;
    }
  }

  const patterns: Array<[RegExp, string]> = [
    [/\b(?:hangar|dock|quai|spatioport|baie d'embarquement)\b/i, 'Baie d\'embarquement'],
    [/\b(?:cantina|bar|taverne|club)\b/i, 'Cantina'],
    [/\b(?:bunker|poste|avant-poste|base|forteresse)\b/i, 'Base avancée'],
    [/\b(?:temple|sanctuaire|cathédrale|chapelle)\b/i, 'Sanctuaire'],
    [/\b(?:désert|desert|dune|sable)\b/i, 'Désert'],
    [/\b(?:forêt|foret|jungle|bois)\b/i, 'Forêt'],
    [/\b(?:ville|cité|cite|métropole|metropole|quartier)\b/i, 'Quartier urbain'],
    [/\b(?:vaisseau|croiseur|corvette|cargo|navette)\b/i, 'À bord d\'un vaisseau']
  ];

  for (const [regex, label] of patterns) {
    if (regex.test(corpus)) return label;
  }

  return undefined;
}

export function ensureWorldStateFallbacks(
  narrative: StoryNarrative,
  stateUpdate: StateUpdate | undefined,
  memoryUpdates: StoryMemoryUpdates
): { stateUpdate: StateUpdate | undefined; memoryUpdates: StoryMemoryUpdates } {
  const nextStateUpdate: StateUpdate = { ...(stateUpdate || {}) };
  const nextMemoryUpdates: StoryMemoryUpdates = {
    relations: [...(memoryUpdates.relations || [])],
    places: [...(memoryUpdates.places || [])],
    injuries: [...(memoryUpdates.injuries || [])],
    resources: [...(memoryUpdates.resources || [])],
    notes: [...(memoryUpdates.notes || [])]
  };

  if (!nextStateUpdate.location || isUnknownLocation(nextStateUpdate.location)) {
    const inferredLocation = inferLocationFromNarrative(narrative);
    if (inferredLocation) {
      nextStateUpdate.location = inferredLocation;
      nextMemoryUpdates.places = mergeUniqueStrings(nextMemoryUpdates.places, [inferredLocation]);
    }
  }

  const seededStateUpdate = seedNpcRelationsFromDialogue(narrative, nextStateUpdate);
  const seededMemoryUpdates = seedRelationNotesFromDialogue(narrative, nextMemoryUpdates);

  return {
    stateUpdate: seededStateUpdate,
    memoryUpdates: seededMemoryUpdates
  };
}
