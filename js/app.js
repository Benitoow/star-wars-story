/* ═══════════════════════════════════════════════
   app.js — Main application logic
   Enhanced with UI language switching, collaborative mode, and role details
══════════════════════════════════════════════ */

/* ─── APP STATE ─────────────────────────────── */
const state = {
  provider: null,
  apiKey: '',
  model: null,
  imgProvider: 'none',
  imgModel: null,
  imgApiKey: '',
  currentStoryId: null,
  uiLang: 'fr',                    // UI language
  setup: {
    language: null,                // Narration language
    firstName: '',
    lastName: '',
    era: null,
    faction: null,
    role: null,
    premise: null,
    contentIntensity: 'cinematic'
  },
  userEdits: [],                    // Collaborative mode edits
  messages: [],
  turn: 0,
  dashboardModelEdit: false,
  isGenerating: false,
  currentChapter: null,
  imageRetryCount: 0,
  hiddenSkillProgress: null,
  hiddenRelationshipProgress: null,
  hiddenFactionReputation: null,
  hiddenCampProfile: null,
  hiddenProtagonistProfile: null
};

const STORY_STORAGE_KEY = 'sw_saved_stories';
const FLOW_READY_KEY = 'sw_flow_ready';
const LAST_PROVIDER_KEY = 'sw_last_provider';
const LAST_MODEL_KEY = 'sw_last_model';
const LAST_IMAGE_PROVIDER_KEY = 'sw_last_image_provider';
const LAST_IMAGE_MODEL_KEY = 'sw_last_image_model';
const STORY_MEMORY_PREFIX = 'sw_story_memory_md_';
const STORY_SKILL_PROGRESS_PREFIX = 'sw_story_skill_progress_';
const STORY_RELATIONSHIP_PREFIX = 'sw_story_relationship_md_';
const STORY_FACTION_REPUTATION_PREFIX = 'sw_story_faction_reputation_md_';
const STORY_CAMP_PREFIX = 'sw_story_camp_md_';
const STORY_PROTAGONIST_PREFIX = 'sw_story_protagonist_md_';
const HIDDEN_SKILL_KEYS = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'];
const RELATIONSHIP_LEVEL_KEYS = ['friend', 'lover', 'master', 'acolyte', 'companion', 'ally', 'rival', 'community', 'family', 'mentor'];
const CONTENT_INTENSITY_OPTIONS = [
  { id: 'cinematic', name: 'Cinéma', sub: 'Intense mais équilibré', color: 'var(--blue)' },
  { id: 'dark', name: 'Sombre', sub: 'Ambiance dure et tendue', color: 'var(--purple)' },
  { id: 'adult', name: 'Adulte', sub: 'Mature et sans édulcoration', color: 'var(--red)' },
  { id: 'raw', name: 'Brut', sub: 'Très frontal et sans concession', color: 'var(--gold)' }
];
const DASHBOARD_LOCALES = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
  zh: 'zh-CN'
};
const DASHBOARD_COPY = {
  fr: {
    emptyTitle: 'Aucune histoire pour l’instant',
    emptyText: 'Créez votre première histoire et elle apparaîtra ici.',
    statusActive: 'En cours',
    statusDraft: 'Brouillon',
    prologue: 'Prologue',
    noPremise: 'Aucune prémisse enregistrée.',
    open: 'Ouvrir',
    delete: 'Supprimer'
  },
  en: {
    emptyTitle: 'No stories yet',
    emptyText: 'Create your first story and it will appear here.',
    statusActive: 'Active',
    statusDraft: 'Draft',
    prologue: 'Prologue',
    noPremise: 'No premise saved.',
    open: 'Open',
    delete: 'Delete'
  }
};
const choiceSvgCache = new Map();

function getCharacterDisplayName(setup = state.setup) {
  const first = String(setup?.firstName || '').trim();
  const last = String(setup?.lastName || '').trim();
  return [first, last].filter(Boolean).join(' ').trim();
}

function getIntensityConfig(intensityId) {
  return CONTENT_INTENSITY_OPTIONS.find(option => option.id === intensityId) || CONTENT_INTENSITY_OPTIONS[0];
}

function getDashboardCopy(lang = 'fr') {
  return DASHBOARD_COPY[lang] || DASHBOARD_COPY.en;
}

function getDashboardLocale(lang = 'fr') {
  return DASHBOARD_LOCALES[lang] || 'en-US';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function extractNarrativeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(extractNarrativeText).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    const preferredKeys = ['text', 'line', 'dialogue', 'say', 'content', 'message', 'utterance', 'quote', 'speaker', 'name', 'character', 'who'];
    for (const key of preferredKeys) {
      if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
        const extracted = extractNarrativeText(value[key]);
        if (extracted) return extracted;
      }
    }

    return Object.values(value).map(extractNarrativeText).filter(Boolean).join(' ');
  }

  return String(value);
}

function stringifyNarrativeValue(value, key = '') {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(entry => stringifyNarrativeValue(entry, key)).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    const speaker = extractNarrativeText(value.speaker || value.name || value.character || value.who || '');
    const line = extractNarrativeText(value.text || value.line || value.dialogue || value.say || value.content || value.message || value.utterance || value.quote || '');
    if (key === 'dialogue' && (speaker || line)) {
      return speaker ? `${speaker}: ${line}` : String(line);
    }
    return Object.values(value).map(v => stringifyNarrativeValue(v, key)).filter(Boolean).join(' ');
  }

  return String(value);
}

function normalizeSkillKey(rawKey) {
  const key = String(rawKey || '').trim().toLowerCase();
  return HIDDEN_SKILL_KEYS.includes(key) ? key : 'survival';
}

function getSkillProgressKey(storyId) {
  return `${STORY_SKILL_PROGRESS_PREFIX}${storyId}`;
}

function xpNeededForNextLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return 120 + (safeLevel - 1) * 65;
}

function buildDefaultSkillProgress(roleId) {
  const role = resolveRoleConfig(roleId);
  const levels = {};
  const xp = {};
  const multipliers = {};

  for (const key of HIDDEN_SKILL_KEYS) {
    const baseAttr = clamp(Number(role?.attributes?.[key] ?? 45), 0, 100);
    levels[key] = 1;
    xp[key] = 0;
    multipliers[key] = 0.72 + (baseAttr / 100) * 0.68; // intentionally slow growth
  }

  return {
    levels,
    xp,
    multipliers,
    roleId: roleId || null,
    updatedAt: new Date().toISOString()
  };
}

function loadSkillProgress(storyId, roleId) {
  if (!storyId) return buildDefaultSkillProgress(roleId);
  const key = getSkillProgressKey(storyId);
  const raw = localStorage.getItem(key);

  if (!raw) {
    const created = buildDefaultSkillProgress(roleId);
    localStorage.setItem(key, JSON.stringify(created));
    return created;
  }

  try {
    const parsed = JSON.parse(raw);
    const fallback = buildDefaultSkillProgress(roleId);
    return {
      ...fallback,
      ...parsed,
      levels: { ...fallback.levels, ...(parsed.levels || {}) },
      xp: { ...fallback.xp, ...(parsed.xp || {}) },
      multipliers: { ...fallback.multipliers, ...(parsed.multipliers || {}) },
      roleId: parsed.roleId || roleId || null,
      updatedAt: parsed.updatedAt || fallback.updatedAt
    };
  } catch {
    const repaired = buildDefaultSkillProgress(roleId);
    localStorage.setItem(key, JSON.stringify(repaired));
    return repaired;
  }
}

function saveSkillProgress(storyId, progress) {
  if (!storyId || !progress) return;
  localStorage.setItem(getSkillProgressKey(storyId), JSON.stringify({
    ...progress,
    updatedAt: new Date().toISOString()
  }));
}

function summarizeSkillLevels(progress) {
  if (!progress) return '';
  return HIDDEN_SKILL_KEYS
    .map(key => {
      const lvl = Number(progress.levels?.[key] || 1);
      const xp = Number(progress.xp?.[key] || 0);
      const need = xpNeededForNextLevel(lvl);
      return `- ${key}: lvl ${lvl} (${xp}/${need})`;
    })
    .join('\n');
}

function applyHiddenSkillProgress(storyId, roleId, choiceMeta) {
  if (!storyId || !choiceMeta) return null;

  const progress = loadSkillProgress(storyId, roleId);
  const attrKey = normalizeSkillKey(choiceMeta.attribute);
  const diff = clamp(Number(choiceMeta.difficulty || 2), 1, 5);
  const mult = Number(progress.multipliers?.[attrKey] || 1);
  const gain = Math.max(1, Math.round((4 + diff * 2) * mult));

  progress.xp[attrKey] = Number(progress.xp[attrKey] || 0) + gain;

  let levelUps = 0;
  while (progress.xp[attrKey] >= xpNeededForNextLevel(progress.levels[attrKey])) {
    progress.xp[attrKey] -= xpNeededForNextLevel(progress.levels[attrKey]);
    progress.levels[attrKey] += 1;
    levelUps += 1;
  }

  saveSkillProgress(storyId, progress);
  state.hiddenSkillProgress = progress;

  const currentLevel = Number(progress.levels[attrKey] || 1);
  const currentXp = Number(progress.xp[attrKey] || 0);
  const nextXp = xpNeededForNextLevel(currentLevel);

  return { attrKey, gain, levelUps, currentLevel, currentXp, nextXp };
}

function appendSkillProgressMemory(storyId, turnNumber, event, progress) {
  if (!storyId || !event || !progress) return;
  const previous = loadStoryMemory(storyId);
  const summary = summarizeSkillLevels(progress);
  const block = `\n#### Progression cachée — Tour ${turnNumber}\n- Attribut entraîné: ${event.attrKey}\n- XP gagnée: +${event.gain}\n- Niveau actuel: ${event.currentLevel}\n- Progression: ${event.currentXp}/${event.nextXp}${event.levelUps ? `\n- Level up: +${event.levelUps}` : ''}\n\n${summary}\n`;
  saveStoryMemory(storyId, `${previous}${block}`);
  maybeCompressStoryMemory(storyId, state.setup, 'relationships');
}

function appendFactionReputationMemoryTurn(storyId, turnNumber, updates = [], textSource = '') {
  if (!storyId) return;
  const previous = loadStoryMemory(storyId);
  const summary = updates.length
    ? updates.map(update => `- ${resolveFactionConfig(update.faction)?.name || update.faction}: ${update.delta >= 0 ? '+' : ''}${update.delta}${update.reason ? ` — ${update.reason}` : ''}`).join('\n')
    : '- Aucune évolution de réputation.';
  const block = `\n#### Réputation et factions — Tour ${turnNumber}\n- Source: ${textSource || 'story'}\n- Mises à jour:\n${summary}\n`;
  saveStoryMemory(storyId, `${previous}${block}`);
  maybeCompressStoryMemory(storyId, state.setup, 'factions');
}

function appendCampMemoryTurn(storyId, turnNumber, updates = [], textSource = '') {
  if (!storyId) return;
  const previous = loadStoryMemory(storyId);
  const camp = loadCampProfile(storyId, state.setup);
  const summary = updates.length
    ? updates.map(update => `- Moral ${update.morale || camp.morale}, Sécurité ${update.safety || camp.safety}, Ressources ${update.resources || camp.resources}, Équipage ${update.crewCount || (camp.crew || []).length}`).join('\n')
    : `- Base: ${camp.baseName} | Moral ${camp.morale} | Sécurité ${camp.safety} | Ressources ${camp.resources}`;
  const block = `\n#### Camp et équipage — Tour ${turnNumber}\n- Source: ${textSource || 'story'}\n- Mises à jour:\n${summary}\n`;
  saveStoryMemory(storyId, `${previous}${block}`);
  maybeCompressStoryMemory(storyId, state.setup, 'camp');
}

function buildSkillProgressContext(storyId, roleId) {
  const progress = loadSkillProgress(storyId, roleId);
  state.hiddenSkillProgress = progress;
  const lines = summarizeSkillLevels(progress);
  return `NIVEAUX CACHÉS (invisibles pour le joueur, à utiliser pour la cohérence):\n${lines}\nPlus un niveau est élevé, plus le personnage est performant dans cet attribut.`;
}

function getRelationshipProgressKey(storyId) {
  return `${STORY_RELATIONSHIP_PREFIX}${storyId}`;
}

function relationshipXpNeededForNextLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return 160 + (safeLevel - 1) * 75;
}

function normalizeRelationshipType(rawType) {
  const key = String(rawType || '').trim().toLowerCase();
  return RELATIONSHIP_LEVEL_KEYS.includes(key) ? key : 'companion';
}

function normalizeRelationshipName(rawName) {
  return String(rawName || '').trim().replace(/\s+/g, ' ');
}

function buildDefaultRelationshipProgress(setup) {
  const firstName = normalizeRelationshipName(setup?.firstName || 'Protagoniste') || 'Protagoniste';
  const now = new Date().toISOString();
  return {
    links: {
      [firstName.toLowerCase()]: {
        name: firstName,
        type: 'self',
        level: 1,
        xp: 0,
        affinity: 100,
        closeness: 100,
        tags: ['self'],
        introducedAt: now,
        updatedAt: now,
        notes: 'Le personnage principal'
      }
    },
    communities: {},
    updatedAt: now,
    roleId: setup?.role || null
  };
}

function loadRelationshipProgress(storyId, setup) {
  if (!storyId) return buildDefaultRelationshipProgress(setup);
  const key = getRelationshipProgressKey(storyId);
  const raw = localStorage.getItem(key);

  if (!raw) {
    const created = buildDefaultRelationshipProgress(setup);
    localStorage.setItem(key, JSON.stringify(created));
    return created;
  }

  try {
    const parsed = JSON.parse(raw);
    const fallback = buildDefaultRelationshipProgress(setup);
    return {
      ...fallback,
      ...parsed,
      links: { ...fallback.links, ...(parsed.links || {}) },
      communities: { ...fallback.communities, ...(parsed.communities || {}) },
      roleId: parsed.roleId || setup?.role || null,
      updatedAt: parsed.updatedAt || fallback.updatedAt
    };
  } catch {
    const repaired = buildDefaultRelationshipProgress(setup);
    localStorage.setItem(key, JSON.stringify(repaired));
    return repaired;
  }
}

