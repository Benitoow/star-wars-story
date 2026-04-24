import type { StateUpdate, StoryMemoryUpdates, StoryNarrative } from './types';
import { cleanText } from './utils/shared';

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

const DIALOGUE_SPEAKER_REGEX = /(?:^|\s)(?:[\-—•*]+\s*)?(?:[«"']?)([A-ZÀ-ÖØ-Ý][\p{L}\p{N}'’\- ]{1,40}?)(?:[»"']?)\s*:/gu;
const SPEECH_ATTRIBUTION_REGEX = /\b([A-ZÀ-ÖØ-Ý][\p{L}'’\-]{1,30})\s+(?:dit|repond|répond|murmure|souffle|crie|grogne|lance|annonce)\b/gu;

const NPC_NAME_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'ici', 'là', 'la-bas', 'là-bas', 'maintenant',
  'fil', 'fai', 'fait', 'faite', 'faites', 'alors', 'ensuite', 'puis', 'tour',
  'canyon', 'jundland', 'kashyyyk', 'coruscant', 'tatooine', 'naboo', 'bespin',
  'hangar', 'spatioport', 'cantina', 'secteur',
  'hutts', 'hutt', 'rodiens', 'rodien',
  'transport', 'yt-1300', 'yv-666', 'scyk'
]);

const NON_NPC_ENTITY_PATTERNS: RegExp[] = [
  /\b(?:jundland|kashyyyk|coruscant|tatooine|naboo|bespin|mustafar|kamino|hoth|endor|dagobah|nar\s+shaddaa)\b/i,
  /\b(?:hangar|spatioport|cantina|dock|quai|baie\s+d['’]arrimage|secteur|canyon|desert|désert|foret|forêt|ville)\b/i,
  /\b(?:vaisseau|transport|cargo|navette|croiseur|corvette|yt-1300|yv-666|scyk|x-wing|tie)\b/i,
  /\b(?:hutts?|rodiens?|wookiees?|mandaloriens?|stormtroopers?)\b/i
];

const ALLOWED_DROID_NAME_PATTERN = /^(?:r2|c-?3|bb|ig|hk|k2|bd|chopper|ch0pper)\b/i;

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

function isLikelyNpcName(candidate: string): boolean {
  const normalized = cleanText(candidate, 60)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized || isUnknownLocation(normalized)) return false;
  if (NPC_NAME_STOPWORDS.has(normalized)) return false;
  if (normalized.split(/\s+/).length > 3) return false;
  if (/^(?:le|la|les|un|une|des|du|de|d)\s+/.test(normalized)) return false;
  if (NON_NPC_ENTITY_PATTERNS.some(pattern => pattern.test(normalized))) return false;

  const hasDigits = /\d/.test(normalized);
  if (hasDigits && !ALLOWED_DROID_NAME_PATTERN.test(normalized)) return false;

  if (normalized.length < 3 && !ALLOWED_DROID_NAME_PATTERN.test(normalized)) return false;

  return normalized.length >= 2;
}

function extractNpcNamesFromDialogue(narrative: StoryNarrative): string[] {
  const corpus = [narrative.dialogue, narrative.context, narrative.action].filter(Boolean).join('\n');
  if (!corpus) return [];

  const names = new Set<string>();
  for (const line of corpus.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const speakerMatch of trimmed.matchAll(DIALOGUE_SPEAKER_REGEX)) {
      const candidate = normalizeNpcName(speakerMatch[1] || '');
      if (candidate && isLikelyNpcName(candidate)) {
        names.add(candidate);
      }
    }

    for (const match of trimmed.matchAll(SPEECH_ATTRIBUTION_REGEX)) {
      const candidate = normalizeNpcName(match[1] || '');
      if (candidate && isLikelyNpcName(candidate)) {
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

  return {
    stateUpdate: seededStateUpdate,
    memoryUpdates: nextMemoryUpdates
  };
}
