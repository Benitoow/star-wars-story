/* ═══════════════════════════════════════════════
   config.js — API providers & story data
═══════════════════════════════════════════════ */

/* ─── REAL BRAND LOGOS (from Simple Icons + computed) ─── */
const ICONS = {
  // OpenAI — official Simple Icons path
  openai: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>`,

  // Anthropic — official Simple Icons path
  anthropic: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
  </svg>`,

  // Mistral AI — official Simple Icons path
  mistral: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z"/>
  </svg>`,

  // OpenRouter — official Simple Icons path
  openrouter: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"/>
  </svg>`,

  // Groq — stylized lightning bolt in a hexagon (speed/performance brand)
  groq: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke-linejoin="round"/>
    <path d="M13.5 7l-4 5h3.5l-2 5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  // Together AI — interconnected nodes (collaboration theme)
  together: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <circle cx="5" cy="12" r="2.5"/>
    <circle cx="19" cy="5" r="2.5"/>
    <circle cx="19" cy="19" r="2.5"/>
    <path d="M7.2 11.1L16.8 6.4M7.2 12.9L16.8 17.6M16.8 7.5v9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  // DALL-E / OpenAI Image
  dalle: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
    <path d="m3 16 5-5 4 4 3-3 6 6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Stability AI — stable diffusion triangle
  stability: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M12 2L2 20h20L12 2zm0 4.5l7.5 13.5h-15L12 6.5z" fill-rule="evenodd"/>
    <circle cx="12" cy="15" r="1.5"/>
  </svg>`,

  // Image/photo icon for None
  noimage: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <line x1="3" y1="3" x2="21" y2="21"/>
  </svg>`
};

/* ─── COMPUTED FACTION SVGs ─────────────────── */

// Galactic Empire — 12-petal crest
function _genEmpireSvg() {
  const petals = Array.from({length: 12}, (_, i) => {
    const a  = (i * 30 - 90) * Math.PI / 180;
    const a1 = (i * 30 - 90 - 8) * Math.PI / 180;
    const a2 = (i * 30 - 90 + 8) * Math.PI / 180;
    const ri = 6, ro = 17;
    return `<polygon points="${(22+ri*Math.cos(a1)).toFixed(2)},${(22+ri*Math.sin(a1)).toFixed(2)} ${(22+ri*Math.cos(a2)).toFixed(2)},${(22+ri*Math.sin(a2)).toFixed(2)} ${(22+ro*Math.cos(a)).toFixed(2)},${(22+ro*Math.sin(a)).toFixed(2)}" fill="currentColor"/>`;
  }).join('');
  return `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor"><circle cx="22" cy="22" r="4"/>${petals}</svg>`;
}

// Rebel Alliance — real Wikimedia path (viewBox 0 0 300 300)
const _rebelPath = `M7.42,145.986C9.185,99.193,32.899,56.035,76.25,27.516c0.128,0.048,1.251-0.361,0.738,0.61c-3.434,3.184-65.172,76.114-8.344,133.68c0,0,29.858,28.704,53.011,1.468c0,0,22.847-29.577-0.289-74.413c0,0-5.856-14.64-26.955-23.721l16.992-18.748c0,0,14.359,6.161,25.478,22.871c0,0,0.593-17.593-12.884-36.34l26.345-29.89l26.08,29.609c0,0-11.993,16.991-12.876,36.902c0,0,8.191-13.477,25.776-23.151l16.686,18.748c0,0-16.045,5.287-26.794,23.529c-9.242,16.902-16.357,53.05,0.416,75.223c0,0,18.772,26.618,51.792-1.571c0,0,60.712-54.399-6.226-133.048c0,0-3.658-3.233,0.449-1.476c29.586,21.54,65.012,49.946,68.67,120.837c-1.444,85.966-59.012,147.334-143.074,147.334C68.934,295.968,4.95,227.283,7.42,145.986`;