function saveRelationshipProgress(storyId, progress) {
  if (!storyId || !progress) return;
  localStorage.setItem(getRelationshipProgressKey(storyId), JSON.stringify({
    ...progress,
    updatedAt: new Date().toISOString()
  }));
}

function ensureRelationshipEntry(progress, name, type = 'companion') {
  const key = normalizeRelationshipName(name).toLowerCase();
  if (!key) return null;
  const now = new Date().toISOString();
  if (!progress.links[key]) {
    progress.links[key] = {
      name: normalizeRelationshipName(name),
      type: normalizeRelationshipType(type),
      level: 1,
      xp: 0,
      affinity: 0,
      closeness: 0,
      tags: [],
      introducedAt: now,
      updatedAt: now,
      notes: ''
    };
  }
  return progress.links[key];
}

function normalizeRelationshipUpdates(rawUpdates) {
  if (!rawUpdates) return [];
  const list = Array.isArray(rawUpdates) ? rawUpdates : Object.values(rawUpdates);
  return list
    .map(update => {
      if (!update) return null;
      if (typeof update === 'string') {
        const name = normalizeRelationshipName(update);
        return name ? { name, type: 'companion', level_delta: 0, xp_delta: 0, affinity_delta: 0, closeness_delta: 0, notes: '' } : null;
      }
      const name = normalizeRelationshipName(update.name || update.display_name || update.character || update.community || update.label);
      if (!name) return null;
      return {
        name,
        type: normalizeRelationshipType(update.type || update.relationship_type || update.kind || update.role_hint),
        level_delta: Number(update.level_delta ?? update.levelDelta ?? 0) || 0,
        xp_delta: Number(update.xp_delta ?? update.xpDelta ?? 0) || 0,
        affinity_delta: Number(update.affinity_delta ?? update.affinityDelta ?? 0) || 0,
        closeness_delta: Number(update.closeness_delta ?? update.closenessDelta ?? 0) || 0,
        community_name: normalizeRelationshipName(update.community_name || update.group || update.crew || ''),
        member_count: Number(update.member_count ?? update.memberCount ?? 0) || 0,
        members: Array.isArray(update.members) ? update.members : [],
        tags: Array.isArray(update.tags) ? update.tags : [],
        notes: String(update.notes || update.note || '').trim()
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function summarizeRelationshipLinks(progress, maxEntries = 8) {
  if (!progress?.links) return '';
  const entries = Object.values(progress.links)
    .filter(Boolean)
    .filter(entry => entry.type !== 'self')
    .sort((a, b) => {
      const levelDiff = Number(b.level || 1) - Number(a.level || 1);
      if (levelDiff !== 0) return levelDiff;
      return Number(b.affinity || 0) - Number(a.affinity || 0);
    })
    .slice(0, maxEntries);

  if (!entries.length) return '- Aucun lien durable encore établi.';

  return entries.map(entry => {
    const affinity = Number(entry.affinity || 0);
    const affinityLabel = `${affinity >= 0 ? '+' : ''}${affinity}`;
    const tags = Array.isArray(entry.tags) && entry.tags.length ? ` (${entry.tags.join(', ')})` : '';
    return `- ${entry.name} — ${entry.type} niv. ${Number(entry.level || 1)} | affinité ${affinityLabel}${tags}`;
  }).join('\n');
}

function summarizeRelationshipCommunities(progress, maxEntries = 6) {
  if (!progress?.communities) return '';
  const entries = Object.values(progress.communities)
    .filter(Boolean)
    .sort((a, b) => Number(b.level || 1) - Number(a.level || 1))
    .slice(0, maxEntries);

  if (!entries.length) return '- Aucune communauté structurée pour le moment.';

  return entries.map(entry => {
    const members = Array.isArray(entry.members) ? entry.members.length : Number(entry.memberCount || 0);
    const tags = Array.isArray(entry.tags) && entry.tags.length ? ` (${entry.tags.join(', ')})` : '';
    return `- ${entry.name} — niveau ${Number(entry.level || 1)} | membres ${members || '—'}${tags}`;
  }).join('\n');
}

function applyRelationshipUpdates(storyId, setup, updates, source = 'story') {
  if (!storyId || !updates || !updates.length) return [];
  const progress = loadRelationshipProgress(storyId, setup);
  const results = [];

  for (const update of updates) {
    const entry = ensureRelationshipEntry(progress, update.name, update.type);
    if (!entry) continue;

    const now = new Date().toISOString();
    entry.type = normalizeRelationshipType(update.type || entry.type);
    entry.updatedAt = now;
    if (update.notes) entry.notes = entry.notes ? `${entry.notes} | ${update.notes}` : update.notes;
    if (update.tags?.length) {
      entry.tags = Array.from(new Set([...(entry.tags || []), ...update.tags.map(tag => String(tag).trim()).filter(Boolean)]));
    }

    const gainedXp = Math.max(0, Math.round((update.xp_delta || 0) + Math.abs(update.level_delta || 0) * 85 + Math.max(0, update.affinity_delta || 0) * 0.8 + Math.max(0, update.closeness_delta || 0) * 0.5));
    entry.xp = Number(entry.xp || 0) + gainedXp;
    entry.affinity = clamp(Number(entry.affinity || 0) + Number(update.affinity_delta || 0), -100, 100);
    entry.closeness = clamp(Number(entry.closeness || 0) + Number(update.closeness_delta || 0), -100, 100);

    if (update.community_name) {
      const communityKey = update.community_name.toLowerCase();
      if (!progress.communities[communityKey]) {
        progress.communities[communityKey] = {
          name: update.community_name,
          level: 1,
          xp: 0,
          memberCount: 0,
          members: [],
          tags: ['community'],
          introducedAt: now,
          updatedAt: now,
          notes: ''
        };
      }
      const community = progress.communities[communityKey];
      community.memberCount = Math.max(community.memberCount || 0, Number(update.member_count || 0), (community.members || []).length);
      if (update.members?.length) {
        community.members = Array.from(new Set([...(community.members || []), ...update.members.map(member => String(member).trim()).filter(Boolean)]));
        community.memberCount = Math.max(community.memberCount || 0, community.members.length);
      }
      community.xp += gainedXp;
      community.updatedAt = now;
      while (community.xp >= relationshipXpNeededForNextLevel(community.level)) {
        community.xp -= relationshipXpNeededForNextLevel(community.level);
        community.level += 1;
      }
    }

    const levelDelta = Number(update.level_delta || 0);
    if (levelDelta > 0) {
      entry.level = clamp(Number(entry.level || 1) + levelDelta, 1, 10);
      entry.xp = 0;
    } else {
      while (entry.xp >= relationshipXpNeededForNextLevel(entry.level)) {
        entry.xp -= relationshipXpNeededForNextLevel(entry.level);
        entry.level = clamp(Number(entry.level || 1) + 1, 1, 10);
      }
    }

    results.push({
      name: entry.name,
      type: entry.type,
      level: Number(entry.level || 1),
      xp: Number(entry.xp || 0),
      affinity: Number(entry.affinity || 0),
      closeness: Number(entry.closeness || 0),
      community: update.community_name || '',
      source
    });
  }

  saveRelationshipProgress(storyId, progress);
  state.hiddenRelationshipProgress = progress;
  return results;
}

function buildRelationshipContext(storyId, setup, maxChars = 2600) {
  const progress = loadRelationshipProgress(storyId, setup);
  state.hiddenRelationshipProgress = progress;
  const links = summarizeRelationshipLinks(progress);
  const communities = summarizeRelationshipCommunities(progress);

  return `LIENS RELATIONNELS CACHÉS (invisibles pour le joueur, à faire évoluer avec cohérence):
Relations clés:
${links}

Communautés / groupes / cercles:
${communities}

Règles de narration relationnelle:
- Les amis, amants, mentors, maîtres, acolytes, disciples, membres d'équipage et communautés peuvent monter en niveau comme les compétences.
- Chaque interaction marquante doit pouvoir faire progresser, fragiliser ou transformer un lien.
- Un lien de niveau plus élevé change la façon dont les personnages parlent, se protègent, se trahissent ou se suivent.
- Si de nouvelles personnes ou communautés sont créées, ajoute-les naturellement au tissu relationnel.`.slice(0, maxChars);
}

function inferRelationshipSignalsFromText(text) {
  const lower = String(text || '').toLowerCase();
  const signals = [];

  if (/(communaut|cercle|clan|famille|tribu|équipage|crew|groupe|communauté)/i.test(lower)) {
    signals.push({ name: 'Communauté du personnage', type: 'community', level_delta: 0, xp_delta: 26, affinity_delta: 8, closeness_delta: 10, community_name: 'Communauté du personnage', notes: 'Lien collectif ou cercle durable' });
  }
  if (/(acolyte|disciple|apprenti|élève|suiveur|suivants)/i.test(lower)) {
    signals.push({ name: 'Acolytes', type: 'acolyte', level_delta: 0, xp_delta: 22, affinity_delta: 6, closeness_delta: 10, community_name: 'Acolytes du personnage', notes: 'Lien de transmission ou d’obédience' });
  }
  if (/(maître|mentor|gourou|enseignant|guide)/i.test(lower)) {
    signals.push({ name: 'Mentor', type: 'master', level_delta: 0, xp_delta: 20, affinity_delta: 5, closeness_delta: 12, notes: 'Lien d’apprentissage ou d’autorité' });
  }
  if (/(amant|amants|amoureuse|amoureux|couple|tendre|désir|baiser|passion|épous|conjoint)/i.test(lower)) {
    signals.push({ name: 'Lien intime', type: 'lover', level_delta: 0, xp_delta: 30, affinity_delta: 14, closeness_delta: 16, notes: 'Lien romantique ou sensuel' });
  }
  if (/(ami|amie|amis|compagnon|compagne|allié|alliés|soeur|frère|fratrie|escorte|partenaire)/i.test(lower)) {
    signals.push({ name: 'Cercle proche', type: 'friend', level_delta: 0, xp_delta: 18, affinity_delta: 10, closeness_delta: 12, notes: 'Lien d’amitié ou de confiance' });
  }
  if (/(trahir|conflit|rival|ennemi|méfiance|rompre|fuir|abandonner|haine)/i.test(lower)) {
    signals.push({ name: 'Tension relationnelle', type: 'rival', level_delta: 0, xp_delta: 16, affinity_delta: -14, closeness_delta: -12, notes: 'Conflit ou tension durable' });
  }

  return signals;
}

function applyRelationshipProgressFromText(storyId, setup, text, source = 'user') {
  const signals = inferRelationshipSignalsFromText(text);
  if (!signals.length) return [];
  return applyRelationshipUpdates(storyId, setup, signals, source);
}

function appendRelationshipMemoryTurn(storyId, turnNumber, updates = [], textSource = '') {
  if (!storyId) return;
  const previous = loadStoryMemory(storyId);
  const progress = loadRelationshipProgress(storyId, state.setup);
  const relationSummary = summarizeRelationshipLinks(progress);
  const communitySummary = summarizeRelationshipCommunities(progress);
  const updateSummary = updates.length
    ? updates.map(update => `- ${update.name} (${update.type}) niv. ${update.level} | affinité ${update.affinity >= 0 ? '+' : ''}${update.affinity}${update.community ? ` | communauté: ${update.community}` : ''}`).join('\n')
    : '- Aucune mise à jour relationnelle explicite ce tour.';

  const block = `
#### Relations et communautés — Tour ${turnNumber}
- Source: ${textSource || 'story'}
- Mises à jour:
${updateSummary}

##### Liaisons durables
${relationSummary}

##### Communautés
${communitySummary}
`;

  saveStoryMemory(storyId, `${previous}${block}`);
}

function applyChoiceFactionImpacts(storyId, setup, choiceObj, source = 'choice') {
  if (!choiceObj?.faction_impact) return [];
  const updates = Object.entries(choiceObj.faction_impact)
    .map(([faction, delta]) => ({
      faction,
      delta: Number(delta) || 0,
      reason: `Impact du choix: ${String(choiceObj.text || '').slice(0, 80)}`,
      source
    }))
    .filter(update => update.delta !== 0);
  return applyFactionReputationUpdates(storyId, setup, updates, source);
}

function inferCampSignalsFromText(text) {
  const lower = String(text || '').toLowerCase();
  const updates = [];

  if (/(base|camp|refuge|quartier|vaisseau|navire|hangar|poste|auberge|sanctuaire|temple)/i.test(lower)) {
    updates.push({ morale_delta: 4, safety_delta: 6, resources_delta: 2, notes: 'Le texte évoque une structure d’accueil ou de regroupement.' });
  }
  if (/(recrute|rejoint|suit|accompagne|reste|part avec lui|part avec elle|équipage|crew|cercle)/i.test(lower)) {
    updates.push({ morale_delta: 5, safety_delta: 2, crew_delta: 1, notes: 'Des membres s’ajoutent ou s’agrègent autour du protagoniste.' });
  }
  if (/(quitte|déserte|se sépare|fuit|trahi|abandonne)/i.test(lower)) {
    updates.push({ morale_delta: -6, safety_delta: -4, crew_delta: -1, notes: 'Une séparation ou une perte affecte le noyau.' });
  }

  return updates;
}

function applyCampUpdates(storyId, setup, updates = [], source = 'story') {
  if (!storyId || !updates || !updates.length) return [];
  const camp = loadCampProfile(storyId, setup);
  const results = [];

  for (const update of updates) {
    const moraleDelta = Number(update.morale_delta ?? update.moraleDelta ?? 0) || 0;
    const safetyDelta = Number(update.safety_delta ?? update.safetyDelta ?? 0) || 0;
    const resourcesDelta = Number(update.resources_delta ?? update.resourcesDelta ?? 0) || 0;
    const crewDelta = Number(update.crew_delta ?? update.crewDelta ?? 0) || 0;
    camp.morale = clamp(Number(camp.morale || 0) + moraleDelta, 0, 100);
    camp.safety = clamp(Number(camp.safety || 0) + safetyDelta, 0, 100);
    camp.resources = clamp(Number(camp.resources || 0) + resourcesDelta, 0, 100);

    if (Array.isArray(update.crew_additions)) {
      camp.crew = Array.from(new Set([...(camp.crew || []), ...update.crew_additions.map(v => String(v).trim()).filter(Boolean)]));
    }
    if (Array.isArray(update.crew_removals)) {
      const removals = new Set(update.crew_removals.map(v => String(v).trim()).filter(Boolean));
      camp.crew = (camp.crew || []).filter(name => !removals.has(name));
    }
    if (crewDelta > 0) camp.crew.push(...Array.from({ length: crewDelta }, () => 'Membre du groupe').slice(0, crewDelta));
    if (crewDelta < 0) camp.crew = (camp.crew || []).slice(0, Math.max(0, (camp.crew || []).length + crewDelta));
    camp.crew = Array.from(new Set((camp.crew || []).map(name => String(name).trim()).filter(Boolean)));

    if (update.base_name) camp.baseName = String(update.base_name).trim().slice(0, 80) || camp.baseName;
    if (update.notes) camp.notes = camp.notes ? `${camp.notes} | ${update.notes}` : String(update.notes).trim();

    results.push({
      morale: camp.morale,
      safety: camp.safety,
      resources: camp.resources,
      crewCount: camp.crew.length,
      source
    });
  }

  saveCampProfile(storyId, camp);
  state.hiddenCampProfile = camp;
  return results;
}

function buildCampEventFromStory(story) {
  const narrative = story?.narrative || {};
  const combinedText = [narrative.context, narrative.action, narrative.dialogue, narrative.reflection]
    .map(value => stringifyNarrativeValue(value, 'dialogue'))
    .filter(Boolean)
    .join(' ');
  return inferCampSignalsFromText(combinedText);
}

function maybeCompressStoryMemory(storyId, setup, reason = 'auto') {
  const md = loadStoryMemory(storyId);
  if (!md || md.length < 18000) return md;

  const headerMatch = md.match(/^# Trame de l'histoire[\s\S]*?(?=\n### Tour |\n## Journal narratif|\n## Relations et communautés|\n## Progression cachée|$)/i);
  const header = headerMatch ? headerMatch[0].trim() : `# Trame de l'histoire\n\n- ID: ${storyId}\n- Compression: ${reason}`;

  const turnBlocks = md.split(/\n### Tour /i).slice(1).map(block => `### Tour ${block.trim()}`).filter(Boolean);
  const recentTurns = turnBlocks.slice(-4).join('\n\n');
  const relationSection = md.match(/\n#### Relations et communautés[\s\S]*?(?=\n#### Progression cachée|$)/i)?.[0] || '';
  const skillSection = md.match(/\n#### Progression cachée[\s\S]*?(?=$)/i)?.[0] || '';
  const reputationSection = md.match(/\n#### Réputation et factions[\s\S]*?(?=\n#### Camp|$)/i)?.[0] || '';
  const campSection = md.match(/\n#### Camp et équipage[\s\S]*?(?=\n#### Relations|$)/i)?.[0] || '';

  const summary = `\n## Résumé condensé\n- Compression automatique déclenchée (${reason}).\n- Les anciens tours ont été résumés pour garder la mémoire lisible.\n- Les sections vivantes sont conservées: relations, réputation, camp et progression.\n`;
  const compact = [header, summary, reputationSection, campSection, relationSection, skillSection, recentTurns].filter(Boolean).join('\n\n');
  saveStoryMemory(storyId, compact.slice(-24000));
  return compact;
}

function normalizeFactionKey(rawKey) {
  const key = String(rawKey || '').trim().toLowerCase();
  return FACTIONS.some(f => f.id === key) ? key : null;
}

function getFactionReputationKey(storyId) {
  return `${STORY_FACTION_REPUTATION_PREFIX}${storyId}`;
}

function getCampProfileKey(storyId) {
  return `${STORY_CAMP_PREFIX}${storyId}`;
}

function getProtagonistProfileKey(storyId) {
  return `${STORY_PROTAGONIST_PREFIX}${storyId}`;
}

function buildDefaultFactionReputation(setup) {
  const standings = {};
  for (const faction of FACTIONS) standings[faction.id] = 0;
  const setupFaction = normalizeFactionKey(setup?.faction);
  if (setupFaction) standings[setupFaction] = 18;
  return {
    standings,
    notableAllies: [],
    notableEnemies: [],
    updatedAt: new Date().toISOString()
  };
}

function loadFactionReputation(storyId, setup) {
  if (!storyId) return buildDefaultFactionReputation(setup);
  const raw = localStorage.getItem(getFactionReputationKey(storyId));
  if (!raw) {
    const created = buildDefaultFactionReputation(setup);
    localStorage.setItem(getFactionReputationKey(storyId), JSON.stringify(created));
    return created;
  }
  try {
    const parsed = JSON.parse(raw);
    const fallback = buildDefaultFactionReputation(setup);
    return {
      ...fallback,
      ...parsed,
      standings: { ...fallback.standings, ...(parsed.standings || {}) },
      notableAllies: Array.isArray(parsed.notableAllies) ? parsed.notableAllies : [],
      notableEnemies: Array.isArray(parsed.notableEnemies) ? parsed.notableEnemies : []
    };
  } catch {
    const repaired = buildDefaultFactionReputation(setup);
    localStorage.setItem(getFactionReputationKey(storyId), JSON.stringify(repaired));
    return repaired;
  }
}

function saveFactionReputation(storyId, reputation) {
  if (!storyId || !reputation) return;
  localStorage.setItem(getFactionReputationKey(storyId), JSON.stringify({
    ...reputation,
    updatedAt: new Date().toISOString()
  }));
}

function summarizeFactionReputation(reputation) {
  if (!reputation?.standings) return '- Réputation inconnue.';
  return FACTIONS.map(faction => {
    const value = Number(reputation.standings?.[faction.id] || 0);
    const sign = value >= 0 ? '+' : '';
    return `- ${faction.name}: ${sign}${value}`;
  }).join('\n');
}

function applyFactionReputationUpdates(storyId, setup, updates = [], source = 'story') {
  if (!storyId || !updates || !updates.length) return [];
  const reputation = loadFactionReputation(storyId, setup);
  const results = [];

  for (const update of updates) {
    const factionId = normalizeFactionKey(update.faction || update.faction_id || update.id || update.target);
    if (!factionId) continue;
    const delta = Number(update.delta ?? update.change ?? update.value ?? 0);
    const reason = String(update.reason || update.note || update.context || '').trim();
    reputation.standings[factionId] = clamp(Number(reputation.standings[factionId] || 0) + delta, -100, 100);
    if (delta > 0 && !reputation.notableAllies.includes(factionId)) reputation.notableAllies.push(factionId);
    if (delta < 0 && !reputation.notableEnemies.includes(factionId)) reputation.notableEnemies.push(factionId);
    results.push({ faction: factionId, delta, reason, source });
  }

  saveFactionReputation(storyId, reputation);
  state.hiddenFactionReputation = reputation;
  return results;
}

function buildFactionReputationContext(storyId, setup, maxChars = 2400) {
  const reputation = loadFactionReputation(storyId, setup);
  state.hiddenFactionReputation = reputation;
  return `RÉPUTATION ET FACTIONS (cachées, à maintenir cohérentes):\n${summarizeFactionReputation(reputation)}\nRègle: chaque choix important doit laisser une trace mesurable sur les relations inter-factions, l'accès aux ressources, la méfiance ou le soutien.`.slice(0, maxChars);
}

function buildDefaultCampProfile(setup) {
  const roleName = resolveRoleConfig(setup?.role)?.name || setup?.role || 'protagoniste';
  const factionName = resolveFactionConfig(setup?.faction)?.name || setup?.faction || 'indépendant';
  const baseName = `${roleName} — ${factionName}`;
  return {
    baseName,
    type: 'camp',
    morale: 50,
    safety: 45,
    resources: 40,
    crew: [],
    allies: [],
    mentors: [],
    acolytes: [],
    rivals: [],
    notes: '',
    updatedAt: new Date().toISOString()
  };
}

function loadCampProfile(storyId, setup) {
  if (!storyId) return buildDefaultCampProfile(setup);
  const raw = localStorage.getItem(getCampProfileKey(storyId));
  if (!raw) {
    const created = buildDefaultCampProfile(setup);
    localStorage.setItem(getCampProfileKey(storyId), JSON.stringify(created));
    return created;
  }
  try {
    const parsed = JSON.parse(raw);
    const fallback = buildDefaultCampProfile(setup);
    return { ...fallback, ...parsed, crew: Array.isArray(parsed.crew) ? parsed.crew : fallback.crew };
  } catch {
    const repaired = buildDefaultCampProfile(setup);
    localStorage.setItem(getCampProfileKey(storyId), JSON.stringify(repaired));
    return repaired;
  }
}

function saveCampProfile(storyId, profile) {
  if (!storyId || !profile) return;
  localStorage.setItem(getCampProfileKey(storyId), JSON.stringify({
    ...profile,
    updatedAt: new Date().toISOString()
  }));
}

function buildCampContext(storyId, setup, maxChars = 2200) {
  const camp = loadCampProfile(storyId, setup);
  state.hiddenCampProfile = camp;
  return `CAMPEMENT / BASE / ÉQUIPAGE (stable, évolutif):\n- Base: ${camp.baseName}\n- Type: ${camp.type}\n- Moral: ${camp.morale}/100\n- Sécurité: ${camp.safety}/100\n- Ressources: ${camp.resources}/100\n- Crew: ${(camp.crew || []).join(', ') || 'aucun'}\nRègle: ce noyau relationnel doit évoluer organiquement (recrues, départs, maîtres, disciples, famille, amants, escales, refuge).`.slice(0, maxChars);
}

function buildDefaultProtagonistProfile(setup) {
  const role = resolveRoleConfig(setup?.role);
  return {
    name: String(setup?.firstName || 'Personnage').trim() || 'Personnage',
    roleId: setup?.role || null,
    tone: role?.description || 'Déterminé',
    values: [role?.name || 'survie'],
    fears: [],
    habits: [],
    speechStyle: setup?.language ? getLanguageConfig(setup.language).promptName : 'French',
    updatedAt: new Date().toISOString()
  };
}

function loadProtagonistProfile(storyId, setup) {
  if (!storyId) return buildDefaultProtagonistProfile(setup);
  const raw = localStorage.getItem(getProtagonistProfileKey(storyId));
  if (!raw) {
    const created = buildDefaultProtagonistProfile(setup);
    localStorage.setItem(getProtagonistProfileKey(storyId), JSON.stringify(created));
    return created;
  }
  try {
    const parsed = JSON.parse(raw);
    const fallback = buildDefaultProtagonistProfile(setup);
    return { ...fallback, ...parsed, values: Array.isArray(parsed.values) ? parsed.values : fallback.values, fears: Array.isArray(parsed.fears) ? parsed.fears : fallback.fears, habits: Array.isArray(parsed.habits) ? parsed.habits : fallback.habits };
  } catch {
    const repaired = buildDefaultProtagonistProfile(setup);
    localStorage.setItem(getProtagonistProfileKey(storyId), JSON.stringify(repaired));
    return repaired;
  }
}

function saveProtagonistProfile(storyId, profile) {
  if (!storyId || !profile) return;
  localStorage.setItem(getProtagonistProfileKey(storyId), JSON.stringify({
    ...profile,
    updatedAt: new Date().toISOString()
  }));
}

function buildProtagonistContext(storyId, setup, maxChars = 1800) {
  const profile = loadProtagonistProfile(storyId, setup);
  state.hiddenProtagonistProfile = profile;
  return `PROTAGONISTE (stabilité psychologique et voix):\n- Nom: ${profile.name}\n- Rôle: ${resolveRoleConfig(profile.roleId)?.name || profile.roleId || '—'}\n- Ton: ${profile.tone}\n- Valeurs: ${(profile.values || []).join(', ') || '—'}\n- Peurs: ${(profile.fears || []).join(', ') || '—'}\n- Habitudes: ${(profile.habits || []).join(', ') || '—'}\nRègle: la personnalité reste cohérente; les changements doivent être progressifs et justifiés par de vrais événements.`.slice(0, maxChars);
}

function inferProtagonistSignalsFromText(text) {
  const lower = String(text || '').toLowerCase();
  const updates = {};

  if (/(protège|sauve|aide|console|soigne|rassure|encadre)/i.test(lower)) {
    updates.values = ['protection', 'responsabilité'];
    updates.tone = 'nurturing';
  }
  if (/(méfiance|parano|traqué|craint|fuit|cache)/i.test(lower)) {
    updates.tone = 'paranoid';
    updates.fears = ['trahison', 'capture'];
  }
  if (/(détermin|résolu|persévère|tient bon|ne cède pas)/i.test(lower)) {
    updates.tone = 'determined';
  }
  if (/(humilie|rage|furieux|colère|explose)/i.test(lower)) {
    updates.tone = 'angry';
  }
  return updates;
}

function applyProtagonistState(storyId, setup, patch = {}, source = 'story') {
  if (!storyId) return null;
  const profile = loadProtagonistProfile(storyId, setup);
  if (patch.tone) profile.tone = String(patch.tone).trim().slice(0, 40) || profile.tone;
  if (Array.isArray(patch.values) && patch.values.length) {
    profile.values = Array.from(new Set([...(profile.values || []), ...patch.values.map(v => String(v).trim()).filter(Boolean)])).slice(0, 10);
  }
  if (Array.isArray(patch.fears) && patch.fears.length) {
    profile.fears = Array.from(new Set([...(profile.fears || []), ...patch.fears.map(v => String(v).trim()).filter(Boolean)])).slice(0, 10);
  }
  if (Array.isArray(patch.habits) && patch.habits.length) {
    profile.habits = Array.from(new Set([...(profile.habits || []), ...patch.habits.map(v => String(v).trim()).filter(Boolean)])).slice(0, 10);
  }
  if (patch.notes) profile.notes = profile.notes ? `${profile.notes} | ${patch.notes}` : String(patch.notes).trim();
  profile.updatedAt = new Date().toISOString();
  saveProtagonistProfile(storyId, profile);
  state.hiddenProtagonistProfile = profile;
  return { ...profile, source };
}

function getRoleAttributeValue(roleId, attrKey) {
  const role = resolveRoleConfig(roleId);
  return clamp(Number(role?.attributes?.[attrKey] ?? 35), 0, 100);
}

function inferAttributeFromActionText(text) {
  const lower = String(text || '').toLowerCase();

  if (/(hacker|pirat|terminal|dro[iï]de|syst[eè]me|code|ing[ée]nier|tech)/i.test(lower)) return 'tech';
  if (/(infiltr|furtif|discret|camouf|ombre|espion|sabotage silencieux)/i.test(lower)) return 'stealth';
  if (/(n[ée]goci|convain|diploma|discours|parley|parlement|otage)/i.test(lower)) return 'diplomacy';
  if (/(force|jedi|sith|t[ée]l[ée]kin|clairvoyance|mind trick)/i.test(lower)) return 'force';
  if (/(surviv|fuir|endurer|ration|abri|soin|m[ée]dec|terrain hostile)/i.test(lower)) return 'survival';
  if (/(tuer|abattre|massacr|fusill|duel|combat|ex[ée]cut|assaut|grenade|blaster)/i.test(lower)) return 'combat';

  return 'survival';
}

function estimateActionDifficulty(text) {
  const lower = String(text || '').toLowerCase();
  let difficulty = 2;

  const numberMatch = lower.match(/\b(\d{1,3})\b/);
  const amount = numberMatch ? Number(numberMatch[1]) : 0;
  if (amount >= 5) difficulty += 1;
  if (amount >= 20) difficulty += 1;

  if (/(seul|solo|sans aide|sans renfort|sans exp[ée]rience|impossible|suicidaire)/i.test(lower)) difficulty += 1;
  if (/(destroyer|base militaire|forteresse|escadron|bataillon|garnison|flotte)/i.test(lower)) difficulty += 1;

  return clamp(difficulty, 1, 5);
}

function assessUserActionBalance(actionText, roleId, progress = null) {
  const attrKey = inferAttributeFromActionText(actionText);
  const difficulty = estimateActionDifficulty(actionText);
  const roleAttr = getRoleAttributeValue(roleId, attrKey);
  const hiddenLevel = Number(progress?.levels?.[attrKey] || 1);
  const effectivePower = roleAttr + (hiddenLevel - 1) * 6;

  let abuseScore = 0;
  const reasons = [];

  const killsMatch = String(actionText || '').match(/(?:tuer|abattre|massacrer|ex[ée]cuter|[ée]liminer|neutraliser)\s+(\d{1,3})/i);
  if (killsMatch) {
    const kills = Number(killsMatch[1]);
    const maxCredibleKills = Math.max(1, Math.floor((effectivePower + 20) / (difficulty * 14)));
    if (kills > maxCredibleKills) {
      abuseScore += 2;
      reasons.push(`l'action vise ${kills} cibles, ce qui dépasse la capacité plausible (${maxCredibleKills}) pour ce profil`);
    }
  }

  if (/(seul|solo|sans aide|sans exp[ée]rience)/i.test(String(actionText || '')) && effectivePower < 60) {
    abuseScore += 1;
    reasons.push('l’action est tentée sans soutien avec une maîtrise encore limitée');
  }

  if (/(d[ée]truire|capturer|infiltrer|pirater).*(base|forteresse|destroyer|flotte|garnison)/i.test(String(actionText || '')) && effectivePower < 65) {
    abuseScore += 1;
    reasons.push('l’objectif stratégique est trop ambitieux au vu du niveau actuel');
  }

  return {
    attrKey,
    difficulty,
    effectivePower,
    isAbusive: abuseScore >= 2,
    reasons
  };
}

function buildUserVersionConstraint(assessment, setup) {
  const roleName = resolveRoleConfig(setup?.role)?.name || setup?.role || 'personnage';
  const reasonLine = assessment.reasons?.length
    ? `Points d'alerte: ${assessment.reasons.join(' ; ')}`
    : 'Aucun abus majeur détecté.';

  if (assessment.isAbusive) {
    return `\nCONTRAINTE DE RÉALISME (OBLIGATOIRE):\n- Le joueur tente une action disproportionnée pour un ${roleName}.\n- Ne refuse pas l'action: transforme-la en tentative crédible avec résultat partiel, contre-coup, blessure, fuite, perte de ressources ou conséquence politique.\n- L'histoire DOIT avancer malgré l'échec partiel.\n- ${reasonLine}`;
  }

  return `\nCONTRAINTE DE RÉALISME (OBLIGATOIRE):\n- Action plausible pour ce profil (${roleName}), résous-la avec des conséquences concrètes.\n- Évite les succès absurdes instantanés.\n- ${reasonLine}`;
}

function getStoryMemoryKey(storyId) {
  return `${STORY_MEMORY_PREFIX}${storyId}`;
}

function loadStoryMemory(storyId) {
  if (!storyId) return '';
  return localStorage.getItem(getStoryMemoryKey(storyId)) || '';
}

function saveStoryMemory(storyId, markdown) {
  if (!storyId) return;
  localStorage.setItem(getStoryMemoryKey(storyId), markdown || '');
}

function initializeStoryMemory(storyId, setup) {
  if (!storyId) return;
  if (loadStoryMemory(storyId)) return;
  const now = new Date().toISOString();
  const era = ERAS.find(e => e.id === setup.era)?.name || setup.era || '—';
  const faction = FACTIONS.find(f => f.id === setup.faction)?.name || setup.faction || '—';
  const role = ROLES.find(r => r.id === setup.role)?.name || setup.role || '—';
  const premise = PREMISES.find(p => p.id === setup.premise)?.name || setup.premise || '—';
  const md = `# Trame de l'histoire\n\n- ID: ${storyId}\n- Date: ${now}\n- Prénom: ${setup.firstName || '—'}\n- Ère: ${era}\n- Faction: ${faction}\n- Rôle: ${role}\n- Prémisse: ${premise}\n\n## Journal narratif\n\n## Relations et communautés\n\n## Progression cachée\n`;
  saveStoryMemory(storyId, md);
}

function appendStoryMemoryTurn(storyId, turnNumber, story, userMessage) {
  if (!storyId || !story) return;
  const previous = loadStoryMemory(storyId);
  const narrative = story?.narrative || {};
  const choiceLines = (story.choices || []).slice(0, 4).map((c, idx) => `  ${idx + 1}. ${c?.text || ''}`).join('\n');
  const block = `\n### Tour ${turnNumber} — ${story.chapter_title || 'Chapitre'}\n- Instruction joueur: ${String(userMessage || '').slice(0, 320)}\n- Action: ${String(narrative.action || '').slice(0, 900)}\n${narrative.context ? `- Contexte: ${String(narrative.context).slice(0, 400)}\n` : ''}${narrative.dialogue ? `- Dialogue: ${stringifyNarrativeValue(narrative.dialogue, 'dialogue').slice(0, 400)}\n` : ''}${narrative.reflection ? `- Réflexion: ${String(narrative.reflection).slice(0, 400)}\n` : ''}${choiceLines ? `- Choix proposés:\n${choiceLines}\n` : ''}`;
  const merged = `${previous}${block}`;
  saveStoryMemory(storyId, merged);
  maybeCompressStoryMemory(storyId, state.setup, 'narrative');
}

function buildStoryMemoryContext(storyId, maxChars = 7000) {
  const md = loadStoryMemory(storyId);
  if (!md) return '';
  const compact = md.length > maxChars ? md.slice(-maxChars) : md;
  return compact;
}

function getChoiceSvgKey(svgRef) {
  if (!svgRef) return '';
  const trimmed = String(svgRef).trim();
  if (!trimmed || trimmed.startsWith('<svg')) return '';
  return new URL(trimmed.replace(/^\/+/, ''), document.baseURI).href;
}

function stylizeChoiceSvg(markup) {
  return markup
    .replace(/<svg\b([^>]*)>/i, (match, attrs) => {
      let next = attrs;
      if (!/viewBox=/i.test(next)) next = `${next} viewBox="0 0 24 24"`;
      if (!/preserveAspectRatio=/i.test(next)) next = `${next} preserveAspectRatio="xMidYMid meet"`;
      if (/\sclass="[^"]*"/i.test(next)) {
        next = next.replace(/\sclass="([^"]*)"/i, (m, cls) => {
          const classes = cls.split(/\s+/).filter(Boolean);
          if (!classes.includes('choice-svg')) classes.push('choice-svg');
          return ` class="${classes.join(' ')}"`;
        });
      } else {
        next = `${next} class="choice-svg"`;
      }
      return `<svg${next}>`;
    })
    .replace(/\sfill="(?!none)[^"]*"/gi, ' fill="currentColor"')
    .replace(/\sstroke="(?!none)[^"]*"/gi, ' stroke="currentColor"')
    .replace(/\sstyle="[^"]*"/gi, '');
}

async function preloadChoiceSvgs() {
  const refs = [
    ...ERAS,
    ...FACTIONS,
    ...ROLES,
    ...PREMISES
  ]
    .map(item => item.svg)
    .filter(svg => typeof svg === 'string' && svg.trim() && !svg.trim().startsWith('<svg'));

  await Promise.all([...new Set(refs)].map(async ref => {
    const url = getChoiceSvgKey(ref);
    if (!url || choiceSvgCache.has(url)) return;
    const res = await fetch(url);
    if (!res.ok) return;
    const text = await res.text();
    choiceSvgCache.set(url, stylizeChoiceSvg(text));
  }));
}

function renderChoiceIcon(svgRef, className = 'choice-mask') {
  if (!svgRef) return '';
  const trimmed = String(svgRef).trim();
  if (trimmed.startsWith('<svg')) return trimmed;
  const normalized = getChoiceSvgKey(trimmed);
  if (normalized && choiceSvgCache.has(normalized)) {
    return choiceSvgCache.get(normalized);
  }
  const classes = ['choice-svg'];
  if (className && className !== 'choice-mask') {
    classes.push(className);
  }
  return `<img class="${classes.join(' ')}" src="${normalized}" alt="" aria-hidden="true" loading="lazy" decoding="async" />`;
}

function resolveRoleConfig(roleId) {
  if (typeof window.getRoleConfig === 'function') return window.getRoleConfig(roleId);
  return ROLES.find(role => role.id === roleId) || null;
}

function resolveFactionConfig(factionId) {
  if (typeof window.getFactionConfig === 'function') return window.getFactionConfig(factionId);
  return FACTIONS.find(faction => faction.id === factionId) || null;
}

function resolveBuildSystemPrompt(languageId) {
  if (typeof window.buildSystemPrompt === 'function') return window.buildSystemPrompt(languageId);
  const language = LANGUAGES.find(l => l.id === languageId) || LANGUAGES[0] || { promptName: 'French' };
  return `LANGUE DE SORTIE:\n- Rédige tout le contenu textuel du JSON en ${language.promptName}.\n- Garde "scene_description" en anglais pour la génération d'image.\n\nTu es un maître narrateur de l'univers Star Wars. Réponds uniquement avec un objet JSON valide conforme à la structure attendue.`;
}

function resolveBuildStartMessage(setup) {
  if (typeof window.buildStartMessage === 'function') return window.buildStartMessage(setup);
  const firstName = String(setup.displayName || setup.firstName || '').trim() || 'Personnage';
  const era = ERAS.find(e => e.id === setup.era)?.name || setup.era || 'Histoire Star Wars';
  const faction = FACTIONS.find(f => f.id === setup.faction)?.name || setup.faction || '';
  const role = ROLES.find(r => r.id === setup.role)?.name || setup.role || '';
  const premise = PREMISES.find(p => p.id === setup.premise)?.name || setup.premise || '';
  const intensity = getIntensityConfig(setup.contentIntensity || 'cinematic').name;
  return `Commence une histoire interactive Star Wars avec ces paramètres:\n- Nom du personnage: ${firstName}\n- Ère: ${era}\n- Faction: ${faction}\n- Rôle: ${role}\n- Prémisse: ${premise}\n- Intensité narrative: ${intensity}\n\nLe personnage principal s'appelle ${firstName}.\nGénère le prologue de l'histoire en ${LANGUAGES.find(l => l.id === setup.language)?.promptName || 'French'}. Réponds avec le JSON attendu.`;
}

function resolveBuildContinueMessage(choiceText, turnNumber, languageId, setup, userEdits = []) {
  if (typeof window.buildContinueMessage === 'function') return window.buildContinueMessage(choiceText, turnNumber, languageId, setup, userEdits);
  const language = LANGUAGES.find(l => l.id === languageId) || LANGUAGES[0] || { promptName: 'French' };
  const intensity = getIntensityConfig(setup?.contentIntensity || 'cinematic').name;
  return `Tour ${turnNumber} — Le joueur choisit: "${choiceText}"\n\nContinue l'histoire en ${language.promptName} en tenant compte de ce choix. Les conséquences doivent être visibles et significatives. Intensité narrative: ${intensity}.`;
}

function resolveParseStoryResponse(raw, turnNumber, languageId) {
  if (typeof window.parseStoryResponse === 'function') return window.parseStoryResponse(raw, turnNumber, languageId);

  let cleaned = String(raw || '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];

  try {
    const parsed = JSON.parse(cleaned);
    return {
      chapter_title: parsed.chapter_title || 'L\'aventure continue',
      chapter_number: parsed.chapter_number || turnNumber || 1,
      section_type: parsed.section_type || 'action',
      narrative: typeof parsed.narrative === 'string'
        ? { context: parsed.narrative.substring(0, 300), action: parsed.narrative, dialogue: '', reflection: '', blocks: [{ type: 'action', text: parsed.narrative.substring(0, 1200), order: 0 }], atmosphere: 'tense' }
        : {
            context: parsed.narrative?.context || '',
            action: parsed.narrative?.action || '',
            dialogue: parsed.narrative?.dialogue || '',
            reflection: parsed.narrative?.reflection || '',
            blocks: Array.isArray(parsed.narrative?.blocks) ? parsed.narrative.blocks : (Array.isArray(parsed.blocks) ? parsed.blocks : []),
            atmosphere: parsed.narrative?.atmosphere || 'tense'
          },
      choices: Array.isArray(parsed.choices) ? parsed.choices.slice(0, 4) : [],
      scene_description: parsed.scene_description || 'Epic Star Wars cinematic scene with dramatic lighting',
      user_edits_applied: parsed.user_edits_applied || null
    };
  } catch {
    return {
      chapter_title: 'L\'aventure continue',
      chapter_number: turnNumber || 1,
      section_type: 'action',
      narrative: { context: cleaned.substring(0, 300), action: cleaned, dialogue: '', reflection: '', blocks: [{ type: 'action', text: cleaned.substring(0, 1200), order: 0 }], atmosphere: 'tense' },
      choices: [],
      scene_description: 'Epic Star Wars cinematic scene with dramatic lighting',
      user_edits_applied: null
    };
  }
}

function resolveFormatNarrative(story) {
  if (typeof window.formatNarrative === 'function') return window.formatNarrative(story);

  const escapeHtmlLocal = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const extractNarrativeText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      return value.map(extractNarrativeText).filter(Boolean).join('\n');
    }

    if (typeof value === 'object') {
      const preferredKeys = ['text', 'line', 'dialogue', 'say', 'content', 'message', 'utterance', 'quote', 'speaker', 'name', 'character', 'who'];
      for (const key of preferredKeys) {
        if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
          const extracted = extractNarrativeText(value[key]);
          if (extracted) return extracted;
        }
      }

      return Object.values(value).map(extractNarrativeText).filter(Boolean).join(' ');
    }

    return String(value);
  };

  const stringifyNarrativeValue = (value, key = '') => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      return value.map(entry => stringifyNarrativeValue(entry, key)).filter(Boolean).join('\n');
    }

    if (typeof value === 'object') {
      const speaker = extractNarrativeText(value.speaker || value.name || value.character || value.who || '');
      const line = extractNarrativeText(value.text || value.line || value.dialogue || value.say || value.content || value.message || value.utterance || value.quote || '');
      if (key === 'dialogue' && (speaker || line)) {
        return speaker ? `${speaker}: ${line}` : String(line);
      }
      return Object.values(value).map(v => stringifyNarrativeValue(v, key)).filter(Boolean).join(' ');
    }

    return String(value);
  };

  const normalizeNarrativeBlockType = (rawType) => {
    const type = String(rawType || '').trim().toLowerCase();
    if (['context', 'action', 'dialogue', 'reflection'].includes(type)) return type;
    if (type === 'narration' || type === 'narrative') return 'action';
    return type || 'action';
  };

  const renderNarrativeBlockText = (block, type) => {
    if (block === null || block === undefined) return '';
    if (typeof block === 'string' || typeof block === 'number' || typeof block === 'boolean') return String(block).trim();

    if (Array.isArray(block)) {
      return block.map(item => renderNarrativeBlockText(item, type)).filter(Boolean).join('\n');
    }

    if (typeof block === 'object') {
      const speaker = extractNarrativeText(block.speaker || block.name || block.character || block.who || '');
      const text = extractNarrativeText(block.text || block.content || block.value || block.line || block.dialogue || block.action || block.context || block.reflection || '');
      if ((type === 'dialogue' || speaker) && (speaker || text)) {
        return speaker ? `${speaker}: ${text}` : text;
      }
      return text || extractNarrativeText(block);
    }

    return String(block).trim();
  };

  const normalizeNarrativeBlocks = (narrative) => {
    const rawBlocks = Array.isArray(narrative?.blocks) ? narrative.blocks : [];
    if (rawBlocks.length) {
      return rawBlocks
        .map((block, index) => ({
          type: normalizeNarrativeBlockType(block?.type || block?.kind || block?.section_type || block?.section || block?.role),
          text: renderNarrativeBlockText(block, normalizeNarrativeBlockType(block?.type || block?.kind || block?.section_type || block?.section || block?.role)),
          speaker: extractNarrativeText(block?.speaker || block?.name || block?.character || block?.who || ''),
          order: Number.isFinite(Number(block?.order)) ? Number(block.order) : index
        }))
        .filter(block => block.text)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const fallbackBlocks = [];
    const sectionOrder = [
      ['context', narrative?.context],
      ['dialogue', narrative?.dialogue],
      ['action', narrative?.action],
      ['reflection', narrative?.reflection]
    ];
    sectionOrder.forEach(([type, value], index) => {
      const text = renderNarrativeBlockText(value, type).trim();
      if (text) fallbackBlocks.push({ type, text, order: index });
    });
    return fallbackBlocks;
  };

  const narrative = story?.narrative || {};
  const narrativeBlocks = normalizeNarrativeBlocks(narrative);
  const sections = narrativeBlocks.length
    ? narrativeBlocks.map(block => ({
        key: block.type,
        label: t(block.type, state.uiLang) || block.type.charAt(0).toUpperCase() + block.type.slice(1),
        value: block
      }))
    : [
        { key: 'context', label: t('context', state.uiLang) || 'Contexte', value: narrative.context },
        { key: 'action', label: t('action', state.uiLang) || 'Action', value: narrative.action },
        { key: 'dialogue', label: t('dialogue', state.uiLang) || 'Dialogue', value: narrative.dialogue },
        { key: 'reflection', label: t('reflection', state.uiLang) || 'Réflexion', value: narrative.reflection }
      ];

  const htmlSections = sections
    .map(section => {
      const text = section.value?.text !== undefined
        ? String(section.value.text || '').trim()
        : stringifyNarrativeValue(section.value, section.key).trim();
      if (!text) return '';
      const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
      if (!lines.length) return '';
      const content = lines.map(line => `<p>${escapeHtmlLocal(line)}</p>`).join('');
      return `<div class="narrative-section ${section.key}"><span class="section-label">${escapeHtmlLocal(section.label)}</span>${content}</div>`;
    })
    .filter(Boolean)
    .join('');

  return `<div class="narrative-container">${htmlSections || '<div class="narrative-section action"><p>...</p></div>'}</div>`;
}

function captureStorySessionSnapshot() {
  return {
    turn: Number(state.turn || 0),
    currentChapter: state.currentChapter ? { ...state.currentChapter } : null,
    messages: Array.isArray(state.messages) ? state.messages.slice(-30) : [],
    userEdits: Array.isArray(state.userEdits) ? state.userEdits.slice(-20) : []
  };
}

async function openSavedStory(story) {
  if (!story?.id) return;

  state.currentStoryId = story.id;
  state.provider = story.provider || state.provider;
  state.model = story.model || state.model;
  state.imgProvider = story.imgProvider || state.imgProvider;
  state.imgModel = story.imgModel || state.imgModel;

  const restoredSetup = {
    language: state.uiLang,
    firstName: '',
    lastName: '',
    era: null,
    faction: null,
    role: null,
    premise: null,
    contentIntensity: 'cinematic',
    ...(story.setup || {})
  };
  restoredSetup.displayName = String(restoredSetup.displayName || getCharacterDisplayName(restoredSetup) || restoredSetup.firstName || 'Personnage').trim();
  state.setup = restoredSetup;

  state.turn = Number(story.turn || 0);
  state.userEdits = Array.isArray(story.userEdits) ? story.userEdits : [];
  state.messages = Array.isArray(story.messages) && story.messages.length
    ? story.messages
    : [{ role: 'system', content: resolveBuildSystemPrompt(state.setup.language || state.uiLang) }];
  state.currentChapter = story.currentChapter || null;

  state.hiddenSkillProgress = loadSkillProgress(state.currentStoryId, state.setup.role);
  state.hiddenRelationshipProgress = loadRelationshipProgress(state.currentStoryId, state.setup);
  state.hiddenFactionReputation = loadFactionReputation(state.currentStoryId, state.setup);
  state.hiddenCampProfile = loadCampProfile(state.currentStoryId, state.setup);
  state.hiddenProtagonistProfile = loadProtagonistProfile(state.currentStoryId, state.setup);

  if (!state.currentChapter) {
    renderSetupScreens();
    checkSetupComplete();
    goTo('screen-identity');
    return;
  }

  goTo('screen-story');
  document.getElementById('story-chapter-title').textContent = state.currentChapter.chapter_title || story.chapterTitle || 'Prologue';
  document.getElementById('story-turn-counter').textContent = `${t('turn', state.uiLang)} ${Math.max(1, state.turn)}`;

  showLoading(false);
  clearNarrative();
  await typeNarrative(resolveFormatNarrative(state.currentChapter));
  renderChoicesWithAttributes(Array.isArray(state.currentChapter.choices) ? state.currentChapter.choices : []);
  setChoicesEnabled(true);
  showCollaborativePanel();
  document.getElementById('story-image-container')?.classList.add('hidden');
}

function getSavedStories() {
  try {
    return JSON.parse(localStorage.getItem(STORY_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistSavedStories(stories) {
  localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(stories));
}

function buildStoryTitle(setup) {
  const era = ERAS.find(e => e.id === setup.era)?.name || setup.era || 'Histoire Star Wars';
  const faction = FACTIONS.find(f => f.id === setup.faction)?.name || setup.faction || '';
  const role = ROLES.find(r => r.id === setup.role)?.name || setup.role || '';
  return [setup.firstName || '', era, faction, role].filter(Boolean).join(' · ');
}

function upsertSavedStory(patch) {
  const now = new Date().toISOString();
  const stories = getSavedStories();
  const existingIndex = stories.findIndex(story => story.id === patch.id);
  const existing = existingIndex >= 0 ? stories[existingIndex] : null;
  const story = {
    id: patch.id || existing?.id || crypto.randomUUID(),
    title: patch.title ?? existing?.title ?? 'Nouvelle histoire',
    summary: patch.summary ?? existing?.summary ?? '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    status: patch.status ?? existing?.status ?? 'draft',
    chapterTitle: patch.chapterTitle ?? existing?.chapterTitle ?? 'Prologue',
    setup: patch.setup ?? existing?.setup ?? state.setup,
    provider: patch.provider ?? existing?.provider ?? state.provider,
    model: patch.model ?? existing?.model ?? state.model,
    imgProvider: patch.imgProvider ?? existing?.imgProvider ?? state.imgProvider,
    imgModel: patch.imgModel ?? existing?.imgModel ?? state.imgModel
  };

  if (existingIndex >= 0) {
    stories[existingIndex] = story;
  } else {
    stories.unshift(story);
  }

  persistSavedStories(stories);
  return story;
}

function deleteSavedStory(id) {
  const stories = getSavedStories().filter(story => story.id !== id);
  persistSavedStories(stories);
  if (state.currentStoryId === id) {
    state.currentStoryId = null;
  }
  renderDashboard();
}

function resetStorySetup() {
  state.setup = {
    language: null,
    firstName: '',
    lastName: '',
    era: null,
    faction: null,
    role: null,
    premise: null,
    contentIntensity: 'cinematic'
  };
  state.currentChapter = null;
  state.turn = 0;
  state.userEdits = [];
  state.currentStoryId = null;

  document.querySelectorAll('.choice-card.selected').forEach(el => el.classList.remove('selected'));
  checkSetupComplete();
  renderSetupScreens();
}

function renderDashboard() {
  const grid = document.getElementById('dashboard-story-grid');
  const count = document.getElementById('dashboard-story-count');
  const modelLabel = document.getElementById('dashboard-model-label');
  if (!grid || !count) return;

  const copy = getDashboardCopy(state.uiLang);
  const locale = getDashboardLocale(state.uiLang);

  const stories = getSavedStories().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  count.textContent = `${stories.length}`;
  if (modelLabel) {
    modelLabel.textContent = state.model || localStorage.getItem(LAST_MODEL_KEY) || '—';
  }
  grid.innerHTML = '';

  if (!stories.length) {
    grid.innerHTML = `
      <div class="dashboard-empty">
        <h3>${copy.emptyTitle}</h3>
        <p>${copy.emptyText}</p>
      </div>
    `;
    return;
  }

  stories.forEach(story => {
    const card = document.createElement('article');
    card.className = 'dashboard-story-card';
    card.dataset.id = story.id;
    card.innerHTML = `
      <div class="dashboard-story-body">
        <div class="dashboard-story-topline">
          <h3>${story.title}</h3>
          <span class="dashboard-story-status ${story.status}">${story.status === 'active' ? copy.statusActive : copy.statusDraft}</span>
        </div>
        <p>${story.summary || story.setup?.premise || copy.noPremise}</p>
        <div class="dashboard-story-meta">
          <span>${story.chapterTitle || copy.prologue}</span>
          <span>${new Date(story.updatedAt).toLocaleDateString(locale)}</span>
        </div>
      </div>
      <div class="dashboard-story-actions">
        <button class="sw-btn secondary dashboard-open-story" data-action="open">${copy.open}</button>
        <button class="sw-btn ghost dashboard-delete-story" data-action="delete">${copy.delete}</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function openTextModelSelectorFromDashboard() {
  state.dashboardModelEdit = false;
  const rememberedProvider = state.provider || localStorage.getItem(LAST_PROVIDER_KEY);
  if (!rememberedProvider || !LLM_PROVIDERS[rememberedProvider]) {
    alert('Choisis d’abord un fournisseur IA.');
    goTo('screen-api');
    return;
  }

  state.provider = rememberedProvider;
  const rememberedKey = localStorage.getItem(`sw_key_${state.provider}`);
  if (!rememberedKey) {
    alert('Aucune clé API mémorisée pour ce fournisseur.');
    goTo('screen-api');
    return;
  }

  state.apiKey = rememberedKey;
  state.dashboardModelEdit = true;

  selectProvider(state.provider);
  await populateModels();

  const rememberedModel = state.model || localStorage.getItem(LAST_MODEL_KEY);
  if (rememberedModel) {
    const existingModel = Array.from(document.querySelectorAll('#model-list .model-item'))
      .find(item => item.dataset.id === rememberedModel);
    existingModel?.click();
  }

  goTo('screen-model');
}

/* ─── UI LANGUAGE SYSTEM ─────────────────────── */
function switchUILanguage(langId) {
  state.uiLang = langId;
  localStorage.setItem('sw_ui_lang', langId);
  window.__UI_LANG__ = langId;

  // Update all UI text elements
  updateAllUIText();

  // Update language selector UI
  updateLanguageSelector();

  // Refresh dashboard labels/content in the new language
  renderDashboard();

  // Update document lang attribute
  document.documentElement.lang = langId;
}

function updateAllUIText() {
  const lang = state.uiLang;

  // Update elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' && el.placeholder) {
      el.placeholder = t(key, lang);
    } else if (el.tagName === 'BUTTON' || el.tagName === 'SPAN') {
      el.textContent = t(key, lang);
    } else {
      el.textContent = t(key, lang);
    }
  });

  // Update specific elements by ID
  const elementsToUpdate = {
    'provider-name-label': { attr: 'textContent', key: 'apiKeyLabel' },
    'btn-test-api-text': { attr: 'textContent', key: 'testContinue' },
    'api-error-text': { attr: 'textContent', key: 'aiError' },
    'model-search-placeholder': { attr: 'placeholder', key: 'searchModel' },
    'btn-confirm-model-text': { attr: 'textContent', key: 'confirm' },
    'img-key-label-text': { attr: 'textContent', key: 'imageKeyLabel' },
    'img-api-key-placeholder': { attr: 'placeholder', key: 'imageKeyPlaceholder' },
    'btn-skip-text': { attr: 'textContent', key: 'skip' },
    'btn-confirm-image-text': { attr: 'textContent', key: 'confirm' },
    'btn-start-story-text': { attr: 'textContent', key: 'startStory' },
    'story-loading-text': { attr: 'textContent', key: 'weavingFate' },
    'btn-menu-text': { attr: 'textContent', key: 'menu' },
    'btn-continue-text': { attr: 'textContent', key: 'continue' },
    'btn-restart-text': { attr: 'textContent', key: 'newStory' },
    'your-version-placeholder': { attr: 'placeholder', key: 'yourVersionPlaceholder' },
    'btn-incorporate-text': { attr: 'textContent', key: 'incorporate' },
    'your-version-title': { attr: 'textContent', key: 'yourVersion' },
  };

  Object.entries(elementsToUpdate).forEach(([id, { attr, key }]) => {
    const el = document.getElementById(id);
    if (el) el[attr] = t(key, lang);
  });
}

function updateLanguageSelector() {
  const selector = document.getElementById('ui-lang-selector');
  if (!selector) return;

  const currentLang = UI_LANGUAGES.find(l => l.id === state.uiLang);
  const currentBtn = selector.querySelector('.current-lang');
  if (currentBtn) {
    currentBtn.innerHTML = `${currentLang.native} ${SVG.chevronDown}`;
  }

  // Update dropdown items
  selector.querySelectorAll('.lang-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.lang === state.uiLang);
  });
}

function renderLanguageSelector() {
  // Create language selector if not exists
  let selector = document.getElementById('ui-lang-selector');
  if (!selector) {
    selector = document.createElement('div');
    selector.id = 'ui-lang-selector';
    selector.className = 'ui-lang-selector';
    selector.innerHTML = `
      <button class="current-lang" title="${t('selectLanguage', state.uiLang)}">
        ${UI_LANGUAGES.find(l => l.id === state.uiLang)?.native || 'FR'} ${SVG.chevronDown}
      </button>
      <div class="lang-dropdown hidden">
        ${UI_LANGUAGES.map(lang => `
          <button class="lang-option ${lang.id === state.uiLang ? 'selected' : ''}" data-lang="${lang.id}">
            ${lang.label}
          </button>
        `).join('')}
      </div>
    `;
    document.body.appendChild(selector);

    // Add event listeners
    const currentBtn = selector.querySelector('.current-lang');
    const dropdown = selector.querySelector('.lang-dropdown');

    currentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    selector.querySelectorAll('.lang-option').forEach(option => {
      option.addEventListener('click', () => {
        switchUILanguage(option.dataset.lang);
        dropdown.classList.add('hidden');
      });
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdown.classList.add('hidden');
    });
  }
}

/* ─── INIT ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved UI language
  const savedUILang = localStorage.getItem('sw_ui_lang');
  if (savedUILang && UI_LANGUAGES.find(l => l.id === savedUILang)) {
    state.uiLang = savedUILang;
    window.__UI_LANG__ = savedUILang;
  } else {
    state.uiLang = detectBrowserLanguage();
    window.__UI_LANG__ = state.uiLang;
    localStorage.setItem('sw_ui_lang', state.uiLang);
  }

  initStarfield();
  renderProviderGrid();
  renderImageProviders();
  await preloadChoiceSvgs().catch(console.warn);
  renderSetupScreens();
  loadSavedSettings();
  setupEventListeners();
  updateAllUIText();
  renderLanguageSelector();
  renderDashboard();
});

/* ─── STARFIELD CANVAS ──────────────────────── */
function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.2,
      alpha: Math.random(),
      speed: Math.random() * 0.4 + 0.05,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleDir: Math.random() > 0.5 ? 1 : -1
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= 1)   { s.alpha = 1;   s.twinkleDir = -1; }
      if (s.alpha <= 0.1) { s.alpha = 0.1; s.twinkleDir =  1; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}

/* ─── SCREEN NAVIGATION ─────────────────────── */
function goTo(screenId) {
  const current = document.querySelector('.screen.active');
  const next    = document.getElementById(screenId);
  if (!next || current === next) return;

  current.classList.remove('active');
  current.classList.add('slide-out');
  setTimeout(() => current.classList.remove('slide-out'), 450);

  next.style.opacity = '0';
  next.classList.add('active');
  next.classList.add('slide-in');
  requestAnimationFrame(() => {
    next.style.opacity = '';
  });
  setTimeout(() => next.classList.remove('slide-in'), 450);

  // Show language selector on story screen
  if (screenId === 'screen-story') {
    setTimeout(renderLanguageSelector, 500);
  }
}

/* ─── PROVIDER GRID ─────────────────────────── */
function renderProviderGrid() {
  const grid = document.getElementById('provider-grid');
  grid.innerHTML = '';
  for (const [id, prov] of Object.entries(LLM_PROVIDERS)) {
    const card = document.createElement('div');
    card.className = 'provider-card';
    card.dataset.id = id;
    card.innerHTML = `
      ${prov.icon}
      <div class="provider-name">${prov.name}</div>
      <div class="provider-desc">${prov.desc}</div>`;
    card.addEventListener('click', () => selectProvider(id));
    grid.appendChild(card);
  }
}

function selectProvider(id) {
  state.provider = id;
  localStorage.setItem(LAST_PROVIDER_KEY, id);
  document.querySelectorAll('.provider-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  const section = document.getElementById('api-key-section');
  section.classList.remove('hidden');
  document.getElementById('provider-name-label').textContent = LLM_PROVIDERS[id].name;

  const saved = localStorage.getItem(`sw_key_${id}`);
  if (saved) {
    state.apiKey = saved;
    document.getElementById('api-key-input').value = saved;
    document.getElementById('save-key-checkbox').checked = true;
    document.getElementById('btn-test-api').disabled = false;
  }
}

/* ─── IMAGE PROVIDERS ───────────────────────── */
function renderImageProviders() {
  const grid = document.getElementById('image-providers-grid');
  grid.innerHTML = '';
  for (const [id, prov] of Object.entries(IMAGE_PROVIDERS)) {
    const card = document.createElement('div');
    card.className = 'img-provider-card';
    card.dataset.id = id;
    const hasFree = prov.models?.some(m => m.tags?.includes('free'));
    card.innerHTML = `
      ${hasFree ? '<span class="free-badge">FREE</span>' : ''}
      ${prov.icon}
      <div class="img-p-name">${prov.name}</div>
      <div class="img-p-desc">${prov.desc}</div>`;
    card.addEventListener('click', () => selectImgProvider(id));
    grid.appendChild(card);
  }
}

function selectImgProvider(id) {
  state.imgProvider = id;
  localStorage.setItem(LAST_IMAGE_PROVIDER_KEY, id);
  document.querySelectorAll('.img-provider-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });

  const section = document.getElementById('img-model-section');
  const confirmBtn = document.getElementById('btn-confirm-image');

  if (id === 'none') {
    section.classList.add('hidden');
    confirmBtn.classList.add('hidden');
  } else {
    section.classList.remove('hidden');
    confirmBtn.classList.remove('hidden');
    renderImgModels(id);
  }
}

function renderImgModels(providerId) {
  const prov = IMAGE_PROVIDERS[providerId];
  const list = document.getElementById('img-model-list');
  list.innerHTML = '';
  for (const m of prov.models) {
    const item = document.createElement('div');
    item.className = 'model-item';
    item.dataset.id = m.id;
    const tagsHtml = (m.tags || []).map(t =>
      `<span class="model-tag ${t}">${t === 'free' ? 'Gratuit' : t === 'speed' ? '⚡ Rapide' : t === 'quality' ? '★ HD' : '🎨 Art'}</span>`
    ).join('');
    item.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span class="model-id">${m.name}</span>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${tagsHtml}</div>
      </div>
      <span class="model-desc">${m.desc}</span>`;
    item.addEventListener('click', () => {
      document.querySelectorAll('#img-model-list .model-item').forEach(i =>
        i.classList.toggle('selected', i.dataset.id === m.id));
      state.imgModel = m.id;
      localStorage.setItem(LAST_IMAGE_MODEL_KEY, m.id);
    });
    list.appendChild(item);
  }
  list.firstChild?.click();
}

/* ─── SETUP SCREENS ─────────────────────────── */
function renderSetupScreens() {
  const firstNameInput = document.getElementById('player-first-name');
  if (firstNameInput) {
    firstNameInput.value = state.setup.firstName || '';
  }
  const lastNameInput = document.getElementById('player-last-name');
  if (lastNameInput) {
    lastNameInput.value = state.setup.lastName || '';
  }

  if (!state.setup.contentIntensity) {
    state.setup.contentIntensity = 'cinematic';
  }

  renderIntensityGrid();
  renderChoiceGrid('era-grid',     ERAS,     'era');
  renderChoiceGrid('faction-grid', FACTIONS, 'faction');
  renderChoiceGrid('role-grid',    ROLES,    'role');
  renderChoiceGrid('premise-grid', PREMISES, 'premise');
}

function renderIntensityGrid() {
  const grid = document.getElementById('intensity-grid');
  if (!grid) return;

  grid.innerHTML = '';
  for (const item of CONTENT_INTENSITY_OPTIONS) {
    const card = document.createElement('div');
    card.className = 'choice-card intensity-card';
    card.dataset.key = 'contentIntensity';
    card.dataset.id = item.id;
    card.style.setProperty('color', item.color || 'var(--gold)');
    card.classList.toggle('selected', state.setup.contentIntensity === item.id);
    card.innerHTML = `
      <span class="intensity-chip">${item.id === 'raw' ? 'Sans filtre' : item.id === 'adult' ? 'Très adulte' : item.id === 'dark' ? 'Sombre' : 'Cinématique'}</span>
      <span class="choice-name">${item.name}</span>
      <span class="choice-sub">${item.sub}</span>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.intensity-card').forEach(c => c.classList.toggle('selected', c.dataset.id === item.id));
      state.setup.contentIntensity = item.id;
    });
    grid.appendChild(card);
  }
}

function renderChoiceGrid(containerId, items, key) {
  const grid = document.getElementById(containerId);
  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.dataset.key = key;
    card.dataset.id  = item.id;
    if (item.id && key === 'faction') card.dataset.faction = item.id;
    card.style.setProperty('color', item.color || 'var(--gold)');
    card.classList.toggle('selected', state.setup[key] === item.id);

    // Special rendering for roles - show faction badge
    if (key === 'role' && item.attributes) {
      card.innerHTML = `
        <div class="role-card-header">
          ${renderChoiceIcon(item.svg)}
          <span class="faction-badge" style="background:${FACTIONS.find(f=>f.id===item.faction)?.color || '#666'}">
            ${FACTIONS.find(f=>f.id===item.faction)?.name || ''}
          </span>
        </div>
        <span class="choice-name">${item.name}</span>
        <span class="choice-sub">${item.sub || ''}</span>
      `;
    } else {
      card.innerHTML = `
        ${renderChoiceIcon(item.svg)}
        <span class="choice-name">${item.name}</span>
        <span class="choice-sub">${item.sub || item.years || item.members || ''}</span>
      `;
    }

    // Add click handler
    card.addEventListener('click', () => {
      document.querySelectorAll(`.choice-card[data-key="${key}"]`).forEach(c =>
        c.classList.toggle('selected', c.dataset.id === item.id));
      state.setup[key] = item.id;
      checkSetupComplete();

      if (key === 'era' || key === 'faction' || key === 'role' || key === 'premise') {
        renderDashboard();
      }
    });

    grid.appendChild(card);
  }
}

function checkSetupComplete() {
  const { era, faction, role, premise, contentIntensity } = state.setup;
  document.getElementById('btn-start-story').disabled = !(era && faction && role && premise && contentIntensity);
}

/* ─── MODEL SELECTION ───────────────────────── */
let _allModels = [];

async function populateModels() {
  const list   = document.getElementById('model-list');
  const search = document.getElementById('model-search');
  list.innerHTML = `<div class="model-loading">Chargement des modèles…</div>`;
  search.value = '';

  try {
    const prov = LLM_PROVIDERS[state.provider];
    if (prov.dynamicModels) {
      _allModels = await fetchOpenRouterModels(state.apiKey);
    } else {
      _allModels = prov.models;
    }
    LLM_PROVIDERS[state.provider].models = _allModels;
    renderModelList(_allModels);
  } catch (e) {
    list.innerHTML = `<div class="model-loading" style="color:var(--red)">Erreur: ${e.message}</div>`;
  }
}

function renderModelList(models) {
  const list = document.getElementById('model-list');
  list.innerHTML = '';

  if (!models.length) {
    list.innerHTML = `<div class="search-no-result">Aucun modèle trouvé</div>`;
    return;
  }

  for (const m of models) {
    const item = document.createElement('div');
    item.className = 'model-item';
    item.dataset.id = m.id;
    item.innerHTML = `<span class="model-id">${m.name || m.id}</span><span class="model-desc">${m.desc || m.id}</span>`;
    item.addEventListener('click', () => {
      document.querySelectorAll('#model-list .model-item').forEach(i =>
        i.classList.toggle('selected', i.dataset.id === m.id));
      state.model = m.id;
      document.getElementById('btn-confirm-model').disabled = false;
    });
    list.appendChild(item);
  }
  list.firstChild?.click();
}

function filterModels(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderModelList(_allModels);
    return;
  }
  const filtered = _allModels.filter(m =>
    (m.name || m.id).toLowerCase().includes(q) ||
    (m.id || '').toLowerCase().includes(q) ||
    (m.desc || '').toLowerCase().includes(q)
  );
  renderModelList(filtered);
}

/* ─── STORY ─────────────────────────────────── */
async function startStory() {
  const keyFromInput = document.getElementById('api-key-input')?.value.trim() || '';
  const resolvedApiKey = state.apiKey || keyFromInput || localStorage.getItem(`sw_key_${state.provider}`) || '';
  if (!resolvedApiKey.trim()) {
    alert('Clé API manquante. Sélectionne un fournisseur et renseigne ta clé avant de lancer l’histoire.');
    goTo('screen-api');
    return;
  }

  state.apiKey = resolvedApiKey.trim();

  const displayName = getCharacterDisplayName(state.setup);
  state.setup.firstName = displayName;

  // Images temporarily disabled by request
  state.imgProvider = 'none';
  state.imgModel = null;
  localStorage.setItem(LAST_IMAGE_PROVIDER_KEY, 'none');
  localStorage.removeItem(LAST_IMAGE_MODEL_KEY);

  // Use UI language as story language
  state.setup.language = state.uiLang;
  state.currentStoryId = state.currentStoryId || crypto.randomUUID();
  initializeStoryMemory(state.currentStoryId, state.setup);
  state.hiddenSkillProgress = loadSkillProgress(state.currentStoryId, state.setup.role);
  state.hiddenRelationshipProgress = loadRelationshipProgress(state.currentStoryId, state.setup);
  state.hiddenFactionReputation = loadFactionReputation(state.currentStoryId, state.setup);
  state.hiddenCampProfile = loadCampProfile(state.currentStoryId, state.setup);
  state.hiddenProtagonistProfile = loadProtagonistProfile(state.currentStoryId, state.setup);
  upsertSavedStory({
    id: state.currentStoryId,
    title: buildStoryTitle(state.setup),
    summary: state.setup.premise,
    setup: { ...state.setup },
    provider: state.provider,
    model: state.model,
    imgProvider: state.imgProvider,
    imgModel: state.imgModel,
    status: 'active',
    chapterTitle: 'Prologue',
    ...captureStorySessionSnapshot()
  });
  state.messages = [{ role: 'system', content: resolveBuildSystemPrompt(state.setup.language) }];
  state.turn = 0;
  state.userEdits = [];
  state.currentChapter = null;
  goTo('screen-story');
  await generateNextTurn(resolveBuildStartMessage(state.setup));
}

async function makeChoice(choiceInput) {
  if (state.isGenerating) return;

  const choiceObj = (choiceInput && typeof choiceInput === 'object') ? choiceInput : null;
  const choiceText = choiceObj?.text || String(choiceInput || '');
  const progressionEvent = choiceObj
    ? applyHiddenSkillProgress(state.currentStoryId, state.setup.role, choiceObj)
    : null;
  const factionReputationEvents = choiceObj
    ? applyChoiceFactionImpacts(state.currentStoryId, state.setup, choiceObj, 'choice')
    : [];

  if (factionReputationEvents.length) {
    appendFactionReputationMemoryTurn(state.currentStoryId, state.turn + 1, factionReputationEvents, 'choice');
  }

  const campSignals = inferCampSignalsFromText(choiceText);
  if (campSignals.length) {
    const campProgress = applyCampUpdates(state.currentStoryId, state.setup, campSignals, 'choice');
    if (campProgress.length) appendCampMemoryTurn(state.currentStoryId, state.turn + 1, campProgress, 'choice');
  }

  const protagonistPatch = inferProtagonistSignalsFromText(choiceText);
  if (Object.keys(protagonistPatch).length) {
    applyProtagonistState(state.currentStoryId, state.setup, protagonistPatch, 'choice');
  }

  if (progressionEvent && state.hiddenSkillProgress) {
    appendSkillProgressMemory(state.currentStoryId, state.turn + 1, progressionEvent, state.hiddenSkillProgress);
  }

  await generateNextTurn(
    resolveBuildContinueMessage(choiceText, state.turn, state.setup.language, state.setup, state.userEdits),
    progressionEvent
  );
}

async function generateNextTurn(userMessage, progressionEvent = null) {
  state.isGenerating = true;
  state.turn++;

  document.getElementById('story-turn-counter').textContent = `${t('turn', state.uiLang)} ${state.turn}`;
  setChoicesEnabled(false);
  showLoading(true);
  clearNarrative();

  const memoryContext = buildStoryMemoryContext(state.currentStoryId);
  const skillContext = buildSkillProgressContext(state.currentStoryId, state.setup.role);
  const relationshipContext = buildRelationshipContext(state.currentStoryId, state.setup);
  const factionContext = buildFactionReputationContext(state.currentStoryId, state.setup);
  const campContext = buildCampContext(state.currentStoryId, state.setup);
  const protagonistContext = buildProtagonistContext(state.currentStoryId, state.setup);
  const userMessageWithMemory = memoryContext
    ? `${userMessage}\n\nMÉMOIRE DE TRAME (.md, à respecter pour la continuité):\n${memoryContext}\n\n${skillContext}\n\n${relationshipContext}\n\n${factionContext}\n\n${campContext}\n\n${protagonistContext}\n${progressionEvent ? `\nDernière progression cachée: ${progressionEvent.attrKey} +${progressionEvent.gain} XP.` : ''}\n\nReste cohérent avec cette trame et fais évoluer l'histoire sans contradiction.`
    : `${userMessage}\n\n${skillContext}\n\n${relationshipContext}\n\n${factionContext}\n\n${campContext}\n\n${protagonistContext}`;

  state.messages.push({ role: 'user', content: userMessageWithMemory });

  try {
    let rawText = '';

    try {
      rawText = await callLLM(state.messages, {
        providerId: state.provider,
        model:      state.model,
        apiKey:     state.apiKey,
        onStream:   null
      });
    } catch (e) {
      throw e;
    }

    state.messages.push({ role: 'assistant', content: rawText });
    const story = resolveParseStoryResponse(rawText, state.turn, state.setup.language);
    const parseDiagnostics = typeof window.getLastStoryParseDiagnostics === 'function'
      ? window.getLastStoryParseDiagnostics()
      : null;
    if (parseDiagnostics?.warnings?.length) {
      console.warn('[story-parse-diagnostics]', parseDiagnostics);
    }
    appendStoryMemoryTurn(state.currentStoryId, state.turn, story, userMessage);
    const relationshipUpdates = applyRelationshipUpdates(
      state.currentStoryId,
      state.setup,
      normalizeRelationshipUpdates(story.relationship_updates || story.relationships || []),
      'story'
    );
    if (relationshipUpdates.length) {
      appendRelationshipMemoryTurn(state.currentStoryId, state.turn, relationshipUpdates, 'story');
    }
    const reputationUpdates = applyFactionReputationUpdates(
      state.currentStoryId,
      state.setup,
      story.reputation_updates || story.reputation || [],
      'story'
    );
    if (reputationUpdates.length) {
      appendFactionReputationMemoryTurn(state.currentStoryId, state.turn, reputationUpdates, 'story');
    }
    const campUpdates = applyCampUpdates(
      state.currentStoryId,
      state.setup,
      [...(story.camp_updates || story.camp || []), ...buildCampEventFromStory(story)],
      'story'
    );
    if (campUpdates.length) {
      appendCampMemoryTurn(state.currentStoryId, state.turn, campUpdates, 'story');
    }
    const protagonistPatch = story.protagonist_state || story.character_state || inferProtagonistSignalsFromText([story?.narrative?.context, story?.narrative?.action, story?.narrative?.dialogue, story?.narrative?.reflection].filter(Boolean).join(' '));
    if (protagonistPatch && Object.keys(protagonistPatch).length) {
      applyProtagonistState(state.currentStoryId, state.setup, protagonistPatch, 'story');
    }
    state.currentChapter = story;
    if (state.currentStoryId) {
      upsertSavedStory({
        id: state.currentStoryId,
        title: buildStoryTitle(state.setup),
        summary: state.setup.premise,
        setup: { ...state.setup },
        provider: state.provider,
        model: state.model,
        imgProvider: state.imgProvider,
        imgModel: state.imgModel,
        status: 'active',
        chapterTitle: story.chapter_title,
        ...captureStorySessionSnapshot()
      });
      renderDashboard();
    }

    // Update chapter title
    document.getElementById('story-chapter-title').textContent = story.chapter_title;

    // Type narrative
    showLoading(false);
    await typeNarrative(resolveFormatNarrative(story));

    // Render choices with attribute info
    renderChoicesWithAttributes(story.choices);

    // Show collaborative panel
    showCollaborativePanel();

    // Images temporarily disabled
    document.getElementById('story-image-container')?.classList.add('hidden');

  } catch (e) {
    showLoading(false);
    document.getElementById('story-narrative').innerHTML =
      `<p style="color:var(--red)">${t('aiError')}: ${e.message}</p>
       <p style="color:#666;font-size:13px">${t('retry')}</p>`;
    renderChoices([t('retryAction', state.uiLang)]);
  }

  state.isGenerating = false;
}

async function generateStoryImageWithFallback(prompt) {
  const container = document.getElementById('story-image-container');
  const img = document.getElementById('story-image');

  // Show loading state
  container.classList.remove('hidden');
  container.classList.add('loading');
  img.src = '';
  document.getElementById('image-status')?.classList.remove('hidden');

  try {
    const url = await generateImageWithRetry(prompt, {
      imgProviderId: state.imgProvider,
      imgModel:      state.imgModel,
      imgApiKey:     state.imgApiKey,
      llmApiKey:     state.apiKey
    });

    container.classList.remove('loading');

    if (url) {
      img.src = url;
      document.getElementById('image-status')?.classList.add('hidden');
    } else {
      // Use placeholder
      const faction = resolveFactionConfig(state.setup.faction);
      img.src = generatePlaceholderSVG(t('imageFailed', state.uiLang), faction?.color);
    }
  } catch (e) {
    container.classList.remove('loading');
    const faction = resolveFactionConfig(state.setup.faction);
    img.src = generatePlaceholderSVG(t('imageFailed', state.uiLang), faction?.color);
    console.warn('Image generation failed:', e.message);
  }
}

/* ─── NARRATIVE TYPEWRITER ──────────────────── */
function clearNarrative() {
  document.getElementById('story-narrative').innerHTML = '';
  document.getElementById('story-choices').innerHTML = '';
  document.getElementById('collaborative-panel')?.classList.remove('active');
}

async function typeNarrative(html) {
  const el = document.getElementById('story-narrative');
  el.innerHTML = html;

  // Animate in: fade + slide each section, typewriter each paragraph text
  const sections = Array.from(el.querySelectorAll('.narrative-section'));
  for (const section of sections) {
    section.classList.add('narrative-enter');
    // Typewriter effect on the paragraph inside this section only
    const paragraphs = section.querySelectorAll('p');
    for (const p of paragraphs) {
      const fullText = p.textContent;
      p.textContent = '';
      for (let i = 0; i < fullText.length; i++) {
        p.textContent = fullText.slice(0, i + 1);
        if (i % 4 === 0) await sleep(10);
      }
    }
    section.classList.add('narrative-shown');
    await sleep(80);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ─── CHOICES ───────────────────────────────── */
function renderChoicesWithAttributes(choices) {
  const container = document.getElementById('story-choices');
  container.innerHTML = '';
  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';

    const attrLabel = t(choice.attribute || 'survival', state.uiLang);
    const difficultyStars = '★'.repeat(choice.difficulty || 1);

    btn.innerHTML = `
      <span class="choice-num">${String.fromCharCode(65 + i)}.</span>
      <span class="choice-text">${choice.text}</span>
      <span class="choice-meta">
        <span class="choice-attr">${attrLabel}</span>
        <span class="choice-diff">${difficultyStars}</span>
      </span>
    `;
    btn.addEventListener('click', () => makeChoice(choice));
    container.appendChild(btn);
  });
}

function renderChoices(choices) {
  const container = document.getElementById('story-choices');
  container.innerHTML = '';
  if (typeof choices === 'string') {
    choices = [choices];
  }
  choices.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-num">${String.fromCharCode(65 + i)}.</span>${text}`;
    btn.addEventListener('click', () => makeChoice(text));
    container.appendChild(btn);
  });
}

function setChoicesEnabled(enabled) {
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = !enabled);
}

function showLoading(show) {
  document.getElementById('story-loading').classList.toggle('hidden', !show);
}

/* ─── COLLABORATIVE MODE ─────────────────────── */
function showCollaborativePanel() {
  let panel = document.getElementById('collaborative-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'collaborative-panel';
    panel.className = 'collaborative-panel';
    panel.innerHTML = `
      <button class="collaborative-toggle" onclick="toggleCollaborativePanel()">
        ${SVG.edit}
        <span data-i18n="yourVersion">${t('yourVersion', state.uiLang)}</span>
        ${SVG.chevronDown}
      </button>
      <div class="collaborative-content hidden">
        <textarea
          id="user-edit-input"
          class="user-edit-textarea"
          placeholder="${t('yourVersionPlaceholder', state.uiLang)}"
        ></textarea>
        <div class="collaborative-actions">
          <button class="sw-btn primary" id="btn-incorporate" onclick="incorporateUserEdit()">
            <span data-i18n="incorporate">${t('incorporate', state.uiLang)}</span>
          </button>
          <span class="incorporated-notice hidden" id="incorporated-notice">
            ${SVG.check} <span data-i18n="incorporated">${t('incorporated', state.uiLang)}</span>
          </span>
        </div>
        ${state.userEdits.length > 0 ? `
          <div class="edit-history">
            <h4 data-i18n="editHistory">${t('editHistory', state.uiLang)}</h4>
            ${state.userEdits.map((edit, i) => `
              <div class="edit-item">
                <span class="edit-turn">Tour ${edit.turn}</span>
                <span class="edit-preview">${edit.text.substring(0, 50)}...</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    document.getElementById('story-body').appendChild(panel);
  }
  panel.classList.add('active');
}

function toggleCollaborativePanel() {
  const panel = document.getElementById('collaborative-panel');
  const content = panel.querySelector('.collaborative-content');
  const toggle = panel.querySelector('.collaborative-toggle');

  content.classList.toggle('hidden');
  toggle.classList.toggle('expanded');
}

async function incorporateUserEdit() {
  if (state.isGenerating) return;

  const input = document.getElementById('user-edit-input');
  const text = input.value.trim();

  if (!text) return;

  const currentProgress = loadSkillProgress(state.currentStoryId, state.setup.role);
  const assessment = assessUserActionBalance(text, state.setup.role, currentProgress);
  const relationUpdates = applyRelationshipProgressFromText(state.currentStoryId, state.setup, text, 'user');

  const syntheticChoice = {
    text,
    attribute: assessment.attrKey,
    difficulty: assessment.difficulty
  };
  const progressionEvent = applyHiddenSkillProgress(state.currentStoryId, state.setup.role, syntheticChoice);
  if (progressionEvent && state.hiddenSkillProgress) {
    appendSkillProgressMemory(state.currentStoryId, state.turn + 1, progressionEvent, state.hiddenSkillProgress);
  }

  const realismConstraint = buildUserVersionConstraint(assessment, state.setup);
  const baseContinue = resolveBuildContinueMessage(text, state.turn, state.setup.language, state.setup, state.userEdits);
  const treatedAsChoicePrompt = `${baseContinue}\n\nACTION JOUEUR SPÉCIALE ("Votre version des événements"):\n- Considère ce texte comme un vrai choix joueur qui doit modifier immédiatement la situation et faire avancer l'intrigue.\n- Action proposée: \"${text}\"${realismConstraint}`;

  // Save edit
  state.userEdits.push({
    turn: state.turn,
    text: text,
    chapterTitle: state.currentChapter?.chapter_title || '',
    meta: {
      source: 'your_version_choice',
      attribute: assessment.attrKey,
      difficulty: assessment.difficulty,
      abusive: assessment.isAbusive,
      relationUpdates: relationUpdates.map(update => ({
        name: update.name,
        type: update.type,
        level: update.level,
        affinity: update.affinity,
        closeness: update.closeness,
        community: update.community
      }))
    }
  });

  // Show confirmation
  const notice = document.getElementById('incorporated-notice');
  notice.classList.remove('hidden');
  input.value = '';

  // Update edit history
  const history = document.querySelector('.edit-history');
  if (history) {
    history.innerHTML += `
      <div class="edit-item">
        <span class="edit-turn">Tour ${state.turn}</span>
        <span class="edit-preview">${text.substring(0, 50)}...</span>
      </div>
    `;
  }

  // Clear notice after 3 seconds
  setTimeout(() => {
    notice.classList.add('hidden');
  }, 3000);

  if (relationUpdates.length) {
    appendRelationshipMemoryTurn(state.currentStoryId, state.turn + 1, relationUpdates, 'user');
  }

  await generateNextTurn(treatedAsChoicePrompt, progressionEvent);
}

/* ─── STORY MENU ────────────────────────────── */
function closeStoryMenu() {
  document.getElementById('story-menu-overlay').classList.add('hidden');
}

function openStoryMenu() {
  const { era, faction, role, premise } = state.setup;
  const info = [
    `Nom: ${getCharacterDisplayName(state.setup) || '—'}`,
    `${t('era', state.uiLang)}: ${ERAS.find(e=>e.id===era)?.name || era || '—'}`,
    `${t('faction', state.uiLang)}: ${FACTIONS.find(f=>f.id===faction)?.name || faction || '—'}`,
    `${t('role', state.uiLang)}: ${ROLES.find(r=>r.id===role)?.name || role || '—'}`,
    `${t('premise', state.uiLang)}: ${PREMISES.find(p=>p.id===premise)?.name || premise || '—'}`,
    `Intensité: ${getIntensityConfig(state.setup.contentIntensity || 'cinematic').name}`,
    `${t('turn', state.uiLang)}: ${state.turn}`
  ].join('<br>');
  document.getElementById('overlay-story-info').innerHTML = info;
  document.getElementById('story-menu-overlay').classList.remove('hidden');
}

/* ─── EVENT LISTENERS ───────────────────────── */
function setupEventListeners() {
  const firstNameInput = document.getElementById('player-first-name');
  if (firstNameInput) {
    firstNameInput.addEventListener('input', (e) => {
      state.setup.firstName = String(e.target?.value || '').trimStart();
      checkSetupComplete();
    });
  }

  const lastNameInput = document.getElementById('player-last-name');
  if (lastNameInput) {
    lastNameInput.addEventListener('input', (e) => {
      state.setup.lastName = String(e.target?.value || '').trimStart();
      checkSetupComplete();
    });
  }

  document.getElementById('btn-identity-next')?.addEventListener('click', () => {
    state.setup.firstName = String(document.getElementById('player-first-name')?.value || '').trim();
    state.setup.lastName = String(document.getElementById('player-last-name')?.value || '').trim();
    goTo('screen-tone');
  });

  document.getElementById('btn-intensity-next')?.addEventListener('click', () => {
    if (!state.setup.contentIntensity) state.setup.contentIntensity = 'cinematic';
    goTo('screen-setup');
  });

  const dashboardGrid = document.getElementById('dashboard-story-grid');
  if (dashboardGrid) {
    dashboardGrid.addEventListener('click', (event) => {
      const target = event.target;
      const card = target instanceof HTMLElement ? target.closest('.dashboard-story-card') : null;
      if (!card) return;

      const storyId = card.dataset.id;
      const story = getSavedStories().find(entry => entry.id === storyId);
      if (!story) return;

      if (target instanceof HTMLElement && target.dataset.action === 'delete') {
        event.stopPropagation();
        if (confirm(`Supprimer « ${story.title} » ?`)) {
          deleteSavedStory(story.id);
        }
        return;
      }

      if (target instanceof HTMLElement && target.dataset.action === 'open') {
        event.stopPropagation();
      }

      openSavedStory(story).catch((error) => {
        console.error(error);
        alert('Impossible de reprendre cette histoire pour le moment.');
      });
    });
  }

  const createStoryBtn = document.getElementById('btn-create-story');
  if (createStoryBtn) {
    createStoryBtn.addEventListener('click', () => {
      resetStorySetup();
      goTo('screen-identity');
    });
  }

  const editImageModelBtn = document.getElementById('btn-edit-image-model');
  if (editImageModelBtn) {
    editImageModelBtn.addEventListener('click', () => goTo('screen-image'));
  }

  const editTextModelBtn = document.getElementById('btn-edit-text-model');
  if (editTextModelBtn) {
    editTextModelBtn.addEventListener('click', () => {
      openTextModelSelectorFromDashboard().catch((error) => {
        console.error(error);
        alert('Impossible de charger les modèles pour le moment.');
      });
    });
  }

  // Model search
  const modelSearch = document.getElementById('model-search');
  if (modelSearch) {
    modelSearch.addEventListener('input', (e) => {
      filterModels(e.target.value);
    });
  }

  // API Key input
  const keyInput = document.getElementById('api-key-input');
  if (keyInput) {
    keyInput.addEventListener('input', () => {
      const testBtn = document.getElementById('btn-test-api');
      if (testBtn) testBtn.disabled = keyInput.value.trim().length < 10;
      document.getElementById('api-error')?.classList.add('hidden');
    });
  }

  // Toggle key visibility
  document.getElementById('toggle-key-visibility')?.addEventListener('click', () => {
    if (!keyInput) return;
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
  });

  // Test API button
  document.getElementById('btn-test-api')?.addEventListener('click', async () => {
    const btn  = document.getElementById('btn-test-api');
    const err  = document.getElementById('api-error');
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');

    state.apiKey = keyInput.value.trim();
    text.classList.add('hidden');
    loader.classList.remove('hidden');
    btn.disabled = true;
    err.classList.add('hidden');

    try {
      state.dashboardModelEdit = false;
      await testApiConnection(state.provider, state.apiKey);

      if (document.getElementById('save-key-checkbox').checked) {
        localStorage.setItem(`sw_key_${state.provider}`, state.apiKey);
      } else {
        localStorage.removeItem(`sw_key_${state.provider}`);
      }

      await populateModels();
      localStorage.setItem(LAST_PROVIDER_KEY, state.provider);
      goTo('screen-model');
    } catch (e) {
      err.textContent = `Connexion échouée: ${e.message}`;
      err.classList.remove('hidden');
    } finally {
      text.classList.remove('hidden');
      loader.classList.add('hidden');
      btn.disabled = false;
    }
  });

  // Confirm model
  document.getElementById('btn-confirm-model')?.addEventListener('click', () => {
    localStorage.setItem(LAST_MODEL_KEY, state.model || '');
    if (state.dashboardModelEdit) {
      state.dashboardModelEdit = false;
      localStorage.setItem(FLOW_READY_KEY, '1');
      renderDashboard();
      goTo('screen-dashboard');
      return;
    }
    state.imgProvider = 'none';
    state.imgModel = null;
    localStorage.setItem(LAST_IMAGE_PROVIDER_KEY, 'none');
    localStorage.removeItem(LAST_IMAGE_MODEL_KEY);
    localStorage.setItem(FLOW_READY_KEY, '1');
    renderDashboard();
    goTo('screen-dashboard');
  });

  // Skip image
  document.getElementById('btn-skip-image')?.addEventListener('click', () => {
    state.dashboardModelEdit = false;
    state.imgProvider = 'none';
    state.imgModel = null;
    localStorage.setItem(LAST_IMAGE_PROVIDER_KEY, state.imgProvider);
    localStorage.removeItem(LAST_IMAGE_MODEL_KEY);
    localStorage.setItem(FLOW_READY_KEY, '1');
    renderDashboard();
    goTo('screen-dashboard');
  });

  // Confirm image provider
  document.getElementById('btn-confirm-image')?.addEventListener('click', () => {
    state.dashboardModelEdit = false;
    const imgKey = document.getElementById('img-api-key').value.trim();
    if (imgKey) state.imgApiKey = imgKey;
    localStorage.setItem(LAST_IMAGE_PROVIDER_KEY, state.imgProvider);
    if (state.imgModel) localStorage.setItem(LAST_IMAGE_MODEL_KEY, state.imgModel);
    localStorage.setItem(FLOW_READY_KEY, '1');
    renderDashboard();
    goTo('screen-dashboard');
  });

  // Start story
  document.getElementById('btn-start-story')?.addEventListener('click', startStory);

  // Story menu button now returns directly to the dashboard
  document.getElementById('btn-menu-story')?.addEventListener('click', () => {
    goTo('screen-dashboard');
  });

  // Restart is handled by the inline handler in the menu.

  // Keyboard shortcuts for choices
  document.addEventListener('keydown', (e) => {
    if (state.isGenerating) return;
    const current = document.querySelector('.screen.active');
    if (current?.id !== 'screen-story') return;

    const map = { 'a': 0, 'z': 1, 'e': 2, 'r': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
    const idx = map[e.key.toLowerCase()];
    if (idx !== undefined) {
      const btns = document.querySelectorAll('.choice-btn');
      if (btns[idx] && !btns[idx].disabled) btns[idx].click();
    }
  });
}

/* ─── PERSIST SETTINGS ──────────────────────── */
function loadSavedSettings() {
  const lastProvider = localStorage.getItem(LAST_PROVIDER_KEY);
  const lastModel = localStorage.getItem(LAST_MODEL_KEY);
  const lastImageProvider = localStorage.getItem(LAST_IMAGE_PROVIDER_KEY);
  const lastImageModel = localStorage.getItem(LAST_IMAGE_MODEL_KEY);

  if (lastProvider && LLM_PROVIDERS[lastProvider]) {
    state.provider = lastProvider;
    state.apiKey = localStorage.getItem(`sw_key_${lastProvider}`) || state.apiKey;
  }
  if (lastModel) {
    state.model = lastModel;
  }
  if (lastImageProvider) {
    state.imgProvider = 'none';
    state.imgModel = null;
  }

  if (localStorage.getItem(FLOW_READY_KEY) === '1') {
    renderDashboard();
    goTo('screen-dashboard');
  }
}

function restartStory() {
  closeStoryMenu();
  document.getElementById('story-image-container')?.classList.add('hidden');
  state.messages = [];
  state.turn = 0;
  state.currentChapter = null;
  state.userEdits = [];
  state.currentStoryId = null;
  renderDashboard();
  goTo('screen-dashboard');
}
