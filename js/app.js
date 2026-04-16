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
    era: null,
    faction: null,
    role: null,
    premise: null
  },
  userEdits: [],                    // Collaborative mode edits
  messages: [],
  turn: 0,
  dashboardModelEdit: false,
  isGenerating: false,
  currentChapter: null,
  imageRetryCount: 0
};

const STORY_STORAGE_KEY = 'sw_saved_stories';
const FLOW_READY_KEY = 'sw_flow_ready';
const LAST_PROVIDER_KEY = 'sw_last_provider';
const LAST_MODEL_KEY = 'sw_last_model';
const LAST_IMAGE_PROVIDER_KEY = 'sw_last_image_provider';
const LAST_IMAGE_MODEL_KEY = 'sw_last_image_model';
const choiceSvgCache = new Map();

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
  const era = ERAS.find(e => e.id === setup.era)?.name || setup.era || 'Histoire Star Wars';
  const faction = FACTIONS.find(f => f.id === setup.faction)?.name || setup.faction || '';
  const role = ROLES.find(r => r.id === setup.role)?.name || setup.role || '';
  const premise = PREMISES.find(p => p.id === setup.premise)?.name || setup.premise || '';
  return `Commence une histoire interactive Star Wars avec ces paramètres:\n- Ère: ${era}\n- Faction: ${faction}\n- Rôle: ${role}\n- Prémisse: ${premise}\n\nGénère le prologue de l'histoire en ${LANGUAGES.find(l => l.id === setup.language)?.promptName || 'French'}. Réponds avec le JSON attendu.`;
}

function resolveBuildContinueMessage(choiceText, turnNumber, languageId, setup, userEdits = []) {
  if (typeof window.buildContinueMessage === 'function') return window.buildContinueMessage(choiceText, turnNumber, languageId, setup, userEdits);
  const language = LANGUAGES.find(l => l.id === languageId) || LANGUAGES[0] || { promptName: 'French' };
  return `Tour ${turnNumber} — Le joueur choisit: "${choiceText}"\n\nContinue l'histoire en ${language.promptName} en tenant compte de ce choix. Les conséquences doivent être visibles et significatives.`;
}

function resolveParseStoryResponse(raw, turnNumber) {
  if (typeof window.parseStoryResponse === 'function') return window.parseStoryResponse(raw, turnNumber);

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
        ? { context: parsed.narrative.substring(0, 300), action: parsed.narrative, dialogue: '', reflection: '', atmosphere: 'tense' }
        : {
            context: parsed.narrative?.context || '',
            action: parsed.narrative?.action || '',
            dialogue: parsed.narrative?.dialogue || '',
            reflection: parsed.narrative?.reflection || '',
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
      narrative: { context: cleaned.substring(0, 300), action: cleaned, dialogue: '', reflection: '', atmosphere: 'tense' },
      choices: [],
      scene_description: 'Epic Star Wars cinematic scene with dramatic lighting',
      user_edits_applied: null
    };
  }
}

