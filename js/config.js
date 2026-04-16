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

  // Groq — logo officiel Grok AI (xAI)
  groq: `<svg viewBox="0 0 512 492" class="provider-icon" fill="currentColor">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M197.76 315.52l170.197-125.803c8.342-6.186 20.267-3.776 24.256 5.803 20.907 50.539 11.563 111.253-30.08 152.939-41.621 41.685-99.562 50.816-152.512 29.994l-57.834 26.816c82.965 56.768 183.701 42.731 246.656-20.33 49.941-50.006 65.408-118.166 50.944-179.627l.128.149c-20.971-90.282 5.162-126.378 58.666-200.17 1.28-1.75 2.56-3.499 3.819-5.291l-70.421 70.507v-.214L197.76 315.52m-35.072 30.528c-59.563-56.96-49.28-145.088 1.515-195.926 37.568-37.61 99.136-52.97 152.874-30.4l57.707-26.666a166.554 166.554 0 00-39.019-21.334 191.467 191.467 0 00-208.042 41.942c-54.038 54.101-71.04 137.301-41.856 208.298 21.802 53.056-13.931 90.582-49.92 128.47C23.104 463.915 10.304 477.333 0 491.541l162.56-145.386"/>
  </svg>`,

  // Together AI — logo officiel (3 cercles en triangle)
  together: `<svg viewBox="0 0 100 100" class="provider-icon" fill="currentColor">
    <circle cx="50" cy="18" r="18"/>
    <circle cx="18" cy="74" r="18" opacity="0.45"/>
    <circle cx="82" cy="74" r="18" opacity="0.45"/>
  </svg>`,

  // DALL-E / OpenAI Image
  dalle: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
    <path d="m3 16 5-5 4 4 3-3 6 6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Stability AI — triangle SD
  stability: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M12 2L2 20h20L12 2zm0 4.5l7.5 13.5h-15L12 6.5z" fill-rule="evenodd"/>
    <circle cx="12" cy="15" r="1.5"/>
  </svg>`,

  // fal.ai — F stylisé avec accent vitesse
  fal: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 4h9M5 4v16M5 12h7" />
    <path d="M16 14l3 3-3 3" stroke-width="1.4"/>
    <path d="M14 17h5" />
  </svg>`,

  // Image/photo icon for None
  noimage: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <line x1="3" y1="3" x2="21" y2="21"/>
  </svg>`
};

/* ─── OFFICIAL FACTION & ERA SVGs ───────────── */

const _assetChoiceSvg = (path) => `<span class="choice-svg choice-mask" aria-hidden="true" style="--choice-mask: url('${path}')"></span>`;

const _languageSvg = `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="22" cy="22" r="16"/>
  <path d="M6 22h32"/>
  <path d="M22 6c4.8 4.2 7.4 9.8 7.4 16s-2.6 11.8-7.4 16c-4.8-4.2-7.4-9.8-7.4-16S17.2 10.2 22 6z"/>
  <path d="M11 13c3.4 1.9 7.2 2.9 11 2.9s7.6-1 11-2.9"/>
  <path d="M11 31c3.4-1.9 7.2-2.9 11-2.9s7.6 1 11 2.9"/>
</svg>`;

// Galactic Empire — crest impérial 12 pétales
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

// Rebel Alliance — symbole officiel (Font Awesome 5 brands/rebel)
const _rebelSvg = `<svg viewBox="0 0 512 512" class="choice-svg" fill="currentColor">
  <path d="M256.5 504C117.2 504 9 387.8 13.2 249.9 16 170.7 56.4 97.7 129.7 49.5c.3 0 1.9-.6 1.1.8-5.8 5.5-111.3 129.8-14.1 226.4 49.8 49.5 90 2.5 90 2.5 38.5-50.1-.6-125.9-.6-125.9-10-24.9-45.7-40.1-45.7-40.1l28.8-31.8c24.4 10.5 43.2 38.7 43.2 38.7.8-29.6-21.9-61.4-21.9-61.4L255.1 8l44.3 50.1c-20.5 28.8-21.9 62.6-21.9 62.6 13.8-23 43.5-39.3 43.5-39.3l28.5 31.8c-27.4 8.9-45.4 39.9-45.4 39.9-15.8 28.5-27.1 89.4.6 127.3 32.4 44.6 87.7-2.8 87.7-2.8 102.7-91.9-10.5-225-10.5-225-6.1-5.5.8-2.8.8-2.8 50.1 36.5 114.6 84.4 116.2 204.8C500.9 400.2 399 504 256.5 504z"/>