// Jedi Order — ring + blade + wings
const _jediSvg = `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
  <g transform="translate(22,22)">
    <path d="M0,-17 A17,17 0 1 1 -0.01,-17 Z M0,-14 A14,14 0 1 0 0.01,-14 Z" fill-rule="evenodd"/>
    <path d="M0,-12 L2.5,-2 L0,3 L-2.5,-2 Z"/>
    <path d="M-1.5,1 C-5,0 -10,-1 -13,-4 C-15,-6.5 -14,-10 -11,-11 C-9,-11.5 -7,-10.5 -6,-9 C-5,-7.5 -5.5,-6 -4,-5 C-2.5,-4 -1,-3.5 -0.5,-2 Z"/>
    <path d="M1.5,1 C5,0 10,-1 13,-4 C15,-6.5 14,-10 11,-11 C9,-11.5 7,-10.5 6,-9 C5,-7.5 5.5,-6 4,-5 C2.5,-4 1,-3.5 0.5,-2 Z"/>
  </g>
</svg>`;

// Sith — 8-pointed double-star in ring
const _sithSvg = `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
  <g transform="translate(22,22)">
    <path d="M0,-17 A17,17 0 1 1 -0.01,-17 Z M0,-14 A14,14 0 1 0 0.01,-14 Z" fill-rule="evenodd"/>
    <path d="M0,-13 L2,-2 L13,0 L2,2 L0,13 L-2,2 L-13,0 L-2,-2 Z"/>
    <path d="M0,-13 L2,-2 L13,0 L2,2 L0,13 L-2,2 L-13,0 L-2,-2 Z" transform="rotate(45)"/>
  </g>
</svg>`;

// Mandalorian — T-visor helmet silhouette
const _mandoSvg = `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
  <g transform="translate(22,22)">
    <path fill-rule="evenodd" d="
      M0,-18 C8,-18 15,-13 17,-6 L17,4 C17,8 15,11 12,13 L8,16 L-8,16 L-12,13 C-15,11 -17,8 -17,4 L-17,-6 C-15,-13 -8,-18 0,-18 Z
      M-13,0 L13,0 L13,-4 L4,-4 L4,-10 L-4,-10 L-4,-4 L-13,-4 Z
    "/>
  </g>
</svg>`;