function resolveFormatNarrative(story) {
  if (typeof window.formatNarrative === 'function') return window.formatNarrative(story);
  const narrative = story?.narrative || {};
  const parts = [narrative.context, narrative.action, narrative.dialogue, narrative.reflection].filter(Boolean);
  return `<div class="narrative-container"><div class="narrative-section"><p>${parts.join('</p><p>')}</p></div></div>`;
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
  return [era, faction, role].filter(Boolean).join(' · ');
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
    era: null,
    faction: null,
    role: null,
    premise: null
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

  const stories = getSavedStories().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  count.textContent = `${stories.length}`;
  if (modelLabel) {
    modelLabel.textContent = state.model || localStorage.getItem(LAST_MODEL_KEY) || '—';
  }
  grid.innerHTML = '';

  if (!stories.length) {
    grid.innerHTML = `
      <div class="dashboard-empty">
        <h3>Aucune histoire pour l’instant</h3>
        <p>Créez votre première histoire et elle apparaîtra ici.</p>
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
          <span class="dashboard-story-status ${story.status}">${story.status === 'active' ? 'En cours' : 'Brouillon'}</span>
        </div>
        <p>${story.summary || story.setup?.premise || 'Aucune prémisse enregistrée.'}</p>
        <div class="dashboard-story-meta">
          <span>${story.chapterTitle || 'Prologue'}</span>
          <span>${new Date(story.updatedAt).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      <div class="dashboard-story-actions">
        <button class="sw-btn secondary dashboard-open-story" data-action="open">Ouvrir</button>
        <button class="sw-btn ghost dashboard-delete-story" data-action="delete">Supprimer</button>
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
  renderChoiceGrid('era-grid',     ERAS,     'era');
  renderChoiceGrid('faction-grid', FACTIONS, 'faction');
  renderChoiceGrid('role-grid',    ROLES,    'role');
  renderChoiceGrid('premise-grid', PREMISES, 'premise');
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
  const { era, faction, role, premise } = state.setup;
  document.getElementById('btn-start-story').disabled = !(era && faction && role && premise);
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

  // Use UI language as story language
  state.setup.language = state.uiLang;
  state.currentStoryId = state.currentStoryId || crypto.randomUUID();
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
    chapterTitle: 'Prologue'
  });
  state.messages = [{ role: 'system', content: resolveBuildSystemPrompt(state.setup.language) }];
  state.turn = 0;
  state.userEdits = [];
  state.currentChapter = null;
  goTo('screen-story');
  await generateNextTurn(resolveBuildStartMessage(state.setup));
}

async function makeChoice(choiceText) {
  if (state.isGenerating) return;
  await generateNextTurn(resolveBuildContinueMessage(choiceText, state.turn, state.setup.language, state.setup, state.userEdits));
}

async function generateNextTurn(userMessage) {
  state.isGenerating = true;
  state.turn++;

  document.getElementById('story-turn-counter').textContent = `${t('turn', state.uiLang)} ${state.turn}`;
  setChoicesEnabled(false);
  showLoading(true);
  clearNarrative();

  state.messages.push({ role: 'user', content: userMessage });

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
    const story = resolveParseStoryResponse(rawText, state.turn);
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
        chapterTitle: story.chapter_title
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

    // Generate image
    if (state.imgProvider !== 'none') {
      state.imageRetryCount = 0;
      generateStoryImageWithFallback(story.scene_description).catch(console.warn);
    }

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
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  el.innerHTML = '';

  for (const child of Array.from(tmp.children)) {
    const p = document.createElement('p');
    el.appendChild(p);
    const text = child.textContent;
    for (let i = 0; i < text.length; i++) {
      p.textContent = text.slice(0, i + 1);
      if (i % 3 === 0) await sleep(12);
    }
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
    btn.addEventListener('click', () => makeChoice(choice.text));
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

function incorporateUserEdit() {
  const input = document.getElementById('user-edit-input');
  const text = input.value.trim();

  if (!text) return;

  // Save edit
  state.userEdits.push({
    turn: state.turn,
    text: text,
    chapterTitle: state.currentChapter?.chapter_title || ''
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
}

/* ─── STORY MENU ────────────────────────────── */
function closeStoryMenu() {
  document.getElementById('story-menu-overlay').classList.add('hidden');
}

function openStoryMenu() {
  const { era, faction, role, premise } = state.setup;
  const info = [
    `${t('era', state.uiLang)}: ${ERAS.find(e=>e.id===era)?.name || era || '—'}`,
    `${t('faction', state.uiLang)}: ${FACTIONS.find(f=>f.id===faction)?.name || faction || '—'}`,
    `${t('role', state.uiLang)}: ${ROLES.find(r=>r.id===role)?.name || role || '—'}`,
    `${t('premise', state.uiLang)}: ${PREMISES.find(p=>p.id===premise)?.name || premise || '—'}`,
    `${t('turn', state.uiLang)}: ${state.turn}`
  ].join('<br>');
  document.getElementById('overlay-story-info').innerHTML = info;
  document.getElementById('story-menu-overlay').classList.remove('hidden');
}

/* ─── EVENT LISTENERS ───────────────────────── */
function setupEventListeners() {
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

      state.currentStoryId = story.id;
      state.provider = story.provider || state.provider;
      state.model = story.model || state.model;
      state.imgProvider = story.imgProvider || state.imgProvider;
      state.imgModel = story.imgModel || state.imgModel;
      state.setup = { ...story.setup };
      renderSetupScreens();
      checkSetupComplete();
      goTo('screen-setup');
    });
  }

  const createStoryBtn = document.getElementById('btn-create-story');
  if (createStoryBtn) {
    createStoryBtn.addEventListener('click', () => {
      resetStorySetup();
      goTo('screen-setup');
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
    goTo('screen-image');
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
    if (lastImageProvider === 'openrouter_img' && state.provider === 'openrouter' && state.apiKey) {
      state.imgProvider = lastImageProvider;
      if (lastImageModel) {
        state.imgModel = lastImageModel;
      }
    } else {
      state.imgProvider = 'none';
      state.imgModel = null;
    }
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
