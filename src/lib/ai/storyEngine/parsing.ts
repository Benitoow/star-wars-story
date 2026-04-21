import { splitNarrativeParagraphs } from '$lib/editor/narrativeGuardrails';
import type {
  StateUpdate,
  StoryAttribute,
  StoryChapter,
  StoryChoice,
  StoryMemoryUpdates,
  StoryNarrative,
  NpcRelation
} from './types';
import { ensureWorldStateFallbacks, isUnknownLocation } from './worldStateFallbacks';

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

const NARRATIVE_CHOICE_MARKERS: RegExp[] = [
  /^(?:que faites-vous|what do you do|choices?|choix|options?|vos choix)\b[:!?]?\s*$/i,
  /^(?:comment réagissez-vous|how do you respond|next actions?)\b[:!?]?\s*$/i
];

const STRUCTURED_PAYLOAD_HINT_REGEX = /(^|\s)json\s*\{|"chapter_title"\s*:|"chapter_number"\s*:|"narrative"\s*:|"choices"\s*:/i;

function tryExtractNarrativeActionFromPayload(rawText: string): string | null {
  const normalized = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^json\s*/i, '')
    .trim();

  const actionMatch = normalized.match(/"action"\s*:\s*"((?:\\.|[^"\\])*)"/is);
  if (!actionMatch?.[1]) return null;

  try {
    const decoded = JSON.parse(`"${actionMatch[1]}"`);
    return cleanText(decoded, 5500) || null;
  } catch {
    const fallback = actionMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
    return cleanText(fallback, 5500) || null;
  }
}

export function sanitizeNarrativeText(value: unknown, maxLength = 2200): string {
  const text = cleanText(value, maxLength);
  if (!text) return '';

  const trimmed = text.trim();
  const looksLikeStructuredPayload = (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    STRUCTURED_PAYLOAD_HINT_REGEX.test(trimmed)
  );

  if (looksLikeStructuredPayload) {
    const extractedAction = tryExtractNarrativeActionFromPayload(trimmed);
    if (extractedAction) {
      return splitNarrativeParagraphs(extractedAction)
        .map(item => item.text)
        .join('\n\n')
        .slice(0, maxLength);
    }
    return 'Le passage a été nettoyé automatiquement pour éviter un affichage technique.';
  }

  const lines = text.split('\n');
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let inChoiceBlock = false;

  const flush = (): void => {
    const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (paragraph) paragraphs.push(paragraph);
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }

    const normalized = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^\*\*\s*/, '')
      .replace(/\s*\*\*$/, '')
      .replace(/^[_`*]+|[_`*]+$/g, '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim();

    if (!normalized) continue;
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(normalized)) {
      flush();
      continue;
    }

    if (NARRATIVE_CHOICE_MARKERS.some(pattern => pattern.test(normalized))) {
      flush();
      inChoiceBlock = true;
      continue;
    }

    if (inChoiceBlock) continue;
    if (/^\d+[.)]\s+/.test(normalized)) continue;

    buffer.push(normalized.replace(/\s{2,}/g, ' '));
  }

  flush();
  if (paragraphs.length) {
    return paragraphs
      .flatMap(paragraph => splitNarrativeParagraphs(paragraph).map(item => item.text))
      .join('\n\n')
      .trim();
  }

  return text ? 'Le passage a été nettoyé automatiquement pour éviter un affichage technique.' : '';
}