</svg>`;

// Jedi Order — symbole officiel (svgrepo jedi-order)
const _jediSvg = `<svg viewBox="0 0 32 32" class="choice-svg" fill="currentColor">
  <path d="M15.486 3s-.312 11.95-.441 16.854l-1.752-2.56 1.127 3.095-3.492.508 3.492.508-1.35 2.644 1.924-2.02c-.1 3.839-.123 4.781-.123 4.781s-8.613-4-3.826-12.838c0 0-5.97-6.59-.562-10.64 0 0-9.233 5.575-3.375 15.148 0 0-4.843-4.73-2.31-9.512 0 0-4.39 6.192.961 13.004 0 0-1.462-.897-2.756-4.334 0 0 .942 10.226 12.385 10.36l.229-.001C27.05 27.866 28 17.64 28 17.64c-1.317 3.431-2.783 4.334-2.783 4.334 5.35-6.812.96-13.004.96-13.004 2.532 4.787-2.311 9.512-2.311 9.512 5.858-9.566-3.375-15.148-3.375-15.148 5.406 4.056-.562 10.64-.562 10.64 4.787 8.837-3.826 12.838-3.826 12.838s-.022-.931-.123-4.781l1.784 1.826-1.35-2.645 3.494-.508-3.494-.508 1.127-3.095-1.752 2.561C15.803 14.96 15.492 3.1 15.486 3z"/>
</svg>`;

// Sith Order — symbole officiel (svgrepo starwars-sith)
const _sithSvg = `<svg viewBox="0 0 76 76" class="choice-svg" fill="currentColor">
  <path d="M30.351 23.395L38.017 19l7.662 4.424c-.28.47-.56.94-.845 1.407L38.013 20.907c-2.272 1.309-4.544 2.618-6.819 3.922l-.843-1.434zm2.928 2.553l4.703-2.932 4.709 2.93-.471.753-2.366-1.368c-.254 2.375-.524 4.749-.771 7.124 1.053.616 2.112 1.223 3.168 1.835l5.784-4.23-2.364-1.37c.138-.26.27-.526.41-.784 1.629.875 3.262 1.743 4.89 2.62l-.187 5.547-.879-.033v-2.737l-6.562 2.894v3.637l6.562 2.893v-2.736l.878-.031c.065 1.85.128 3.7.186 5.55l-4.89 2.616c-.134-.263-.275-.524-.407-.787l2.364-1.37-5.785-4.261-3.173 1.835.807 7.154 2.367-1.368.47.752-4.674 2.93-4.74-2.931.472-.752 2.395 1.369.774-7.157c.014-.037-.03-.046-.051-.06l-3.087-1.71-5.815 4.26 2.365 1.4-.44.784c-1.62-.872-3.242-1.742-4.86-2.619.051-1.849.1-3.698.155-5.547l.904.032v2.74l6.568-2.897-.001-3.667-6.567-2.895v2.738l-.904.033a1094.6 1094.6 0 01-.148-5.547l4.858-2.647.44.784-2.365 1.37 5.754 4.23c1.066-.613 2.135-1.22 3.201-1.835-.247-2.374-.518-4.748-.771-7.123l-2.395 1.368c-.16-.249-.314-.501-.471-.751zM21.546 28.494c2.553-1.47 5.105-2.943 7.655-4.419.288.465.567.937.845 1.408l-6.85 3.955-.001 7.877-1.65.001c.002-2.94-.002-5.882.001-8.822zm24.437-2.97l.842-1.439c2.545 1.472 5.084 2.95 7.629 4.42.005 2.94.001 5.88.002 8.82l-1.65.001-.001-7.877-6.822-3.925zm-24.44 11.63l1.651.001v7.87c2.344 1.375 4.82 2.79 6.853 3.962l-.84 1.437c-2.555-1.467-5.11-2.985-7.661-4.453-.005-2.95.002-5.9-.003-8.816zm31.254 0l1.65.001c-.001 2.95.003 5.901-.001 8.853-2.455 1.468-4.91 2.947-7.365 4.416l-.843-1.438c2.272-1.323 4.555-2.632 6.82-3.95l-.261-7.882zm-21.447 14.453l.844-1.438 6.817 3.955 6.822-3.955.844 1.438-7.662 4.424-7.665-4.424z"/>