// Republic — 6-dot circular seal
function _genRepublicSvg() {
  const dots = [0,60,120,180,240,300].map(deg => {
    const r = deg * Math.PI / 180;
    const x = (22 + 10 * Math.cos(r)).toFixed(2);
    const y = (22 + 10 * Math.sin(r)).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="2.5" fill="currentColor"/>`;
  }).join('');
  return `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="18" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="10" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="22" cy="22" r="3" fill="currentColor"/>${dots}</svg>`;
}

/* ─── LLM PROVIDERS ─────────────────────────── */
const LLM_PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: '+100 modèles',
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
    icon: ICONS.openrouter
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT-4o, o3…',
    baseUrl: 'https://api.openai.com/v1',
    dynamicModels: false,
    models: [
      { id: 'gpt-4o',        name: 'GPT-4o',        desc: 'Multimodal, plus capable' },
      { id: 'gpt-4o-mini',   name: 'GPT-4o Mini',   desc: 'Rapide & économique' },
      { id: 'gpt-4-turbo',   name: 'GPT-4 Turbo',   desc: 'Contexte 128k tokens' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: 'Ultra-rapide, léger' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: ICONS.openai
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    desc: 'Claude Opus, Sonnet…',
    baseUrl: 'https://api.anthropic.com/v1',
    dynamicModels: false,
    models: [
      { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',   desc: 'Le plus puissant' },
      { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6', desc: 'Équilibre puissance/vitesse' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',  desc: 'Ultra-rapide' },
    ],
    getHeaders: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json'
    }),
    icon: ICONS.anthropic
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    desc: 'Modèles européens',
    baseUrl: 'https://api.mistral.ai/v1',
    dynamicModels: false,
    models: [
      { id: 'mistral-large-latest',  name: 'Mistral Large',    desc: 'Modèle phare' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium',   desc: 'Équilibré' },
      { id: 'mistral-small-latest',  name: 'Mistral Small',    desc: 'Rapide et léger' },
      { id: 'open-mixtral-8x7b',     name: 'Mixtral 8x7B',    desc: 'Open source MoE' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: ICONS.mistral
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    desc: 'Inférence ultra-rapide',
    baseUrl: 'https://api.groq.com/openai/v1',
    dynamicModels: false,
    models: [
      { id: 'llama-3.3-70b-versatile',  name: 'LLaMA 3.3 70B',   desc: 'Puissant & rapide' },
      { id: 'llama-3.1-8b-instant',     name: 'LLaMA 3.1 8B',    desc: 'Instantané' },
      { id: 'mixtral-8x7b-32768',       name: 'Mixtral 8x7B 32k', desc: 'Long contexte' },
      { id: 'gemma2-9b-it',             name: 'Gemma 2 9B',      desc: 'Google, efficace' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: ICONS.groq
  },
  together: {
    id: 'together',
    name: 'Together AI',
    desc: 'Open source, rapide',
    baseUrl: 'https://api.together.xyz/v1',
    dynamicModels: false,
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',       name: 'LLaMA 3.3 70B Turbo', desc: 'Puissant, optimisé' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',   name: 'LLaMA 3.1 8B Turbo',  desc: 'Très rapide' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',          name: 'Mixtral 8x7B',        desc: 'Open source' },
    ],
    getHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    icon: ICONS.together
  }
};

/* ─── IMAGE PROVIDERS ────────────────────────── */
const IMAGE_PROVIDERS = {
  none: {
    id: 'none',
    name: 'Aucun',
    desc: 'Texte uniquement',
    icon: ICONS.noimage
  },
  openrouter_img: {
    id: 'openrouter_img',
    name: 'OpenRouter',
    desc: 'FLUX, DALL-E, Imagen…',
    endpoint: 'https://openrouter.ai/api/v1/images/generations',
    models: [
      { id: 'black-forest-labs/flux-1.1-pro',          name: 'FLUX 1.1 Pro',        desc: 'Haute qualité, rapide' },
      { id: 'black-forest-labs/flux-1-schnell',        name: 'FLUX Schnell',        desc: 'Ultra-rapide' },
      { id: 'openai/dall-e-3',                         name: 'DALL-E 3',            desc: 'Précis et créatif' },
      { id: 'google/imagen-3.0-generate-002',          name: 'Imagen 3',            desc: 'Google DeepMind' },
      { id: 'recraft-ai/recraft-v3',                   name: 'Recraft V3',          desc: 'Style illustration' },
    ],
    icon: ICONS.openrouter
  },
  together_img: {
    id: 'together_img',
    name: 'Together AI',
    desc: 'FLUX, SDXL…',
    endpoint: 'https://api.together.xyz/v1/images/generations',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell', desc: 'Rapide & haute qualité' },
      { id: 'black-forest-labs/FLUX.1-dev',     name: 'FLUX.1 Dev',     desc: 'Meilleure qualité' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL 1.0', desc: 'Classique éprouvé' },
    ],
    icon: ICONS.together
  },
  openai_img: {
    id: 'openai_img',
    name: 'DALL-E',
    desc: 'OpenAI DALL-E 3',
    endpoint: 'https://api.openai.com/v1/images/generations',
    models: [
      { id: 'dall-e-3', name: 'DALL-E 3', desc: 'Meilleure qualité' },
      { id: 'dall-e-2', name: 'DALL-E 2', desc: 'Plus économique' },
    ],
    icon: ICONS.dalle
  },
  stability: {
    id: 'stability',
    name: 'Stability AI',
    desc: 'Stable Diffusion',
    endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
    models: [
      { id: 'ultra', name: 'SD Ultra', desc: 'Qualité maximale' },
      { id: 'core',  name: 'SD Core',  desc: 'Rapide' },
    ],
    icon: ICONS.stability
  }
};

/* ─── STORY DATA ─────────────────────────────── */
const ERAS = [
  { id: 'old_republic',  name: 'Ancienne République', years: '25 000 – 1 000 av. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="18" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="10" stroke="currentColor" stroke-width="1" fill="none" stroke-dasharray="3 2"/><circle cx="22" cy="22" r="3" fill="currentColor"/><line x1="22" y1="4" x2="22" y2="40" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><line x1="4" y1="22" x2="40" y2="22" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><line x1="9.4" y1="9.4" x2="34.6" y2="34.6" stroke="currentColor" stroke-width="0.8" opacity="0.3"/><line x1="34.6" y1="9.4" x2="9.4" y2="34.6" stroke="currentColor" stroke-width="0.8" opacity="0.3"/></svg>` },
  { id: 'clone_wars',    name: 'Guerres des Clones', years: '22 – 19 av. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 40,34 4,34" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="22,12 33,30 11,30" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.5"/><path d="M19 24 L22 18 L25 24" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="22" cy="27" r="1.5" fill="currentColor"/></svg>` },
  { id: 'imperial',      name: 'Ère Impériale', years: '19 av. – 5 apr. BY',
    svg: _genEmpireSvg() },
  { id: 'new_republic',  name: 'Nouvelle République', years: '5 – 34 apr. BY',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 25.5,14.5 37,14.5 27.5,21 31,32 22,26 13,32 16.5,21 7,14.5 18.5,14.5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>` },
  { id: 'first_order',   name: 'Premier Ordre', years: '34 apr. BY+',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="5" y="5" width="34" height="34" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="22" y1="5" x2="22" y2="39" stroke="currentColor" stroke-width="1"/><line x1="5" y1="22" x2="39" y2="22" stroke="currentColor" stroke-width="1"/><rect x="14" y="14" width="16" height="16" stroke="currentColor" stroke-width="0.8" fill="none"/></svg>` },
];

const FACTIONS = [
  { id: 'jedi',      name: 'Ordre Jedi',           sub: 'Gardiens de la paix',    color: '#4FC3F7', svg: _jediSvg },
  { id: 'sith',      name: 'Ordre Sith',            sub: 'Maîtres des ténèbres',   color: '#FF1744', svg: _sithSvg },
  { id: 'empire',    name: 'Empire Galactique',     sub: 'Paix par l\'ordre',       color: '#e0e0e0',
    svg: _genEmpireSvg() },
  { id: 'rebels',    name: 'Alliance Rebelle',      sub: 'Espoir de la galaxie',   color: '#FF6B35',
    svg: `<svg viewBox="0 0 300 300" class="choice-svg"><path d="${_rebelPath}" fill="currentColor"/></svg>` },
  { id: 'republic',  name: 'République Galactique', sub: 'Démocratie & justice',   color: '#81D4FA',
    svg: _genRepublicSvg() },
  { id: 'mandalore', name: 'Mandalorians',          sub: 'C\'est la voie',          color: '#A5D6A7', svg: _mandoSvg },
  { id: 'hutt',      name: 'Cartel Hutt',           sub: 'Le crime paie',          color: '#FFE082',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><ellipse cx="22" cy="27" rx="14" ry="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="15" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="14" y1="22" x2="30" y2="22" stroke="currentColor" stroke-width="0.8"/><circle cx="18" cy="13" r="1.5" fill="currentColor"/><circle cx="26" cy="13" r="1.5" fill="currentColor"/></svg>` },
  { id: 'neutral',   name: 'Indépendant',           sub: 'Libre de tout lien',     color: '#bdbdbd',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="5 3"/><text x="22" y="27" text-anchor="middle" font-size="17" fill="currentColor" font-family="serif" font-weight="bold">?</text></svg>` },
];

const ROLES = [
  { id: 'jedi_knight',    name: 'Chevalier Jedi',     sub: 'Maître du Côté Lumineux',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="19" y="28" width="6" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="17" y="26" width="10" height="3" rx="1" stroke="currentColor" stroke-width="1" fill="none"/><line x1="22" y1="8" x2="22" y2="26" stroke="#4FC3F7" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="22" cy="8" rx="1.5" ry="3" fill="#4FC3F7" opacity="0.8"/></svg>` },
  { id: 'sith_apprentice', name: 'Apprenti Sith',     sub: 'Disciple des ténèbres',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="19" y="28" width="6" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="17" y="26" width="10" height="3" rx="1" stroke="currentColor" stroke-width="1" fill="none"/><line x1="22" y1="8" x2="22" y2="26" stroke="#FF1744" stroke-width="2.5" stroke-linecap="round"/><line x1="18" y1="16" x2="26" y2="16" stroke="#FF1744" stroke-width="1.5"/><ellipse cx="22" cy="8" rx="1.5" ry="3" fill="#FF1744" opacity="0.8"/></svg>` },
  { id: 'bounty_hunter',  name: 'Chasseur de primes', sub: 'Contrats & crédits',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 6 L36 16 L36 28 L22 38 L8 28 L8 16 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="22" r="4" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="22" y1="4" x2="22" y2="18" stroke="currentColor" stroke-width="1"/><circle cx="22" cy="4" r="1.5" fill="currentColor"/></svg>` },
  { id: 'smuggler',       name: 'Contrebandier',      sub: 'Vite fait, bien fait',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M8 28 L16 14 L36 14 L36 30 L8 30 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M36 20 L40 20 L40 26 L36 26" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="16" cy="33" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="28" cy="33" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M22 14 L20 8 L26 8 L24 14" stroke="currentColor" stroke-width="1" fill="none"/></svg>` },
  { id: 'clone_trooper',  name: 'Soldat Clone',       sub: 'Exécuteur de l\'Ordre',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M14 10 L30 10 L32 18 L28 22 L28 30 L16 30 L16 22 L12 18 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 17 L28 17" stroke="currentColor" stroke-width="0.8"/><path d="M17 20 L27 20" stroke="currentColor" stroke-width="0.8"/><rect x="18" y="22" width="8" height="4" rx="1" stroke="currentColor" stroke-width="0.8" fill="none"/></svg>` },
  { id: 'senator',        name: 'Sénateur',           sub: 'Pouvoir politique',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="14" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 38 C10 28 34 28 34 38" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="13" y1="38" x2="31" y2="38" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/><circle cx="27" cy="12" r="1.5" fill="currentColor"/></svg>` },
  { id: 'pilot',          name: 'As de l\'Espace',    sub: 'Né pour voler',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 8 L38 30 L22 25 L6 30 Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 25 L16 36 L22 32 L28 36 L28 25" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M8 26 L4 32" stroke="currentColor" stroke-width="1"/><path d="M36 26 L40 32" stroke="currentColor" stroke-width="1"/></svg>` },
  { id: 'droid',          name: 'Droïde Avancé',      sub: 'Intelligence mécanique',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="14" y="8" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="16" y="20" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="19" cy="14" r="2" fill="currentColor"/><circle cx="25" cy="14" r="2" fill="currentColor"/><rect x="20" y="25" width="4" height="6" rx="1" stroke="currentColor" stroke-width="0.8" fill="none"/><line x1="10" y1="24" x2="14" y2="24" stroke="currentColor" stroke-width="1.5"/><line x1="30" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="1.5"/></svg>` },
];

const PREMISES = [
  { id: 'chosen',     name: 'L\'Élu',          sub: 'Une prophétie ancienne vous désigne', color: '#FFE81F',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><polygon points="22,4 25.8,15.2 38,15.2 28.1,22 31.9,33.2 22,26.4 12.1,33.2 15.9,22 6,15.2 18.2,15.2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="18" r="3" fill="currentColor"/></svg>` },
  { id: 'outcast',    name: 'Le Banni',         sub: 'Trahi, seul, et déterminé', color: '#CE93D8',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="14" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="12" x2="32" y2="32" stroke="currentColor" stroke-width="2"/><path d="M22 8 L22 36" stroke="currentColor" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.5"/></svg>` },
  { id: 'heist',      name: 'Le Braquage',      sub: 'Un artefact que tous convoitent', color: '#FFB74D',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><rect x="12" y="18" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M17 18 L17 13 C17 9.7 27 9.7 27 13 L27 18" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="26" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="22" y1="29" x2="22" y2="31" stroke="currentColor" stroke-width="1.5"/></svg>` },
  { id: 'war',        name: 'La Guerre',        sub: 'Au cœur d\'une bataille décisive', color: '#EF5350',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M8 36 L22 8 L36 36" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="11.5" y1="28" x2="32.5" y2="28" stroke="currentColor" stroke-width="1"/><line x1="15" y1="36" x2="10" y2="36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="29" y1="36" x2="34" y2="36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>` },
  { id: 'mystery',    name: 'Le Mystère',       sub: 'Un secret qui change tout', color: '#80CBC4',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><circle cx="22" cy="22" r="16" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 18 C16 14 28 14 28 20 C28 24 22 24 22 28" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="22" cy="33" r="2" fill="currentColor"/></svg>` },
  { id: 'redemption', name: 'La Rédemption',    sub: 'Racheter un passé sombre', color: '#AED581',
    svg: `<svg viewBox="0 0 44 44" class="choice-svg"><path d="M22 6 C10 10 6 22 12 32 C16 38 22 40 22 40 C22 40 28 38 32 32 C38 22 34 10 22 6Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M15 22 L20 27 L29 17" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
];