function normalizeTextForPrompt(value: unknown): string {
  return cleanText(value, 2000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeMemoryText(value: unknown): string {
  return cleanText(value, 400)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const MEMORY_NOISE_PATTERNS: RegExp[] = [
  /\[object object\]/i,
  /(?:^|\b)json\s*[\[{]/i,
  /"chapter_title"\s*:/i,
  /"chapter_number"\s*:/i,
  /"narrative"\s*:/i,
  /"choices"\s*:/i,
  /<\|?tool_call\|?>|tool_call|(?:^|\s)call:[a-z_]+\s*\{/i,
  /passage a ete nettoye automatiquement/i,
  /sortie technique non lisible/i,
  /fallback|aborterror|aborted|inexploitable|instable/i,
  /^relation\s*:\s*rencontre\s+avec\s+/i,
  /^rencontre\s+avec\s+/i
];

function isMemoryNoise(value: unknown): boolean {
  const normalized = normalizeMemoryText(value);
  if (!normalized) return true;
  return MEMORY_NOISE_PATTERNS.some(pattern => pattern.test(normalized));
}

function extractMemoryTextFromObject(value: Record<string, unknown>): string {
  const PRIORITY_KEYS = ['text', 'note', 'description', 'name', 'title', 'value', 'content', 'summary'];
  const parts: string[] = [];

  for (const key of PRIORITY_KEYS) {
    const item = value[key];
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const cleaned = cleanText(item, 120);
      if (cleaned) parts.push(cleaned);
    }
  }

  const merged = parts.join(' — ');
  return cleanText(merged, 120);
}

function coerceMemoryString(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(value, 120);
  }

  if (Array.isArray(value)) {
    const merged = value
      .map(item => coerceMemoryString(item))
      .filter(Boolean)
      .join(' — ');
    return cleanText(merged, 120);
  }

  if (typeof value === 'object') {
    return extractMemoryTextFromObject(value as Record<string, unknown>);
  }

  return '';
}

function uniqueStrings(values: unknown, max = 10): string[] {
  const list = Array.isArray(values) ? values : [];
  const cleaned = list
    .map(item => coerceMemoryString(item))
    .map(item => item.replace(/\s+/g, ' ').trim())
    .filter(item => item.length >= 4)
    .filter(item => !isMemoryNoise(item));

  const dedup = new Map<string, string>();
  for (const item of cleaned) {
    const key = normalizeMemoryText(item);
    if (!key) continue;
    dedup.set(key, item);
  }

  return Array.from(dedup.values()).slice(0, max);
}

function normalizeAttribute(rawAttribute: unknown): StoryAttribute {
  const attr = String(rawAttribute || '').trim().toLowerCase();
  const allowed: StoryAttribute[] = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'];
  return allowed.includes(attr as StoryAttribute) ? (attr as StoryAttribute) : 'survival';
}

function inferAttributeFromChoiceText(text: string): StoryAttribute {
  const normalized = normalizeTextForPrompt(text);

  if (/(force|jedi|sith|sabre|telekin|telekinesis|ancrer|canalis|pressent|intuition|prévoir|prevoir)/.test(normalized)) {
    return 'force';
  }

  if (/(parler|dialogue|négocier|negocier|convainc|persuad|bluff|marchand|questionn|interrog|discut|intim|menac|coopér|cooper)/.test(normalized)) {
    return 'diplomacy';
  }

  if (/(discret|furtif|ombre|camouf|infiltr|se faufiler|se glisser|silenc|subreptic|contourner|éviter|eviter|fuite|fuir|évasion|evasion)/.test(normalized)) {
    return 'stealth';
  }

  if (/(hack|pirat|terminal|code|syst[eè]me|verrou|droid|ordinateur|techn|désactiv|desactiv|recalibr)/.test(normalized)) {
    return 'tech';
  }

  if (/(combat|attaqu|assaut|duel|blaster|tir|fonc|briser|neutralis|élimin|elim|ripost|battre|frapp)/.test(normalized)) {
    return 'combat';
  }

  if (/(surviv|explor|observer|repl|route|chemin|patrouill|travers|march|attend|patient|prépar|prepar|échapper|echapper)/.test(normalized)) {
    return 'survival';
  }

  return 'survival';
}

function sanitizeChoiceText(value: unknown, maxLength = 220): string {
  let text = cleanText(value, maxLength + 30).trim();
  if (!text) return '';

  const leadingChoiceMarker = /^(?:[-*•]\s*|[A-Da-d]\s*[)\].:-]\s*|\d{1,2}\s*[)\].:-]\s*)/;
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(leadingChoiceMarker, '').trim();
    if (next === text) break;
    text = next;
  }

  text = text
    .replace(/^["'«»\s]+|["'«»\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text.slice(0, maxLength);
}

function normalizeChoice(choice: unknown): StoryChoice | null {
  if (!choice) return null;

  if (typeof choice === 'string') {
    const text = sanitizeChoiceText(choice, 220);
    if (!text) return null;
    return {
      text,
      attribute: inferAttributeFromChoiceText(text),
      difficulty: 2,
      faction_impact: {}
    };
  }

  if (typeof choice !== 'object') return null;

  const record = choice as Record<string, unknown>;
  const text = sanitizeChoiceText(record.text, 220);
  if (!text) return null;

  const difficultyNumber = Number(record.difficulty);
  const difficulty = Number.isFinite(difficultyNumber)
    ? Math.max(1, Math.min(5, Math.round(difficultyNumber)))
    : 2;

  const factionImpactSource = record.faction_impact;
  const factionImpact: Record<string, number> = {};
  if (factionImpactSource && typeof factionImpactSource === 'object' && !Array.isArray(factionImpactSource)) {
    for (const [key, value] of Object.entries(factionImpactSource)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        factionImpact[key] = numeric;
      }
    }
  }

  return {
    text,
    attribute: normalizeAttribute(record.attribute) !== 'survival' || !text
      ? normalizeAttribute(record.attribute)
      : inferAttributeFromChoiceText(text),
    difficulty,
    faction_impact: factionImpact
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const FALLBACK_CHOICE_TEMPLATES: Record<StoryAttribute, string[]> = {
  stealth: [
    'Contourner les patrouilles discrètement {hint} pour trouver un angle mort.',
    'Observer les routines ennemies {hint} avant de s\'engager.',
    'Se fondre dans l\'environnement {hint} pour repérer une ouverture.'
  ],
  diplomacy: [
    'Engager calmement le dialogue {hint} pour obtenir des informations.',
    'Tenter une négociation mesurée {hint} afin d\'éviter l\'escalade.',
    'Questionner les personnes présentes {hint} pour clarifier les enjeux.'
  ],
  combat: [
    'Prendre l\'initiative avec une manœuvre offensive contrôlée {hint}.',
    'Lancer une action rapide pour briser l\'avantage adverse {hint}.',
    'Forcer le passage par une percée tactique {hint}.'
  ],
  tech: [
    'Exploiter la technologie locale {hint} pour obtenir un avantage tactique.',
    'Pirater les systèmes disponibles {hint} pour brouiller la surveillance.',
    'Analyser les signaux et verrouillages {hint} pour créer une faille.'
  ],
  force: [
    'S\'ancrer dans la Force {hint} pour anticiper le danger immédiat.',
    'Utiliser la perception de la Force {hint} pour choisir la meilleure fenêtre.',
    'Canaliser la Force {hint} afin de renverser le rapport de force.'
  ],
  survival: [
    'Se repositionner prudemment {hint} pour préserver santé et ressources.',
    'Sécuriser une route de repli {hint} avant toute prise de risque.',
    'Stabiliser la situation {hint} puis préparer une action plus sûre.'
  ]
};

function inferFallbackChoiceHint(seedText: string): string {
  const text = normalizeTextForPrompt(seedText);
  if (/(hangar|dock|quai|spatioport|vaisseau|croiseur)/.test(text)) return 'dans les zones d\'arrimage';
  if (/(cantina|bar|taverne|club|salle commune)/.test(text)) return 'au milieu de la foule';
  if (/(base|poste|avant-poste|bunker|forteresse)/.test(text)) return 'dans le périmètre sécurisé';
  if (/(desert|dune|tempete|jungle|foret|marais|glace|neige)/.test(text)) return 'sur ce terrain hostile';
  if (/(secteur|blocus|verrouillage|patrouille|checkpoint)/.test(text)) return 'dans ce secteur sous tension';
  return 'dans la zone actuelle';
}

function chooseFallbackThirdAttribute(seedText: string, sectionType: string): StoryAttribute {
  const text = normalizeTextForPrompt(`${seedText} ${sectionType}`);
  if (/(force|jedi|sith|kyber|holocron)/.test(text)) return 'force';
  if (/(terminal|console|droid|pirat|reseau|système|systeme|chiffre|code)/.test(text)) return 'tech';
  if (/(action|confrontation|tension|combat|assaut|embuscade|blaster|duel|tir)/.test(text)) return 'combat';
  return 'survival';
}

function fallbackDifficulty(seed: number, offset: number): number {
  return Math.max(1, Math.min(5, 2 + ((seed + offset) % 3)));
}

function defaultChoices(seedText = '', turnNumber = 1, sectionType = ''): StoryChoice[] {
  const normalizedSeed = cleanText(`${seedText}|${sectionType}|${turnNumber}`, 1200);
  const seed = stableHash(normalizedSeed || String(turnNumber));
  const hint = inferFallbackChoiceHint(seedText);

  const attributes: StoryAttribute[] = [
    'stealth',
    'diplomacy',
    chooseFallbackThirdAttribute(seedText, sectionType)
  ];

  const generated = attributes.map((attribute, index) => {
    const templates = FALLBACK_CHOICE_TEMPLATES[attribute];
    const template = templates[(seed + turnNumber + index) % templates.length];

    return {
      text: cleanText(template.replace('{hint}', hint), 220),
      attribute,
      difficulty: fallbackDifficulty(seed, index),
      faction_impact: {}
    } satisfies StoryChoice;
  });

  return dedupeChoices(generated);
}

function defaultMemoryUpdates(): StoryMemoryUpdates {
  return {
    relations: [],
    places: [],
    injuries: [],
    resources: [],
    notes: []
  };
}

function defaultNarrativeFromRaw(rawText: string): StoryNarrative {
  return {
    context: '',
    action: sanitizeNarrativeText(rawText, 2200),
    dialogue: '',
    reflection: '',
    atmosphere: 'tense'
  };
}

function isDiagnosticFallbackText(rawText: string): boolean {
  const text = cleanText(rawText, 320).toLowerCase();
  return [
    'temps imparti',
    'fallback',
    'non bloquant',
    'aborted',
    'aborterror',
    'inexploitable',
    'instable',
    'erreur',
    'secours',
    'bloquer'
  ].some(token => text.includes(token));
}

function buildEmergencyFallbackSeed(turnNumber: number): string {
  if (turnNumber <= 1) {
    return `La baie d'embarquement s'illumine sous des néons fatigués. Quelqu'un approche dans le vacarme des réacteurs, et la première décision est déjà en suspens.`;
  }

  return `La scène repart dans un souffle de fumée et de métal chaud. Les tensions sont toujours là, et le prochain choix peut faire basculer la situation.`;
}

function extractLargestJsonObject(rawText: string): string | null {
  const text = String(rawText || '');
  const chunks: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (!stack.length) start = i;
      stack.push(char);
      continue;
    }

    if (char === '}') {
      stack.pop();
      if (!stack.length && start !== -1) {
        chunks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  chunks.sort((a, b) => b.length - a.length);
  for (const chunk of chunks) {
    try {
      JSON.parse(chunk);
      return chunk;
    } catch {
      // try next
    }
  }

  return null;
}

export function parseJsonSafely(rawText: string): Record<string, unknown> | null {
  const cleaned = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^json\s*/i, '')
    .trim();

  const largest = extractLargestJsonObject(cleaned);

  if (largest) {
    try {
      const parsed = JSON.parse(largest);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      // fallback below
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function coerceNarrative(source: unknown): StoryNarrative {
  if (!source || typeof source !== 'object') {
    return {
      context: '',
      action: '',
      dialogue: '',
      reflection: '',
      atmosphere: 'tense'
    };
  }

  const data = source as Record<string, unknown>;

  return {
    context: sanitizeNarrativeText(data.context, 1200),
    action: sanitizeNarrativeText(data.action, 5500),
    dialogue: sanitizeNarrativeText(data.dialogue, 1600),
    reflection: sanitizeNarrativeText(data.reflection, 1400),
    atmosphere: cleanText(data.atmosphere, 80) || 'tense'
  };
}

export function coerceMemoryUpdates(source: unknown): StoryMemoryUpdates {
  if (!source || typeof source !== 'object') return defaultMemoryUpdates();
  const data = source as Record<string, unknown>;
  return {
    relations: uniqueStrings(data.relations),
    places: uniqueStrings(data.places),
    injuries: uniqueStrings(data.injuries),
    resources: uniqueStrings(data.resources),
    notes: uniqueStrings(data.notes)
  };
}

export function coerceStateUpdate(source: unknown): StateUpdate | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const d = source as Record<string, unknown>;

  const update: StateUpdate = {};

  if (typeof d.hp === 'number' && Number.isFinite(d.hp)) update.hp = Math.max(-100, Math.min(100, d.hp));
  if (typeof d.credits === 'number' && Number.isFinite(d.credits)) update.credits = d.credits;
  if (typeof d.location === 'string' && d.location.trim() && !isUnknownLocation(d.location)) update.location = cleanText(d.location, 80);
  if (typeof d.date_advance === 'string' && d.date_advance.trim()) update.date_advance = cleanText(d.date_advance, 60);
  if (typeof d.gm_note === 'string') update.gm_note = cleanText(d.gm_note, 200);

  if (d.factions && typeof d.factions === 'object' && !Array.isArray(d.factions)) {
    const fmap: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.factions as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) fmap[k] = Math.max(-50, Math.min(50, n));
    }
    if (Object.keys(fmap).length) update.factions = fmap;
  }

  if (Array.isArray(d.npcs)) {
    const npcs = d.npcs
      .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
      .map(n => {
        const name = cleanText(n.name, 60);
        if (!name) return null;
        const entry: Partial<NpcRelation> & { name: string } = { name };
        if (typeof n.affinity === 'number') entry.affinity = Math.max(-100, Math.min(100, n.affinity));
        const normalizedStatus = String(n.status || '').toLowerCase();
        if (['ally', 'neutral', 'hostile', 'dead', 'unknown'].includes(normalizedStatus)) {
          entry.status = normalizedStatus === 'unknown'
            ? 'neutral'
            : (normalizedStatus as NpcRelation['status']);
        }
        if (typeof n.faction === 'string') entry.faction = cleanText(n.faction, 40);
        if (typeof n.last_seen === 'string') entry.last_seen = cleanText(n.last_seen, 60);
        if (typeof n.alive === 'boolean') entry.alive = n.alive;
        if (typeof n.note === 'string') entry.note = cleanText(n.note, 120);
        return entry;
      })
      .filter((n): n is Partial<NpcRelation> & { name: string } => n !== null);
    if (npcs.length) update.npcs = npcs;
  }

  if (Array.isArray(d.injuries_new)) {
    update.injuries_new = d.injuries_new
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map(i => ({
        description: cleanText(i.description, 100),
        severity: (['light', 'moderate', 'severe'].includes(String(i.severity || '').toLowerCase())
          ? String(i.severity).toLowerCase()
          : 'light') as 'light' | 'moderate' | 'severe'
      }))
      .filter(i => i.description);
  }

  if (Array.isArray(d.injuries_resolved)) update.injuries_resolved = uniqueStrings(d.injuries_resolved, 10);

  if (Array.isArray(d.inventory_gained)) {
    update.inventory_gained = d.inventory_gained
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map(i => ({ name: cleanText(i.name, 60), qty: Math.max(1, Number(i.qty) || 1) }))
      .filter(i => i.name);
  }

  if (Array.isArray(d.inventory_lost)) {
    update.inventory_lost = d.inventory_lost
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map(i => ({ name: cleanText(i.name, 60), qty: Math.max(1, Number(i.qty) || 1) }))
      .filter(i => i.name);
  }

  if (Array.isArray(d.clocks_new)) {
    update.clocks_new = d.clocks_new
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map(c => ({ name: cleanText(c.name, 60), max_steps: Math.max(1, Number(c.max_steps) || 4) }))
      .filter(c => c.name);
  }

  if (d.clocks_advance && typeof d.clocks_advance === 'object' && !Array.isArray(d.clocks_advance)) {
    const cmap: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.clocks_advance as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) cmap[k] = Math.max(-10, Math.min(10, n));
    }
    if (Object.keys(cmap).length) update.clocks_advance = cmap;
  }

  if (d.sector_influence && typeof d.sector_influence === 'object' && !Array.isArray(d.sector_influence)) {
    const smap: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.sector_influence as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) smap[k] = Math.max(-100, Math.min(100, n));
    }
    if (Object.keys(smap).length) update.sector_influence = smap;
  }

  if (Array.isArray(d.rumors_new)) update.rumors_new = uniqueStrings(d.rumors_new, 5);

  if (typeof d.environment_status === 'string') update.environment_status = cleanText(d.environment_status, 120);
  if (typeof d.director_instruction === 'string') update.director_instruction = cleanText(d.director_instruction, 220);

  return Object.keys(update).length ? update : undefined;
}