</svg>`;

// Mandalorian — casque T-visor iconique
const _mandoSvg = `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
  <g transform="translate(22,22)">
    <path fill-rule="evenodd" d="
      M0,-18 C8,-18 15,-13 17,-6 L17,4 C17,8 15,11 12,13 L8,16 L-8,16 L-12,13 C-15,11 -17,8 -17,4 L-17,-6 C-15,-13 -8,-18 0,-18 Z
      M-13,0 L13,0 L13,-4 L4,-4 L4,-10 L-4,-10 L-4,-4 L-13,-4 Z
    "/>
  </g>
</svg>`;

// République Galactique — sceau officiel (svgrepo brand-galactic-republic)
const _republicSvg = `<svg viewBox="0 0 14 14" class="choice-svg" fill="currentColor">
  <path d="M 7,13 C 3.6915323,13 1,10.30847 1,7 1,3.69153 3.6915323,1 7,1 c 3.308468,0 6,2.69153 6,6 0,3.30847 -2.691532,6 -6,6 z M 7,1.39992 C 3.9121774,1.39992 1.3999193,3.91218 1.3999193,7 c 0,3.08782 2.5122581,5.60008 5.6000807,5.60008 3.087823,0 5.600081,-2.51226 5.600081,-5.60008 C 12.600081,3.91218 10.087823,1.39992 7,1.39992 Z m 0.6682258,0.52766 0,0.59565 a 4.498379,4.498379 0 0 1 2.0218548,0.83564 l 0.4207264,-0.42 C 9.4152419,2.40516 8.5793548,2.04637 7.6682258,1.92758 Z M 6.328629,1.92958 C 5.4179839,2.0491 4.5828226,2.40862 3.8879839,2.94208 l 0.4180645,0.42 0.00194,0 C 4.8903271,2.93047 5.5793593,2.63483 6.3286335,2.52329 l 0,-0.59371 z M 6.625,3.14337 l 0,2.00492 C 6.3820968,5.19739 6.1551613,5.292 5.9555645,5.42458 L 4.5373387,4.00708 4.0067742,4.53765 5.4262097,5.95708 C 5.293871,6.1562 5.1975806,6.38265 5.1487097,6.62531 l -2.0056452,0 0,0.75 2.0056452,0 c 0.048871,0.24242 0.1454032,0.46718 0.2775,0.66629 L 4.0067742,9.46152 4.5373387,9.99208 5.9555645,8.57386 A 1.8840242,1.8840242 0 0 0 6.625,8.85105 l 0,2.00564 0.75,0 0,-2.00564 C 7.6181452,8.80195 7.843629,8.70444 8.0432258,8.57161 L 9.4626613,9.99153 9.9932258,9.46097 8.5737903,8.04105 C 8.7058871,7.84194 8.8029032,7.61718 8.8520161,7.37476 l 2.0049199,0 0,-0.75 -2.0049199,0 C 8.8031451,6.38234 8.706129,6.15589 8.5737903,5.95653 L 9.9932258,4.5371 9.4626613,4.00653 8.0432258,5.42597 C 7.843629,5.29315 7.6181452,5.19685 7.375,5.14774 l 0,-2.00468 -0.75,0 z m 4.433226,0.74323 -0.42,0.42 a 4.5081532,4.5081532 0 0 1 0.83879,2.02427 l 0.595645,0 C 11.952903,5.41902 11.592903,4.58192 11.058226,3.8866 Z M 2.9400806,3.8896 C 2.406371,4.58443 2.0470968,5.42008 1.9275806,6.33097 l 0.596371,0 C 2.6352419,5.58193 2.9294355,4.89266 3.3608065,4.31032 L 2.9400806,3.8896 Z m -1.0124999,3.78 C 2.0466129,8.58024 2.4054032,9.41589 2.938871,10.11072 L 3.358871,9.69 C 2.9279839,9.1075 2.635,8.41798 2.5239516,7.66919 l -0.596371,0 z m 9.5491933,0 c -0.111532,0.74975 -0.406451,1.43951 -0.83879,2.02258 l 0.42,0.42 C 11.592177,9.41685 11.952661,8.58097 12.072419,7.6696 l -0.595645,0 z m -7.1704837,2.96879 -0.42,0.42 c 0.6950807,0.53443 1.5314516,0.89467 2.4425807,1.01443 l 0,-0.59613 C 5.5791129,11.36468 4.888629,11.07048 4.3062903,10.63839 Z m 5.3837903,0.001 C 9.1072581,11.071 8.4179839,11.36713 7.6682258,11.47818 l 0,0.59443 c 0.911371,-0.11903 1.7470161,-0.47879 2.4425812,-1.0125 l -0.4187909,-0.42072 -0.00194,0 z"/>
