/* ═══════════════════════════════════════════════
   app.js — Main application logic
═══════════════════════════════════════════════ */

/* ─── APP STATE ─────────────────────────────── */
const state = {
  provider: null,
  apiKey: '',
  model: null,
  imgProvider: 'none',
  imgModel: null,
  imgApiKey: '',
  setup: { era: null, faction: null, role: null, premise: null },
  messages: [],
  turn: 0,
  isGenerating: false
};

/* ─── INIT ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  renderProviderGrid();
  renderImageProviders();
  renderSetupScreens();
  loadSavedSettings();
  setupEventListeners();
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
  document.querySelectorAll('.provider-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  const section = document.getElementById('api-key-section');
  section.classList.remove('hidden');
  document.getElementById('provider-name-label').textContent = LLM_PROVIDERS[id].name;

  // Load saved key if any
  const saved = localStorage.getItem(`sw_key_${id}`);
  if (saved) {
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
    card.innerHTML = `
      ${prov.icon}
      <div class="img-p-name">${prov.name}</div>
      <div class="img-p-desc">${prov.desc}</div>`;
    card.addEventListener('click', () => selectImgProvider(id));
    grid.appendChild(card);
  }
}

function selectImgProvider(id) {
  state.imgProvider = id;
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
    item.innerHTML = `<span class="model-id">${m.name}</span><span class="model-desc">${m.desc}</span>`;
    item.addEventListener('click', () => {
      document.querySelectorAll('#img-model-list .model-item').forEach(i =>
        i.classList.toggle('selected', i.dataset.id === m.id));
      state.imgModel = m.id;
    });
    list.appendChild(item);
  }
  // Auto-select first
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
    card.innerHTML = `
      ${item.svg}
      <span class="choice-name">${item.name}</span>
      <span class="choice-sub">${item.sub || item.years || ''}</span>`;
    card.addEventListener('click', () => {
      document.querySelectorAll(`.choice-card[data-key="${key}"]`).forEach(c =>
        c.classList.toggle('selected', c.dataset.id === item.id));
      state.setup[key] = item.id;
      checkSetupComplete();
    });
    grid.appendChild(card);
  }
}

function checkSetupComplete() {
  const { era, faction, role, premise } = state.setup;
  document.getElementById('btn-start-story').disabled = !(era && faction && role && premise);
}

/* ─── MODEL SELECTION ───────────────────────── */
async function populateModels() {
  const list = document.getElementById('model-list');
  list.innerHTML = `<div class="model-loading">Chargement des modèles…</div>`;

  try {
    let models = [];
    const prov = LLM_PROVIDERS[state.provider];

    if (prov.dynamicModels) {
      models = await fetchOpenRouterModels(state.apiKey);
    } else {
      models = prov.models;
    }

    LLM_PROVIDERS[state.provider].models = models;
    list.innerHTML = '';

    for (const m of models) {
      const item = document.createElement('div');
      item.className = 'model-item';
      item.dataset.id = m.id;
      item.innerHTML = `<span class="model-id">${m.name || m.id}</span><span class="model-desc">${m.desc || ''}</span>`;
      item.addEventListener('click', () => {
        document.querySelectorAll('.model-item').forEach(i =>
          i.classList.toggle('selected', i.dataset.id === m.id));
        state.model = m.id;
        document.getElementById('btn-confirm-model').disabled = false;
      });
      list.appendChild(item);
    }
    // Auto-select first
    list.firstChild?.click();
  } catch (e) {
    list.innerHTML = `<div class="model-loading" style="color:var(--red)">Erreur: ${e.message}</div>`;
  }
}

/* ─── STORY ─────────────────────────────────── */
async function startStory() {
  state.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  state.turn = 0;
  goTo('screen-story');
  await generateNextTurn(buildStartMessage(state.setup));
}

async function makeChoice(choiceText) {
  if (state.isGenerating) return;
  await generateNextTurn(buildContinueMessage(choiceText, state.turn));
}