function sumInlineDelta(text: string, pattern: RegExp, clampAbs: number): number | undefined {
  const matches = text.matchAll(pattern);
  let sum = 0;
  let found = false;

  for (const match of matches) {
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) continue;
    sum += parsed;
    found = true;
  }

  if (!found) return undefined;
  return Math.max(-clampAbs, Math.min(clampAbs, Math.round(sum)));
}

function extractInlineStateUpdateFromNarrative(narrative: StoryNarrative): StateUpdate | undefined {
  const corpus = [
    narrative.context,
    narrative.action,
    narrative.dialogue,
    narrative.reflection
  ].join('\n');

  if (!corpus.trim()) return undefined;

  const hp = sumInlineDelta(corpus, /\b(?:hp|health|sante|santé)\s*[:=]\s*([+-]?\d{1,4})\b/gi, 100);
  const credits = sumInlineDelta(corpus, /\b(?:credits?|cr[eé]dits?)\s*[:=]\s*([+-]?\d{1,7})\b/gi, 1000000);

  if (hp === undefined && credits === undefined) return undefined;

  const update: StateUpdate = {};
  if (hp !== undefined) update.hp = hp;
  if (credits !== undefined) update.credits = credits;
  return update;
}

function extractChoices(source: unknown): StoryChoice[] {
  const list = Array.isArray(source) ? source : [];
  const normalized = list
    .map(item => normalizeChoice(item))
    .filter((item): item is StoryChoice => Boolean(item));

  const dedup = Array.from(new Map(normalized.map(choice => [choice.text.toLowerCase(), choice])).values());

  return dedup.slice(0, 4);
}