</svg>`;

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
    free: false,
    icon: ICONS.noimage
  },

  openrouter_img: {
    id: 'openrouter_img',
    name: 'OpenRouter',
    desc: 'Nano Banana · GPT Image · FLUX.2',
    free: false,
    endpoint: 'https://openrouter.ai/api/v1/images/generations',
    models: [
      { id: 'google/gemini-2.5-flash-image',                name: 'Nano Banana',             desc: 'Rapide et natif image',     tags: ['speed', 'quality'] },
      { id: 'openai/gpt-5-image-mini',                      name: 'GPT-5 Image Mini',        desc: 'Rapide et économique',      tags: ['speed'] },
      { id: 'openai/gpt-5-image',                           name: 'GPT-5 Image',             desc: 'OpenAI, rendu premium',     tags: ['quality'] },
      { id: 'google/gemini-3.1-flash-image-preview',       name: 'Nano Banana 2',           desc: 'Édition image avancée',     tags: ['quality'] },
      { id: 'google/gemini-3-pro-image-preview',           name: 'Nano Banana Pro',         desc: 'Qualité maximale',          tags: ['quality'] },
      { id: 'black-forest-labs/flux.2-max',                name: 'FLUX.2 Max',              desc: 'Qualité image maximale',    tags: ['quality'] },
      { id: 'black-forest-labs/flux.2-pro',                name: 'FLUX.2 Pro',              desc: 'Production haut de gamme',  tags: ['quality'] },
      { id: 'black-forest-labs/flux.2-flex',               name: 'FLUX.2 Flex',             desc: 'Détails et typographie',    tags: ['quality'] },
      { id: 'black-forest-labs/flux.2-klein-4b',           name: 'FLUX.2 Klein',            desc: 'Rapide et économique',      tags: ['speed'] },
    ],
    icon: ICONS.openrouter
  },

  fal_img: {
    id: 'fal_img',
    name: 'fal.ai',
    desc: 'FLUX · Recraft · Ideogram · SD3',
    free: false,
    endpoint: 'https://fal.run',
    models: [
      { id: 'fal-ai/flux/schnell',                   name: 'FLUX Schnell',         desc: 'Ultra-rapide 4 steps',     tags: ['speed'] },
      { id: 'fal-ai/flux/dev',                       name: 'FLUX Dev',             desc: 'Qualité premium',          tags: ['quality'] },
      { id: 'fal-ai/flux-pro/v1.1',                  name: 'FLUX Pro 1.1',         desc: 'Meilleure qualité',        tags: ['quality'] },
      { id: 'fal-ai/flux-pro/v1.1-ultra',            name: 'FLUX Pro Ultra',       desc: 'Résolution maximale',      tags: ['quality'] },
      { id: 'fal-ai/recraft-v3',                     name: 'Recraft V3',           desc: 'Illustration vectorielle', tags: ['art'] },
      { id: 'fal-ai/ideogram/v2',                    name: 'Ideogram V2',          desc: 'Texte dans l\'image',      tags: ['quality', 'art'] },
      { id: 'fal-ai/stable-diffusion-v3-medium',     name: 'SD3 Medium',           desc: 'Open source, artistique',  tags: ['art'] },
      { id: 'fal-ai/aura-flow',                      name: 'AuraFlow',             desc: 'Open source rapide',       tags: ['speed', 'free'] },
    ],
    icon: ICONS.fal
  },

  together_img: {
    id: 'together_img',
    name: 'Together AI',
    desc: 'FLUX · SDXL · SD3',
    free: false,
    endpoint: 'https://api.together.xyz/v1/images/generations',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell',                    name: 'FLUX.1 Schnell',    desc: 'Rapide & efficace',        tags: ['speed'] },
      { id: 'black-forest-labs/FLUX.1-schnell-Free',               name: 'FLUX.1 Schnell Free', desc: 'Gratuit',                tags: ['free', 'speed'] },
      { id: 'black-forest-labs/FLUX.1-dev',                        name: 'FLUX.1 Dev',        desc: 'Haute qualité',            tags: ['quality'] },
      { id: 'black-forest-labs/FLUX.1.1-pro',                      name: 'FLUX 1.1 Pro',      desc: 'Qualité maximale',         tags: ['quality'] },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0',            name: 'SDXL 1.0',          desc: 'Classique éprouvé',        tags: ['art'] },
      { id: 'stabilityai/stable-diffusion-3-medium',               name: 'SD3 Medium',        desc: 'Architecture diffusion',   tags: ['art'] },
      { id: 'prompthero/openjourney',                              name: 'OpenJourney',       desc: 'Style Midjourney',         tags: ['art'] },
    ],
    icon: ICONS.together
  },

  openai_img: {
    id: 'openai_img',
    name: 'DALL-E',
    desc: 'DALL-E 3 & DALL-E 2',
    free: false,
    endpoint: 'https://api.openai.com/v1/images/generations',
    models: [
      { id: 'dall-e-3', name: 'DALL-E 3', desc: 'Compréhension avancée',     tags: ['quality'] },
      { id: 'dall-e-2', name: 'DALL-E 2', desc: 'Rapide et économique',      tags: ['speed'] },
    ],
    icon: ICONS.dalle
  },

  stability: {
    id: 'stability',
    name: 'Stability AI',
    desc: 'SD Ultra · SD Core',
    free: false,
    endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
    models: [
      { id: 'ultra', name: 'SD Ultra',  desc: 'Qualité maximale',        tags: ['quality'] },
      { id: 'core',  name: 'SD Core',   desc: 'Rapide et fiable',        tags: ['speed'] },
    ],
    icon: ICONS.stability
  }
};

/* ─── STORY DATA ─────────────────────────────── */
const LANGUAGES = [
  { id: 'en', name: 'Anglais',      native: 'English',            promptName: 'English',                sub: 'Le web global',              color: '#4FC3F7', svg: _languageSvg },
  { id: 'zh', name: 'Chinois',      native: '中文',                promptName: 'Chinese (Simplified)',   sub: 'Le plus grand bassin',       color: '#FFB74D', svg: _languageSvg },
  { id: 'es', name: 'Espagnol',     native: 'Español',            promptName: 'Spanish',                sub: 'Europe & Amériques',         color: '#FF7043', svg: _languageSvg },
  { id: 'ar', name: 'Arabe',        native: 'العربية',            promptName: 'Arabic',                 sub: 'RTL • MENA',                 color: '#26A69A', svg: _languageSvg },
  { id: 'pt', name: 'Portugais',    native: 'Português',          promptName: 'Portuguese',             sub: 'Brésil & Portugal',          color: '#66BB6A', svg: _languageSvg },
  { id: 'id', name: 'Indonésien',   native: 'Bahasa Indonesia',   promptName: 'Indonesian',             sub: 'Asie du Sud-Est',            color: '#AB47BC', svg: _languageSvg },
  { id: 'fr', name: 'Français',     native: 'Français',           promptName: 'French',                 sub: 'Idéal pour le lore',         color: '#42A5F5', svg: _languageSvg },
  { id: 'ja', name: 'Japonais',     native: '日本語',              promptName: 'Japanese',               sub: 'Gaming • manga • web',       color: '#EC407A', svg: _languageSvg },
  { id: 'ru', name: 'Russe',        native: 'Русский',            promptName: 'Russian',                sub: 'Cyrillique • forums',        color: '#8D6E63', svg: _languageSvg },
  { id: 'de', name: 'Allemand',     native: 'Deutsch',            promptName: 'German',                 sub: 'Technique • communauté',     color: '#FFA726', svg: _languageSvg },
];

const ERAS = [
  { id: 'old_republic',  name: 'Ancienne République', years: '25 000 – 1 000 av. BY',
    svg: _republicSvg.replace('choice-svg', 'choice-svg') },
  { id: 'clone_wars',    name: 'Guerres des Clones', years: '22 – 19 av. BY',
    svg: _jediSvg },
  { id: 'imperial',      name: 'Ère Impériale', years: '19 av. – 5 apr. BY',
    svg: _genEmpireSvg() },
  { id: 'new_republic',  name: 'Nouvelle République', years: '5 – 34 apr. BY',
    svg: _rebelSvg },
  { id: 'first_order',   name: 'Premier Ordre', years: '34 apr. BY+',
    svg: `<svg viewBox="0 0 448 512" class="choice-svg" fill="currentColor"><path d="M398.5 373.6c95.9-122.1 17.2-233.1 17.2-233.1 45.4 85.8-41.4 170.5-41.4 170.5 105-171.5-60.5-271.5-60.5-271.5 96.9 72.7-10.1 190.7-10.1 190.7 85.8 158.4-68.6 230.1-68.6 230.1s-.4-16.9-2.2-85.7c4.3 4.5 34.5 36.2 34.5 36.2l-24.2-47.4 62.6-9.1-62.6-9.1 20.2-55.5-31.4 45.9c-2.2-87.7-7.8-305.1-7.9-306.9v-2.4 1-1 2.4c0 1-5.6 219-7.9 306.9l-31.4-45.9 20.2 55.5-62.6 9.1 62.6 9.1-24.2 47.4 34.5-36.2c-1.8 68.8-2.2 85.7-2.2 85.7s-154.4-71.7-68.6-230.1c0 0-107-118.1-10.1-190.7 0 0-165.5 99.9-60.5 271.5 0 0-86.8-84.8-41.4-170.5 0 0-78.7 111 17.2 233.1 0 0-26.2-16.1-49.4-77.7 0 0 16.9 183.3 222 185.7h4.1c205-2.4 222-185.7 222-185.7-23.6 61.5-49.9 77.7-49.9 77.7z"/></svg>` },
];

const FACTIONS = [
  { id: 'jedi',      name: 'Ordre Jedi',           sub: 'Gardiens de la paix',    color: '#4FC3F7', svg: _assetChoiceSvg('svg/jedi-order-svgrepo-com.svg') },
  { id: 'sith',      name: 'Ordre Sith',            sub: 'Maîtres des ténèbres',   color: '#FF1744', svg: _assetChoiceSvg('svg/starwars-sith-svgrepo-com.svg') },
  { id: 'empire',    name: 'Empire Galactique',     sub: 'Paix par l\'ordre',       color: '#e0e0e0',
    svg: _assetChoiceSvg('svg/noun-storm-trooper-49992.svg') },
  { id: 'rebels',    name: 'Alliance Rebelle',      sub: 'Espoir de la galaxie',   color: '#FF6B35',
    svg: _assetChoiceSvg('svg/luke-skywalker-lightsaber-svgrepo-com.svg') },
  { id: 'republic',  name: 'République Galactique', sub: 'Démocratie & justice',   color: '#81D4FA',
    svg: _assetChoiceSvg('svg/brand-galactic-republic-svgrepo-com.svg') },
  { id: 'mandalore', name: 'Mandalorians',          sub: 'C\'est la voie',          color: '#A5D6A7', svg: _assetChoiceSvg('svg/mandalorian-svgrepo-com.svg') },
  { id: 'hutt',      name: 'Cartel Hutt',           sub: 'Le crime paie',          color: '#FFE082',
    svg: _assetChoiceSvg('svg/scifi-starwars-boba-fett-svgrepo-com.svg') },
  { id: 'neutral',   name: 'Indépendant',           sub: 'Libre de tout lien',     color: '#bdbdbd',
    svg: _assetChoiceSvg('svg/alone-characterized-embodied-svgrepo-com.svg') },
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