async function generateNextTurn(userMessage) {
  state.isGenerating = true;
  state.turn++;

  // Update UI
  document.getElementById('story-turn-counter').textContent = `Tour ${state.turn}`;
  setChoicesEnabled(false);
  showLoading(true);
  clearNarrative();

  // Build messages
  state.messages.push({ role: 'user', content: userMessage });

  try {
    let rawText = '';

    // Try streaming first
    try {
      rawText = await callLLM(state.messages, {
        providerId: state.provider,
        model:      state.model,
        apiKey:     state.apiKey,
        onStream:   null // disable streaming for JSON parsing reliability
      });
    } catch (e) {
      throw e;
    }

    state.messages.push({ role: 'assistant', content: rawText });
    const story = parseStoryResponse(rawText);

    // Update chapter title
    document.getElementById('story-chapter-title').textContent = story.chapter_title;

    // Type narrative
    showLoading(false);
    await typeNarrative(formatNarrative(story.narrative));

    // Render choices
    renderChoices(story.choices);

    // Generate image if configured
    if (state.imgProvider !== 'none') {
      generateStoryImage(story.scene_description).catch(console.warn);
    }

  } catch (e) {
    showLoading(false);
    document.getElementById('story-narrative').innerHTML =
      `<p style="color:var(--red)">Erreur IA: ${e.message}</p>
       <p style="color:#666;font-size:13px">Vérifiez votre clé API et réessayez.</p>`;
    renderChoices(['Réessayer cette action']);
  }

  state.isGenerating = false;
}

async function generateStoryImage(prompt) {
  try {
    const url = await generateImage(prompt, {
      imgProviderId: state.imgProvider,
      imgModel:      state.imgModel,
      imgApiKey:     state.imgApiKey,
      llmApiKey:     state.apiKey
    });
    if (url) {
      const container = document.getElementById('story-image-container');
      const img       = document.getElementById('story-image');
      img.src = url;
      container.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('Image generation failed:', e.message);
  }
}

/* ─── NARRATIVE TYPEWRITER ──────────────────── */
function clearNarrative() {
  document.getElementById('story-narrative').innerHTML = '';
  document.getElementById('story-choices').innerHTML = '';
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
function renderChoices(choices) {
  const container = document.getElementById('story-choices');
  container.innerHTML = '';
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

/* ─── STORY MENU ────────────────────────────── */
function closeStoryMenu() {
  document.getElementById('story-menu-overlay').classList.add('hidden');
}

function openStoryMenu() {
  const { era, faction, role, premise } = state.setup;
  const info = [
    `Ère: ${ERAS.find(e=>e.id===era)?.name||era}`,
    `Faction: ${FACTIONS.find(f=>f.id===faction)?.name||faction}`,
    `Rôle: ${ROLES.find(r=>r.id===role)?.name||role}`,
    `Tour: ${state.turn}`
  ].join('<br>');
  document.getElementById('overlay-story-info').innerHTML = info;
  document.getElementById('story-menu-overlay').classList.remove('hidden');
}

/* ─── EVENT LISTENERS ───────────────────────── */
function setupEventListeners() {
  // API Key input
  const keyInput = document.getElementById('api-key-input');
  keyInput.addEventListener('input', () => {
    document.getElementById('btn-test-api').disabled = keyInput.value.trim().length < 10;
    document.getElementById('api-error').classList.add('hidden');
  });

  // Toggle key visibility
  document.getElementById('toggle-key-visibility').addEventListener('click', () => {
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
  });

  // Test API button
  document.getElementById('btn-test-api').addEventListener('click', async () => {
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
      await testApiConnection(state.provider, state.apiKey);

      if (document.getElementById('save-key-checkbox').checked) {
        localStorage.setItem(`sw_key_${state.provider}`, state.apiKey);
      } else {
        localStorage.removeItem(`sw_key_${state.provider}`);
      }

      await populateModels();
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
  document.getElementById('btn-confirm-model').addEventListener('click', () => {
    goTo('screen-image');
  });

  // Skip image
  document.getElementById('btn-skip-image').addEventListener('click', () => {
    state.imgProvider = 'none';
    goTo('screen-setup');
  });

  // Confirm image provider
  document.getElementById('btn-confirm-image').addEventListener('click', () => {
    const imgKey = document.getElementById('img-api-key').value.trim();
    if (imgKey) state.imgApiKey = imgKey;
    goTo('screen-setup');
  });

  // Start story
  document.getElementById('btn-start-story').addEventListener('click', startStory);

  // Story menu button
  document.getElementById('btn-menu-story').addEventListener('click', openStoryMenu);

  // Restart
  document.getElementById('btn-restart').addEventListener('click', () => {
    closeStoryMenu();
    document.getElementById('story-image-container').classList.add('hidden');
    goTo('screen-setup');
  });

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
  // Auto-select saved provider if any
  for (const id of Object.keys(LLM_PROVIDERS)) {
    if (localStorage.getItem(`sw_key_${id}`)) {
      // Don't auto-select to avoid confusion, just hint
      break;
    }
  }
}