function enforceChoiceAttributeDiversity(
  choices: StoryChoice[],
  seedText: string,
  sectionType: string
): StoryChoice[] {
  if (choices.length < 3) return choices;

  const uniqueBefore = new Set(choices.map(choice => choice.attribute));
  if (uniqueBefore.size >= 2) return choices;

  const diversified = choices.map(choice => ({ ...choice }));
  const fallbackAttributes: StoryAttribute[] = [
    'diplomacy',
    'stealth',
    chooseFallbackThirdAttribute(seedText, sectionType)
  ];

  for (let index = 0; index < diversified.length; index += 1) {
    const current = diversified[index];
    const inferred = inferAttributeFromChoiceText(current.text);
    const target = inferred !== 'survival'
      ? inferred
      : fallbackAttributes[index % fallbackAttributes.length];

    if (target !== diversified[0].attribute) {
      diversified[index] = { ...current, attribute: target };
    }

    if (new Set(diversified.map(choice => choice.attribute)).size >= 2) {
      break;
    }
  }

  return diversified;
}

function isGenericChapterTitle(title: string): boolean {
  const normalized = normalizeTextForPrompt(title).replace(/\s+/g, ' ').trim();
  if (!normalized) return true;

  return /^(?:tour|turn|chapitre|chapter|scene|sc[èe]ne)\s*(?:n[o°]\s*)?[\divxlcdm-]*$/i.test(normalized);
}

