/* ═══════════════════════════════════════════════
   config.js — API providers & story data
═══════════════════════════════════════════════ */

/* ─── LLM PROVIDERS ─────────────────────────── */
const LLM_PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: 'Accès à +100 modèles',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    dynamicModels: true,
    models: [],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Star Wars Interactive Story',
      'Content-Type': 'application/json'
    }),
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><circle cx="18" cy="18" r="16" stroke="#FFE81F" stroke-width="1.5" fill="none"/><path d="M10 18h16M18 10l8 8-8 8" stroke="#FFE81F" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT-4o, GPT-4…',
    baseUrl: 'https://api.openai.com/v1',
    dynamicModels: false,
    models: [
      { id: 'gpt-4o',        name: 'GPT-4o',        desc: 'Plus capable, multimodal' },
      { id: 'gpt-4o-mini',   name: 'GPT-4o Mini',   desc: 'Rapide et économique' },
      { id: 'gpt-4-turbo',   name: 'GPT-4 Turbo',   desc: 'Contexte 128k' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: 'Très rapide, économique' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><rect x="6" y="6" width="24" height="24" rx="4" stroke="#FFE81F" stroke-width="1.5" fill="none"/><path d="M12 18h12M12 13h12M12 23h8" stroke="#FFE81F" stroke-width="1.5" stroke-linecap="round"/></svg>`
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    desc: 'Claude Opus, Sonnet…',
    baseUrl: 'https://api.anthropic.com/v1',
    dynamicModels: false,
    models: [
      { id: 'claude-opus-4-6',            name: 'Claude Opus 4.6',    desc: 'Le plus puissant' },
      { id: 'claude-sonnet-4-6',          name: 'Claude Sonnet 4.6',  desc: 'Équilibre puissance/vitesse' },
      { id: 'claude-haiku-4-5-20251001',  name: 'Claude Haiku 4.5',   desc: 'Ultra-rapide' },
    ],
    getHeaders: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json'
    }),
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><path d="M18 4l14 28H4L18 4z" stroke="#FFE81F" stroke-width="1.5" fill="none"/><path d="M18 14v8M18 26v1" stroke="#FFE81F" stroke-width="1.5" stroke-linecap="round"/></svg>`
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    desc: 'Modèles européens',
    baseUrl: 'https://api.mistral.ai/v1',
    dynamicModels: false,
    models: [
      { id: 'mistral-large-latest',  name: 'Mistral Large',  desc: 'Modèle phare' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', desc: 'Équilibré' },
      { id: 'mistral-small-latest',  name: 'Mistral Small',  desc: 'Rapide et léger' },
      { id: 'open-mixtral-8x7b',     name: 'Mixtral 8x7B',  desc: 'Open source, MoE' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><path d="M6 12h6v12H6zM15 6h6v24h-6zM24 12h6v12h-6z" stroke="#FFE81F" stroke-width="1.5" fill="none"/></svg>`
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    desc: 'Inférence ultra-rapide',
    baseUrl: 'https://api.groq.com/openai/v1',
    dynamicModels: false,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B',    desc: 'Puissant et rapide' },
      { id: 'llama-3.1-8b-instant',    name: 'LLaMA 3.1 8B',     desc: 'Instantané' },
      { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B 32k', desc: 'Long contexte' },
      { id: 'gemma2-9b-it',            name: 'Gemma 2 9B',       desc: 'Google, efficace' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><circle cx="18" cy="18" r="14" stroke="#FFE81F" stroke-width="1.5" fill="none"/><path d="M12 18c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" stroke="#FFE81F" stroke-width="1.5" fill="none"/><circle cx="18" cy="18" r="2" fill="#FFE81F"/></svg>`
  },
  together: {
    id: 'together',
    name: 'Together AI',
    desc: 'Open source, rapide',
    baseUrl: 'https://api.together.xyz/v1',
    dynamicModels: false,
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'LLaMA 3.3 70B Turbo', desc: 'Puissant, optimisé' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'LLaMA 3.1 8B Turbo', desc: 'Très rapide' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', desc: 'Open source' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><path d="M18 4 L32 12 L32 24 L18 32 L4 24 L4 12 Z" stroke="#FFE81F" stroke-width="1.5" fill="none"/><path d="M18 10 L26 15 L26 23 L18 28 L10 23 L10 15 Z" stroke="#FFE81F" stroke-width="0.8" fill="none"/></svg>`
  }
};

/* ─── IMAGE PROVIDERS ────────────────────────── */
const IMAGE_PROVIDERS = {
  none: {
    id: 'none',
    name: 'Aucun',
    desc: 'Pas d\'images',
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><circle cx="18" cy="18" r="14" stroke="#aaa" stroke-width="1.5" fill="none"/><line x1="10" y1="10" x2="26" y2="26" stroke="#aaa" stroke-width="1.5"/></svg>`
  },
  together_img: {
    id: 'together_img',
    name: 'Together AI',
    desc: 'FLUX, SDXL…',
    endpoint: 'https://api.together.xyz/v1/images/generations',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell', desc: 'Rapide & haute qualité' },
      { id: 'black-forest-labs/FLUX.1-dev',     name: 'FLUX.1 Dev',     desc: 'Meilleure qualité' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL 1.0', desc: 'Classique' },
    ],
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><rect x="5" y="8" width="26" height="20" rx="3" stroke="#4FC3F7" stroke-width="1.5" fill="none"/><circle cx="12" cy="15" r="3" stroke="#4FC3F7" stroke-width="1.2" fill="none"/><path d="M5 24l7-6 5 5 4-4 10 7" stroke="#4FC3F7" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`
  },
  openai_img: {
    id: 'openai_img',
    name: 'DALL-E (OpenAI)',
    desc: 'DALL-E 3 & 2',
    endpoint: 'https://api.openai.com/v1/images/generations',
    models: [
      { id: 'dall-e-3', name: 'DALL-E 3', desc: 'Meilleure qualité' },
      { id: 'dall-e-2', name: 'DALL-E 2', desc: 'Plus économique' },
    ],
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><polygon points="18,4 30,11 30,25 18,32 6,25 6,11" stroke="#4FC3F7" stroke-width="1.5" fill="none"/><circle cx="18" cy="18" r="5" stroke="#4FC3F7" stroke-width="1.2" fill="none"/></svg>`
  },
  stability: {
    id: 'stability',
    name: 'Stability AI',
    desc: 'Stable Diffusion',
    endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
    models: [
      { id: 'ultra',  name: 'SD Ultra',  desc: 'Ultra qualité' },
      { id: 'core',   name: 'SD Core',   desc: 'Rapide' },
    ],
    icon: `<svg viewBox="0 0 36 36" class="provider-icon"><path d="M18 4 L32 28 L4 28 Z" stroke="#4FC3F7" stroke-width="1.5" fill="none"/><path d="M18 12 L26 24 L10 24 Z" stroke="#4FC3F7" stroke-width="0.8" fill="none"/></svg>`
  }
};

/* ─── STORY DATA ─────────────────────────────── */
const ERAS = [
  { id: 'old_republic',  name: 'Ancienne République', years: '25 000 – 1 000 av. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="18" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="10" stroke="currentColor" stroke-width="1" fill="none" stroke-dasharray="3 2"/><circle cx="22" cy="22" r="3" fill="currentColor"/><line x1="22" y1="4" x2="22" y2="40" stroke="currentColor" stroke-width="0.8" opacity="0.4"/><line x1="4" y1="22" x2="40" y2="22" stroke="currentColor" stroke-width="0.8" opacity="0.4"/></svg>` },
  { id: 'clone_wars',    name: 'Guerres des Clones', years: '22 – 19 av. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 40,34 4,34" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="22,12 33,30 11,30" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.5"/><circle cx="22" cy="22" r="2" fill="currentColor"/></svg>` },
  { id: 'imperial',      name: 'Ère Impériale', years: '19 av. – 5 apr. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="18" stroke="currentColor" stroke-width="1.5" fill="none"/><g stroke="currentColor" stroke-width="1" fill="none">${Array.from({length:8},(_,i)=>`<line x1="22" y1="22" x2="${22+18*Math.cos(i*Math.PI/4)}" y2="${22+18*Math.sin(i*Math.PI/4)}"/>`).join('')}</g><circle cx="22" cy="22" r="5" stroke="currentColor" stroke-width="1" fill="none"/></svg>` },
  { id: 'new_republic',  name: 'Nouvelle République', years: '5 – 34 apr. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 26,16 40,16 29,24 33,38 22,30 11,38 15,24 4,16 18,16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>` },
  { id: 'first_order',   name: 'Premier Ordre', years: '34 apr. BY+',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="6" y="6" width="32" height="32" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="22" y1="6" x2="22" y2="38" stroke="currentColor" stroke-width="1"/><line x1="6" y1="22" x2="38" y2="22" stroke="currentColor" stroke-width="1"/></svg>` },
];

const FACTIONS = [
  { id: 'jedi',      name: 'Ordre Jedi',         sub: 'Gardiens de la paix', color: '#4FC3F7',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="16" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M22 6 C10 14 10 30 22 38 C34 30 34 14 22 6Z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="22" y1="6" x2="22" y2="38" stroke="currentColor" stroke-width="0.8"/><ellipse cx="22" cy="22" rx="6" ry="8" stroke="currentColor" stroke-width="1" fill="none"/></svg>` },
  { id: 'sith',      name: 'Ordre Sith',          sub: 'Maîtres des ténèbres', color: '#FF1744',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 25,19 40,22 25,25 22,40 19,25 4,22 19,19" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="5" stroke="currentColor" stroke-width="1" fill="none"/></svg>` },
  { id: 'empire',    name: 'Empire Galactique',   sub: 'Paix par l\'ordre', color: '#e0e0e0',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="17" stroke="currentColor" stroke-width="1.5" fill="none"/>${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;const x1=22+8*Math.cos(a);const y1=22+8*Math.sin(a);const x2=22+17*Math.cos(a);const y2=22+17*Math.sin(a);return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="1"/>`;}).join('')}<circle cx="22" cy="22" r="7" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>` },
  { id: 'rebels',    name: 'Alliance Rebelle',    sub: 'Espoir de la galaxie', color: '#FF6B35',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="17" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="22,8 24.5,17 34,17 26.5,22.5 29,32 22,26.5 15,32 17.5,22.5 10,17 19.5,17" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>` },
  { id: 'republic',  name: 'République Galactique', sub: 'Démocratie & justice', color: '#81D4FA',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="17" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="10" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="22" cy="22" r="3" fill="currentColor"/>${[0,60,120,180,240,300].map(deg=>{const r=deg*Math.PI/180;const x=22+10*Math.cos(r);const y=22+10*Math.sin(r);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="currentColor"/>`;}).join('')}</svg>` },
  { id: 'mandalore', name: 'Mandalorians',         sub: 'C\'est la voie', color: '#A5D6A7',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 6 L34 14 L34 26 C34 34 22 40 22 40 C22 40 10 34 10 26 L10 14 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 18 L22 14 L28 18" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="22" cy="24" r="3" stroke="currentColor" stroke-width="1" fill="none"/><line x1="22" y1="27" x2="22" y2="33" stroke="currentColor" stroke-width="1"/></svg>` },
  { id: 'hutt',      name: 'Cartel Hutt',          sub: 'Le crime paie', color: '#FFE082',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><ellipse cx="22" cy="26" rx="14" ry="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="16" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="14" y1="22" x2="30" y2="22" stroke="currentColor" stroke-width="0.8"/></svg>` },
  { id: 'neutral',   name: 'Indépendant',          sub: 'Libre de tout lien', color: '#bdbdbd',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="4 3"/><text x="22" y="27" text-anchor="middle" font-size="16" fill="currentColor" font-family="serif">?</text></svg>` },
];

const ROLES = [
  { id: 'jedi_knight',    name: 'Chevalier Jedi',      sub: 'Maître du Côté Lumineux',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><line x1="22" y1="8" x2="22" y2="36" stroke="#4FC3F7" stroke-width="3" stroke-linecap="round"/><rect x="14" y="30" width="16" height="4" rx="1" stroke="#888" stroke-width="1" fill="#555"/><ellipse cx="22" cy="8" rx="2" ry="4" fill="#4FC3F7" opacity="0.7"/></svg>` },
  { id: 'sith_apprentice', name: 'Apprenti Sith',      sub: 'Disciple des ténèbres',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><line x1="22" y1="8" x2="22" y2="36" stroke="#FF1744" stroke-width="3" stroke-linecap="round"/><rect x="14" y="30" width="16" height="4" rx="1" stroke="#888" stroke-width="1" fill="#555"/><line x1="16" y1="16" x2="28" y2="16" stroke="#FF1744" stroke-width="2"/></svg>` },
  { id: 'bounty_hunter',  name: 'Chasseur de primes', sub: 'Contrats & crédits',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 6 L36 16 L36 28 L22 38 L8 28 L8 16 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="4" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="22" y1="18" x2="22" y2="6" stroke="currentColor" stroke-width="1"/></svg>` },
  { id: 'smuggler',       name: 'Contrebandier',      sub: 'Vite fait, bien fait',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M8 26 L16 12 L36 12 L36 30 L8 30 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M36 20 L40 20 L40 26 L36 26" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="16" cy="32" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="28" cy="32" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>` },
  { id: 'clone_trooper',  name: 'Soldat Clone',       sub: 'Exécuteur de l\'Ordre',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M14 10 L30 10 L32 18 L28 22 L28 30 L16 30 L16 22 L12 18 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="17" y1="18" x2="27" y2="18" stroke="currentColor" stroke-width="0.8"/><rect x="18" y="22" width="8" height="4" stroke="currentColor" stroke-width="0.8" fill="none"/></svg>` },
  { id: 'senator',        name: 'Sénateur',           sub: 'Pouvoir politique',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="16" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 38 C10 28 34 28 34 38" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="15" y1="38" x2="29" y2="38" stroke="currentColor" stroke-width="1.5"/></svg>` },
  { id: 'pilot',          name: 'As de l\'Espace',    sub: 'Né pour voler',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 10 L36 28 L22 24 L8 28 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 24 L16 36 L22 32 L28 36 L28 24" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>` },
  { id: 'droid',          name: 'Droïde Avancé',      sub: 'Intelligence mécanique',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="14" y="8" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="16" y="20" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="19" cy="14" r="2" fill="currentColor"/><circle cx="25" cy="14" r="2" fill="currentColor"/><line x1="10" y1="24" x2="14" y2="24" stroke="currentColor" stroke-width="1.5"/><line x1="30" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="1.5"/></svg>` },
];

const PREMISES = [
  { id: 'chosen',   name: 'L\'Élu',          sub: 'Une prophétie ancienne vous désigne', color: '#FFE81F',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 26,16 40,20 26,24 22,38 18,24 4,20 18,16" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="20" r="3" fill="currentColor"/></svg>` },
  { id: 'outcast',  name: 'Le Banni',        sub: 'Trahi, seul, et déterminé à survivre', color: '#CE93D8',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 8 L22 36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 2"/><circle cx="22" cy="22" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="14" y1="14" x2="30" y2="30" stroke="currentColor" stroke-width="1.5"/></svg>` },
  { id: 'heist',    name: 'Le Braquage',     sub: 'Un artefact que toute la galaxie veut', color: '#FFB74D',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="12" y="16" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M17 16 L17 12 C17 9 27 9 27 12 L27 16" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="24" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>` },
  { id: 'war',      name: 'La Guerre',       sub: 'Au cœur d\'une bataille décisive', color: '#EF5350',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M8 36 L22 8 L36 36" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="12" y1="28" x2="32" y2="28" stroke="currentColor" stroke-width="1"/><line x1="22" y1="8" x2="22" y2="36" stroke="currentColor" stroke-width="0.8" opacity="0.5"/></svg>` },
  { id: 'mystery',  name: 'Le Mystère',      sub: 'Un secret qui change tout ce que vous croyiez', color: '#80CBC4',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="16" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 18 C16 14 28 14 28 20 C28 24 22 24 22 28" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="22" cy="32" r="1.5" fill="currentColor"/></svg>` },
  { id: 'redemption', name: 'La Rédemption', sub: 'Racheter un passé sombre', color: '#AED581',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 6 C10 10 6 22 12 32 C16 38 22 40 22 40 C22 40 28 38 32 32 C38 22 34 10 22 6Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 22 L20 26 L28 18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
];