function toTitleCase(words: string[]): string {
  return words
    .map(word => word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : '')
    .filter(Boolean)
    .join(' ');
}

function deriveChapterTitleFromNarrative(narrative: StoryNarrative, turnNumber: number): string {
  const corpus = [
    narrative.action,
    narrative.context,
    narrative.dialogue,
    narrative.reflection
  ].filter(Boolean).join(' ');

  const normalizedCorpus = normalizeTextForPrompt(corpus);
  if (/(hangar|spatioport|dock|quai d['’]arrimage|baie d['’]arrimage)/.test(normalizedCorpus)) {
    return 'Tension au spatioport';
  }
  if (/(cantina|bar|taverne|club)/.test(normalizedCorpus)) {
    return 'Rumeurs de cantina';
  }
  if (/(embuscade|attaque|assaut|chasseur|blaster|duel|fusillade)/.test(normalizedCorpus)) {
    return 'Sous le feu ennemi';
  }
  if (/(negoci|dialog|parler|accord|tr[eê]ve)/.test(normalizedCorpus)) {
    return 'Négociation sous pression';
  }

  const firstSentence = cleanText(corpus, 320)
    .split(/[.!?\n]/)
    .map(item => item.trim())
    .find(item => item.length >= 16) || '';

  const tokens = firstSentence
    .replace(/["'«»“”():,;]+/g, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !/^(?:le|la|les|un|une|des|de|du|dans|sur|a|au|aux|et|mais|ou|donc)$/i.test(item))
    .slice(0, 6);

  if (tokens.length >= 2) {
    return cleanText(toTitleCase(tokens), 80);
  }

  return turnNumber <= 1 ? 'Prologue' : 'Nœud de tension';
}

export function dedupeChoices(choices: StoryChoice[]): StoryChoice[] {
  return Array.from(
    new Map(
      choices
        .map(choice => ({ ...choice, text: cleanText(choice.text, 220) }))
        .filter(choice => Boolean(choice.text))
        .map(choice => [choice.text.toLowerCase(), choice] as const)
    ).values()
  ).slice(0, 4);
}

function fallbackChapter(rawText: string, turnNumber: number): StoryChapter {
  const extractedAction = tryExtractNarrativeActionFromPayload(rawText);
  const visibleSeed = isDiagnosticFallbackText(rawText)
    ? buildEmergencyFallbackSeed(turnNumber)
    : (extractedAction || rawText);
  const narrative = defaultNarrativeFromRaw(visibleSeed || `Le modèle n'a pas renvoyé de JSON exploitable.`);
  const chapterTitle = turnNumber <= 1
    ? 'Prologue'
    : deriveChapterTitleFromNarrative(narrative, turnNumber);

  return {
    chapter_title: chapterTitle,
    chapter_number: turnNumber,
    section_type: 'action',
    narrative,
    choices: defaultChoices(visibleSeed, turnNumber, 'action'),
    memory_updates: defaultMemoryUpdates(),
    scene_description: 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: null
  };
}

export function parseStoryResponse(rawText: string, turnNumber: number): StoryChapter {
  const parsed = parseJsonSafely(rawText);
  if (!parsed) return fallbackChapter(rawText, turnNumber);

  const chapterNumberRaw = Number(parsed.chapter_number);
  const chapterNumber = Number.isFinite(chapterNumberRaw) ? chapterNumberRaw : turnNumber;
  const sectionType = cleanText(parsed.section_type, 40) || 'action';

  const narrative = coerceNarrative(parsed.narrative);
  if (!narrative.action && !narrative.dialogue) {
    const candidate = sanitizeNarrativeText(parsed.action, 2200);
    const rawFallback = sanitizeNarrativeText(rawText, 2200);
    const isJson = (t: string) => /^\s*[{[]/.test(t);
    narrative.action = (candidate && !isJson(candidate))
      ? candidate
      : (!isJson(rawFallback) ? rawFallback : '');
  }

  const rawChapterTitle = cleanText(parsed.chapter_title, 80);
  const chapterTitle = rawChapterTitle && !isGenericChapterTitle(rawChapterTitle)
    ? rawChapterTitle
    : deriveChapterTitleFromNarrative(narrative, chapterNumber);

  const choices = extractChoices(parsed.choices);
  const fallbackChoiceSeed = [
    chapterTitle,
    narrative.context,
    narrative.action,
    narrative.dialogue,
    narrative.reflection
  ].join('\n');
  const safeChoices = choices.length ? choices : defaultChoices(fallbackChoiceSeed, chapterNumber, sectionType);
  const diverseChoices = dedupeChoices(
    enforceChoiceAttributeDiversity(safeChoices, fallbackChoiceSeed, sectionType)
  );

  let memoryUpdates = coerceMemoryUpdates(parsed.memory_updates);
  let stateUpdate = coerceStateUpdate(parsed.state_update);
  const inlineStateUpdate = extractInlineStateUpdateFromNarrative(narrative);

  if (inlineStateUpdate) {
    if (!stateUpdate) {
      stateUpdate = inlineStateUpdate;
    } else {
      if (stateUpdate.hp === undefined && inlineStateUpdate.hp !== undefined) {
        stateUpdate.hp = inlineStateUpdate.hp;
      }
      if (stateUpdate.credits === undefined && inlineStateUpdate.credits !== undefined) {
        stateUpdate.credits = inlineStateUpdate.credits;
      }
    }
  }

  const worldFallbacks = ensureWorldStateFallbacks(narrative, stateUpdate, memoryUpdates);
  stateUpdate = worldFallbacks.stateUpdate;
  memoryUpdates = worldFallbacks.memoryUpdates;

  return {
    chapter_title: chapterTitle,
    chapter_number: chapterNumber,
    section_type: sectionType,
    narrative,
    choices: diverseChoices,
    memory_updates: memoryUpdates,
    scene_description: cleanText(parsed.scene_description, 160) || 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: cleanText(parsed.user_edits_applied, 180) || null,
    state_update: stateUpdate
  };
}
