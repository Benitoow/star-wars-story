/* ═══════════════════════════════════════════════
   config.js — API providers, story data, roles & i18n
   Enhanced with attributes, skills, and full UI translations
══════════════════════════════════════════════ */

/* ─── REAL BRAND LOGOS (from Simple Icons + computed) ─── */
const ICONS = {
  openai: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>`,
  anthropic: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
  </svg>`,
  mistral: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z"/>
  </svg>`,
  openrouter: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"/>
  </svg>`,
  groq: `<svg viewBox="0 0 512 492" class="provider-icon" fill="currentColor">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M197.76 315.52l170.197-125.803c8.342-6.186 20.267-3.776 24.256 5.803 20.907 50.539 11.563 111.253-30.08 152.939-41.621 41.685-99.562 50.816-152.512 29.994l-57.834 26.816c82.965 56.768 183.701 42.731 246.656-20.33 49.941-50.006 65.408-118.166 50.944-179.627l.128.149c-20.971-90.282 5.162-126.378 58.666-200.17 1.28-1.75 2.56-3.499 3.819-5.291l-70.421 70.507v-.214L197.76 315.52m-35.072 30.528c-59.563-56.96-49.28-145.088 1.515-195.926 37.568-37.61 99.136-52.97 152.874-30.4l57.707-26.666a166.554 166.554 0 00-39.019-21.334 191.467 191.467 0 00-208.042 41.942c-54.038 54.101-71.04 137.301-41.856 208.298 21.802 53.056-13.931 90.582-49.92 128.47C23.104 463.915 10.304 477.333 0 491.541l162.56-145.386"/>
  </svg>`,
  together: `<svg viewBox="0 0 100 100" class="provider-icon" fill="currentColor">
    <circle cx="50" cy="18" r="18"/>
    <circle cx="18" cy="74" r="18" opacity="0.45"/>
    <circle cx="82" cy="74" r="18" opacity="0.45"/>
  </svg>`,
  dalle: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
    <path d="m3 16 5-5 4 4 3-3 6 6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  stability: `<svg viewBox="0 0 24 24" class="provider-icon" fill="currentColor">
    <path d="M12 2L2 20h20L12 2zm0 4.5l7.5 13.5h-15L12 6.5z" fill-rule="evenodd"/>
    <circle cx="12" cy="15" r="1.5"/>
  </svg>`,
  fal: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 4h9M5 4v16M5 12h7" />
    <path d="M16 14l3 3-3 3" stroke-width="1.4"/>
    <path d="M14 17h5" />
  </svg>`,
  noimage: `<svg viewBox="0 0 24 24" class="provider-icon" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <line x1="3" y1="3" x2="21" y2="21"/>
  </svg>`
};

/* ═════════════════════════════════════════════
   INLINE SVGs — all rendered with currentColor
   so they adapt to the card's selected color.
════════════════════════════════════════════ */

const SVG = {
  // ─── GLOBE for language ───
  language: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="22" cy="22" r="16"/>
    <path d="M6 22h32"/>
    <path d="M22 6c4.8 4.2 7.4 9.8 7.4 16s-2.6 11.8-7.4 16c-4.8-4.2-7.4-9.8-7.4-16S17.2 10.2 22 6z"/>
    <path d="M11 13c3.4 1.9 7.2 2.9 11 2.9s7.6-1 11-2.9"/>
    <path d="M11 31c3.4-1.9 7.2-2.9 11-2.9s7.6 1 11 2.9"/>
  </svg>`,

  // ─── JEDI ORDER — official crest ───
  jedi: `<svg viewBox="0 0 32 32" class="choice-svg" fill="currentColor">
    <path d="M 15.486 3 C 15.486 3 15.174 14.95 15.045 19.854 L 13.293 17.293 L 14.42 20.389 L 10.928 20.896 L 14.42 21.404 L 13.07 24.049 L 14.994 22.029 C 14.894 25.867 14.871 26.811 14.871 26.811 C 14.871 26.811 6.258 22.811 11.045 13.973 C 11.045 13.973 5.075 7.382 10.482 3.332 C 10.482 3.332 1.249 8.907 7.107 18.48 C 7.107 18.48 2.264 13.75 4.797 8.969 C 4.797 8.969 0.407 15.161 5.758 21.973 C 5.758 21.973 4.296 21.076 3.002 17.639 C 3.002 17.639 3.944 27.865 15.387 27.998 L 15.615 27.998 C 27.051 27.866 28 17.641 28 17.641 C 26.683 21.072 25.217 21.975 25.217 21.975 C 30.567 15.163 26.176 8.971 26.176 8.971 C 28.709 13.758 23.865 18.482 23.865 18.482 C 29.723 8.914 20.49 3.336 20.49 3.336 C 25.896 7.392 19.928 13.975 19.928 13.975 C 24.715 22.812 16.102 26.813 16.102 26.813 C 16.102 26.813 16.08 25.869 15.979 22.031 C 16.219 22.282 17.902 24.051 17.902 24.051 L 16.553 21.406 L 20.047 20.898 L 16.553 20.391 L 17.68 17.295 L 15.928 19.855 C 15.804 14.961 15.492 3.1 15.486 3 z"/>
  </svg>`,

  // ─── SITH — T-cross symbol ───
  sith: `<svg viewBox="0 0 76 76" class="choice-svg" fill="currentColor">
    <path d="M 30.351,23.3949 L 38.0169,19 L 45.679,23.4244 C 45.399,23.894 45.119,24.364 44.834,24.831 L 38.013,20.907 C 35.741,22.216 33.469,23.525 31.194,24.83 L 30.351,23.395 Z M 33.279,25.948 L 37.982,23.016 L 42.691,25.946 L 42.22,26.699 L 39.854,25.331 C 39.6,27.706 39.329,30.08 39.082,32.454 C 40.135,33.071 41.194,33.678 42.251,34.29 L 48.034,30.059 L 45.671,28.69 C 45.809,28.429 45.94,28.165 46.081,27.905 C 47.71,28.781 49.343,29.648 50.971,30.525 L 50.784,36.073 L 49.905,36.039 V 33.303 L 43.343,36.198 V 39.835 L 49.905,42.727 V 39.991 L 50.783,39.96 C 50.848,41.81 50.912,43.66 50.969,45.51 L 46.079,48.126 C 45.944,47.863 45.804,47.603 45.672,47.339 C 46.461,46.886 47.247,46.427 48.035,45.972 L 42.22,41.711 L 39.046,43.546 L 39.854,50.7 L 42.22,49.332 L 42.691,50.084 L 38.017,53.014 L 33.278,50.083 L 33.75,49.331 L 36.146,50.7 L 36.919,43.544 C 36.933,43.506 36.889,43.498 36.867,43.482 L 33.78,41.711 L 27.965,45.972 L 30.329,47.372 L 29.89,48.156 C 28.269,47.284 26.648,46.414 25.03,45.537 C 25.08,43.688 25.13,41.838 25.186,39.989 L 26.09,40.022 V 42.762 L 32.657,39.864 V 36.198 L 26.09,33.302 V 36.04 L 25.186,36.073 C 25.132,34.233 25.077,32.392 25.031,30.553 L 29.889,27.906 L 30.329,28.69 L 27.964,30.059 L 33.719,34.29 C 34.785,33.678 35.854,33.071 36.917,32.454 C 36.671,30.08 36.4,27.706 36.146,25.331 L 33.75,26.699 C 33.59,26.45 33.436,26.198 33.279,25.948 Z M 21.546,28.494 C 24.099,27.024 26.651,25.55 29.201,24.075 C 29.489,24.54 29.768,25.012 30.046,25.484 L 23.195,29.438 V 37.316 L 21.544,37.316 C 21.545,34.375 21.541,31.434 21.546,28.494 Z M 45.983,25.514 L 46.826,24.075 C 49.37,25.546 51.909,27.025 54.454,28.494 C 54.459,31.434 54.455,34.375 54.456,37.316 L 52.806,37.316 L 52.805,29.438 L 45.983,25.514 Z M 21.544,38.653 L 23.194,38.653 V 46.523 C 25.539,47.898 28.014,49.313 30.047,50.486 L 29.207,51.923 C 26.65,50.456 24.102,48.974 21.546,47.505 C 21.541,44.555 21.545,41.604 21.544,38.653 Z M 52.806,38.653 L 54.456,38.653 C 54.455,41.604 54.459,44.555 54.454,47.505 C 51.898,48.974 49.35,50.456 46.793,51.923 L 45.953,50.486 C 47.986,49.313 50.461,47.898 52.806,46.523 Z"/>
  </svg>`,

  // ─── REBEL ALLIANCE — phoenix crest ───
  rebel: `<svg viewBox="0 0 512 512" class="choice-svg" fill="currentColor">
    <path d="M256.5 504C117.2 504 9 387.8 13.2 249.9 16 170.7 56.4 97.7 129.7 49.5c.3 0 1.9-.6 1.1.8-5.8 5.5-111.3 129.8-14.1 226.4 49.8 49.5 90 2.5 90 2.5 38.5-50.1-.6-125.9-.6-125.9-10-24.9-45.7-40.1-45.7-40.1l28.8-31.8c24.4 10.5 43.2 38.7 43.2 38.7.8-29.6-21.9-61.4-21.9-61.4L255.1 8l44.3 50.1c-20.5 28.8-21.9 62.6-21.9 62.6 13.8-23 43.5-39.3 43.5-39.3l28.5 31.8c-27.4 8.9-45.4 39.9-45.4 39.9-15.8 28.5-27.1 89.4.6 127.3 32.4 44.6 87.7-2.8 87.7-2.8 102.7-91.9-10.5-225-10.5-225-6.1-5.5.8-2.8.8-2.8 50.1 36.5 114.6 84.4 116.2 204.8C500.9 400.2 399 504 256.5 504z"/>
  </svg>`,

  // ─── EMPIRE — 12-petal imperial crest ───
  empire: (() => {
    const petals = Array.from({length: 12}, (_, i) => {
      const a  = (i * 30 - 90) * Math.PI / 180;
      const a1 = (i * 30 - 90 - 8) * Math.PI / 180;
      const a2 = (i * 30 - 90 + 8) * Math.PI / 180;
      const ri = 6, ro = 18;
      return `<polygon points="${(22+ri*Math.cos(a1)).toFixed(2)},${(22+ri*Math.sin(a1)).toFixed(2)} ${(22+ri*Math.cos(a2)).toFixed(2)},${(22+ri*Math.sin(a2)).toFixed(2)} ${(22+ro*Math.cos(a)).toFixed(2)},${(22+ro*Math.sin(a)).toFixed(2)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor"><circle cx="22" cy="22" r="5"/>${petals}<circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  })(),

  // ─── FIRST ORDER — hexagonal crest ───
  firstOrder: `<svg viewBox="0 0 448 512" class="choice-svg" fill="currentColor">
    <path d="M398.5 373.6c95.9-122.1 17.2-233.1 17.2-233.1 45.4 85.8-41.4 170.5-41.4 170.5 105-171.5-60.5-271.5-60.5-271.5 96.9 72.7-10.1 190.7-10.1 190.7 85.8 158.4-68.6 230.1-68.6 230.1s-.4-16.9-2.2-85.7c4.3 4.5 34.5 36.2 34.5 36.2l-24.2-47.4 62.6-9.1-62.6-9.1 20.2-55.5-31.4 45.9c-2.2-87.7-7.8-305.1-7.9-306.9v-2.4 1-1 2.4c0 1-5.6 219-7.9 306.9l-31.4-45.9 20.2 55.5-62.6 9.1 62.6 9.1-24.2 47.4 34.5-36.2c-1.8 68.8-2.2 85.7-2.2 85.7s-154.4-71.7-68.6-230.1c0 0-107-118.1-10.1-190.7 0 0-165.5 99.9-60.5 271.5 0 0-86.8-84.8-41.4-170.5 0 0-78.7 111 17.2 233.1 0 0-26.2-16.1-49.4-77.7 0 0 16.9 183.3 222 185.7h4.1c205-2.4 222-185.7 222-185.7-23.6 61.5-49.9 77.7-49.9 77.7z"/>
  </svg>`,

  // ─── OLD REPUBLIC — circular sigil ───
  republic: `<svg viewBox="0 0 14 14" class="choice-svg" fill="currentColor">
    <path d="M 7,13 C 3.69,13 1,10.31 1,7 1,3.69 3.69,1 7,1 c 3.31,0 6,2.69 6,6 0,3.31 -2.69,6 -6,6 z M 7,1.4 C 3.91,1.4 1.4,3.91 1.4,7 c 0,3.09 2.51,5.6 5.6,5.6 3.09,0 5.6,-2.51 5.6,-5.6 C 12.6,3.91 10.09,1.4 7,1.4 Z M 6.625,3.14 v 2 C 6.38,5.2 6.16,5.29 5.96,5.42 L 4.54,4 4,4.54 5.43,5.96 C 5.29,6.16 5.2,6.38 5.15,6.63 H 3.14 v 0.75 h 2.01 c 0.05,0.24 0.15,0.47 0.28,0.67 L 4,9.46 4.54,9.99 5.96,8.57 A 1.88,1.88 0 0 0 6.625,8.85 v 2 h 0.75 v -2 C 7.62,8.8 7.84,8.7 8.04,8.57 L 9.46,9.99 9.99,9.46 8.57,8.04 C 8.71,7.84 8.8,7.62 8.85,7.38 h 2 V 6.63 h -2 C 8.8,6.38 8.71,6.16 8.57,5.96 L 9.99,4.54 9.46,4 8.04,5.43 C 7.84,5.29 7.62,5.2 7.375,5.15 v -2 h -0.75 z"/>
  </svg>`,

  // ─── MANDALORIAN — Mythosaur skull ───
  mando: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M22 4 C 14 4, 9 10, 9 17 L 9 22 C 9 26, 11 29, 14 31 L 14 36 C 14 38, 15 39, 17 39 L 19 39 L 19 34 L 22 31 L 25 34 L 25 39 L 27 39 C 29 39, 30 38, 30 36 L 30 31 C 33 29, 35 26, 35 22 L 35 17 C 35 10, 30 4, 22 4 Z M 16 16 C 14 16, 13 17, 13 19 C 13 21, 14 22, 16 22 L 16 16 Z M 28 16 L 28 22 C 30 22, 31 21, 31 19 C 31 17, 30 16, 28 16 Z M 19 20 L 25 20 L 25 24 L 22 26 L 19 24 Z"/>
  </svg>`,

  // ─── HUTT CARTEL — stylized H with halo ───
  hutt: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M 12 10 L 12 34 L 16 34 L 16 24 L 28 24 L 28 34 L 32 34 L 32 10 L 28 10 L 28 20 L 16 20 L 16 10 Z"/>
    <circle cx="22" cy="22" r="15" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
  </svg>`,

  // ─── LONE WANDERER — hooded silhouette ───
  wanderer: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M22 4 C 17 4, 14 8, 14 13 C 14 15, 14.5 17, 15.5 18.5 L 12 22 L 12 28 L 10 40 L 34 40 L 32 28 L 32 22 L 28.5 18.5 C 29.5 17, 30 15, 30 13 C 30 8, 27 4, 22 4 Z M 18 13 C 18 10, 20 9, 22 9 C 24 9, 26 10, 26 13 L 26 15 C 25 16, 24 17, 22 17 C 20 17, 19 16, 18 15 Z"/>
    <circle cx="22" cy="13" r="1.5" fill="#000" opacity="0"/>
  </svg>`,

  /* ═════ ROLES — each with attributes and skills ═════ */

  lightsaberBlue: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none">
    <rect x="18" y="28" width="8" height="12" rx="1.5" fill="currentColor" opacity="0.85"/>
    <rect x="16" y="25" width="12" height="3.5" rx="1" fill="currentColor"/>
    <line x1="22" y1="4" x2="22" y2="25" stroke="#4FC3F7" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="4" x2="22" y2="25" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="22" cy="4" rx="2.5" ry="1.5" fill="#4FC3F7"/>
  </svg>`,

  lightsaberRed: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none">
    <rect x="18" y="28" width="8" height="12" rx="1.5" fill="currentColor" opacity="0.85"/>
    <rect x="16" y="25" width="12" height="3.5" rx="1" fill="currentColor"/>
    <line x1="22" y1="4" x2="22" y2="25" stroke="#FF1744" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="4" x2="22" y2="25" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="14" y1="14" x2="30" y2="14" stroke="#FF1744" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="22" cy="4" rx="2.5" ry="1.5" fill="#FF1744"/>
  </svg>`,

  lightsaberDouble: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none">
    <rect x="19" y="17" width="6" height="10" rx="1.5" fill="currentColor"/>
    <line x1="22" y1="2" x2="22" y2="17" stroke="#FF1744" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="22" y1="27" x2="22" y2="42" stroke="#FF1744" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="22" y1="2" x2="22" y2="17" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
    <line x1="22" y1="27" x2="22" y2="42" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
  </svg>`,

  lightsaberRing: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="22" cy="22" r="13"/>
    <line x1="22" y1="3" x2="22" y2="11" stroke="#FF1744" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="22" y1="33" x2="22" y2="41" stroke="#FF1744" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="19" y="16" width="6" height="12" rx="1.5" fill="currentColor"/>
  </svg>`,

  bountyHelmet: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M22 6 C 14 6, 8 12, 8 20 L 8 28 C 8 34, 12 38, 22 38 C 32 38, 36 34, 36 28 L 36 20 C 36 12, 30 6, 22 6 Z M 13 17 L 20 17 L 20 25 L 13 25 Z M 24 17 L 31 17 L 31 25 L 24 25 Z M 15 10 L 18 8 L 20 12 Z"/>
  </svg>`,

  freighter: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <ellipse cx="22" cy="22" rx="17" ry="7"/>
    <rect x="2" y="20" width="6" height="4"/>
    <circle cx="22" cy="22" r="4" fill="currentColor" opacity="0.2"/>
    <line x1="12" y1="22" x2="32" y2="22"/>
    <circle cx="14" cy="26" r="1.5" fill="currentColor"/>
    <circle cx="30" cy="26" r="1.5" fill="currentColor"/>
  </svg>`,

  cloneHelmet: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M22 4 C 14 4, 10 10, 10 18 L 10 28 C 10 32, 12 34, 14 34 L 14 38 L 18 38 L 18 34 L 26 34 L 26 38 L 30 38 L 30 34 C 32 34, 34 32, 34 28 L 34 18 C 34 10, 30 4, 22 4 Z M 14 18 L 30 18 L 30 22 L 14 22 Z M 14 24 L 30 24 L 30 26 L 14 26 Z M 18 11 L 22 9 L 26 11 L 26 13 L 18 13 Z"/>
  </svg>`,

  stormHelmet: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M14 10 L 30 10 L 32 18 L 28 22 L 28 32 L 16 32 L 16 22 L 12 18 Z M 16 17 L 28 17 L 28 20 L 16 20 Z M 18 23 L 26 23 L 26 30 L 18 30 Z M 19 25 L 25 25 L 25 28 L 19 28 Z" fill="currentColor"/>
    <path d="M 21 13 L 23 13 L 23 15 L 21 15 Z" fill="#000" opacity="0.8"/>
  </svg>`,

  xwing: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M 4 10 L 20 18 L 20 20 L 4 22 L 4 20 L 16 20 L 16 19 L 4 14 Z M 40 10 L 24 18 L 24 20 L 40 22 L 40 20 L 28 20 L 28 19 L 40 14 Z M 4 34 L 20 26 L 20 24 L 4 22 L 4 24 L 16 24 L 16 25 L 4 30 Z M 40 34 L 24 26 L 24 24 L 40 22 L 40 24 L 28 24 L 28 25 L 40 30 Z M 20 19 L 32 22 L 20 25 Z" />
    <rect x="18" y="19" width="10" height="6" rx="1"/>
  </svg>`,

  tieFighter: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <rect x="4" y="6" width="4" height="32"/>
    <rect x="36" y="6" width="4" height="32"/>
    <rect x="8" y="10" width="2" height="24"/>
    <rect x="34" y="10" width="2" height="24"/>
    <line x1="10" y1="22" x2="34" y2="22" stroke="currentColor" stroke-width="2"/>
    <circle cx="22" cy="22" r="6"/>
    <circle cx="22" cy="22" r="2.5" fill="#000"/>
  </svg>`,

  senator: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <circle cx="22" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <rect x="20" y="18" width="4" height="10" fill="currentColor"/>
    <path d="M 10 40 L 10 32 L 34 32 L 34 40 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <line x1="10" y1="40" x2="34" y2="40" stroke="currentColor" stroke-width="2"/>
    <line x1="14" y1="32" x2="14" y2="40" stroke="currentColor" stroke-width="1.2"/>
    <line x1="22" y1="32" x2="22" y2="40" stroke="currentColor" stroke-width="1.2"/>
    <line x1="30" y1="32" x2="30" y2="40" stroke="currentColor" stroke-width="1.2"/>
  </svg>`,

  droid: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <rect x="14" y="6" width="16" height="12" rx="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <rect x="13" y="19" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <circle cx="19" cy="12" r="2.2"/>
    <circle cx="25" cy="12" r="2.2"/>
    <rect x="19" y="23" width="6" height="2"/>
    <rect x="19" y="27" width="6" height="2"/>
    <circle cx="22" cy="33" r="1.5"/>
    <line x1="10" y1="24" x2="13" y2="24" stroke="currentColor" stroke-width="1.5"/>
    <line x1="31" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="1.5"/>
    <line x1="22" y1="4" x2="22" y2="2" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="22" cy="2" r="0.8"/>
  </svg>`,

  mandoHelmet: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M22 4 C 14 4, 9 10, 9 18 L 9 28 C 9 32, 11 35, 14 37 L 16 39 L 28 39 L 30 37 C 33 35, 35 32, 35 28 L 35 18 C 35 10, 30 4, 22 4 Z M 12 18 L 32 18 L 32 22 L 24 22 L 24 26 L 20 26 L 20 22 L 12 22 Z" />
  </svg>`,

  imperialOfficer: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M 10 18 C 10 10, 16 6, 22 6 C 28 6, 34 10, 34 18 L 34 22 L 10 22 Z" fill="currentColor"/>
    <rect x="8" y="22" width="28" height="3"/>
    <circle cx="22" cy="14" r="3" fill="#000"/>
    <path d="M 14 30 L 30 30 L 30 40 L 14 40 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <rect x="17" y="33" width="3" height="2"/>
    <rect x="24" y="33" width="3" height="2"/>
    <rect x="17" y="36" width="10" height="1"/>
  </svg>`,

  mercenary: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor" stroke="currentColor" stroke-width="1.2">
    <path d="M 6 22 L 14 18 L 18 20 L 18 24 L 14 26 Z" fill="currentColor"/>
    <path d="M 38 22 L 30 18 L 26 20 L 26 24 L 30 26 Z" fill="currentColor"/>
    <circle cx="22" cy="22" r="4" fill="none"/>
    <line x1="22" y1="4" x2="22" y2="14" stroke-width="1.5"/>
    <line x1="22" y1="30" x2="22" y2="40" stroke-width="1.5"/>
  </svg>`,

  spy: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M 10 14 L 34 14 L 30 20 L 14 20 Z"/>
    <circle cx="16" cy="17" r="2.5" fill="#000"/>
    <circle cx="28" cy="17" r="2.5" fill="#000"/>
    <path d="M 14 22 C 14 30, 18 38, 22 38 C 26 38, 30 30, 30 22 L 22 24 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M 22 38 L 22 42" stroke-width="1"/>
  </svg>`,

  engineer: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="22" cy="22" r="6"/>
    <path d="M22 4 L22 10 M22 34 L22 40 M4 22 L10 22 M34 22 L40 22 M9 9 L13 13 M31 31 L35 35 M35 9 L31 13 M13 31 L9 35"/>
  </svg>`,

  medic: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <rect x="18" y="10" width="8" height="24" fill="currentColor"/>
    <rect x="10" y="18" width="24" height="8" fill="currentColor"/>
  </svg>`,

  nightsister: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <path d="M 22 6 C 15 6, 10 11, 10 18 C 10 22, 12 25, 14 27 L 14 34 L 18 34 L 18 30 L 26 30 L 26 34 L 30 34 L 30 27 C 32 25, 34 22, 34 18 C 34 11, 29 6, 22 6 Z"/>
    <circle cx="17" cy="18" r="1.8" fill="#000"/>
    <circle cx="27" cy="18" r="1.8" fill="#000"/>
    <path d="M 18 24 Q 22 27 26 24" stroke="#000" stroke-width="1.2" fill="none"/>
    <path d="M 8 10 Q 12 4 16 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M 36 10 Q 32 4 28 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
  </svg>`,

  padawan: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor">
    <circle cx="22" cy="15" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M 16 18 Q 16 28, 14 34 L 12 42 L 15 42 L 17 36 L 17 22" fill="currentColor"/>
    <rect x="28" y="20" width="3" height="8" rx="0.5"/>
    <line x1="29.5" y1="8" x2="29.5" y2="20" stroke="#4FC3F7" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  smuggler: `<svg viewBox="0 0 44 44" class="choice-svg" fill="currentColor" stroke="currentColor" stroke-width="1.2">
    <circle cx="22" cy="12" r="5" fill="none"/>
    <path d="M 14 36 L 14 22 L 30 22 L 30 36 Z" fill="none"/>
    <line x1="12" y1="22" x2="6" y2="22" stroke-width="1.8"/>
    <line x1="32" y1="22" x2="38" y2="22" stroke-width="1.8"/>
    <path d="M 6 18 L 6 22 L 10 22 Z"/>
    <path d="M 38 18 L 38 22 L 34 22 Z"/>
  </svg>`,

  /* ═════ PREMISES ═════ */

  chosen: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <polygon points="22,4 25.8,15.2 38,15.2 28.1,22 31.9,33.2 22,26.4 12.1,33.2 15.9,22 6,15.2 18.2,15.2"/>
    <circle cx="22" cy="18" r="3" fill="currentColor"/>
  </svg>`,

  outcast: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="22" cy="22" r="14"/>
    <line x1="12" y1="12" x2="32" y2="32" stroke-width="2"/>
    <path d="M22 8 L22 36" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.5"/>
  </svg>`,

  heist: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="12" y="18" width="20" height="16" rx="2"/>
    <path d="M17 18 L17 13 C17 9.7 27 9.7 27 13 L27 18"/>
    <circle cx="22" cy="26" r="3" stroke-width="1.2"/>
    <line x1="22" y1="29" x2="22" y2="31" stroke-width="1.5"/>
  </svg>`,

  war: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
    <path d="M8 36 L22 8 L36 36"/>
    <line x1="11.5" y1="28" x2="32.5" y2="28" stroke-width="1"/>
    <line x1="15" y1="36" x2="10" y2="36" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="29" y1="36" x2="34" y2="36" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  mystery: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="22" cy="22" r="16"/>
    <path d="M16 18 C16 14 28 14 28 20 C28 24 22 24 22 28" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="22" cy="33" r="2" fill="currentColor"/>
  </svg>`,

  redemption: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M22 6 C10 10 6 22 12 32 C16 38 22 40 22 40 C22 40 28 38 32 32 C38 22 34 10 22 6Z"/>
    <path d="M15 22 L20 27 L29 17" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  survival: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 4 L22 22 L32 32"/>
    <circle cx="22" cy="22" r="16"/>
    <path d="M18 8 L22 4 L26 8" stroke-width="2"/>
  </svg>`,

  legacy: `<svg viewBox="0 0 44 44" class="choice-svg" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M 12 36 L 12 12 L 22 6 L 32 12 L 32 36 Z"/>
    <path d="M 18 36 L 18 22 L 26 22 L 26 36" stroke-width="1.2"/>
    <circle cx="22" cy="16" r="2" fill="currentColor"/>
  </svg>`,

  // ─── UI Icons ───
  uiLang: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,

  edit: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`,

  check: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,

  chevronDown: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`,

  image: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`,

  imageError: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>`,

  retry: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>`,

  user: `<svg viewBox="0 0 24 24" class="ui-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`,
};

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
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      { id: 'google/gemini-2.5-flash-image',                name: 'Nano Banana',             desc: 'Rapide et natif image',     tags: ['speed', 'quality'] },
      { id: 'openai/gpt-5-image-mini',                      name: 'GPT-5 Image Mini',        desc: 'Rapide et économique',      tags: ['speed'] },
      { id: 'openai/gpt-5-image',                           name: 'GPT-5 Image',             desc: 'OpenAI, rendu premium',     tags: ['quality'] },
      { id: 'google/gemini-3.1-flash-image-preview',        name: 'Nano Banana 2',           desc: 'Édition image avancée',     tags: ['quality'] },
      { id: 'google/gemini-3-pro-image-preview',            name: 'Nano Banana Pro',         desc: 'Qualité maximale',          tags: ['quality'] },
      { id: 'black-forest-labs/flux.2-max',                 name: 'FLUX.2 Max',              desc: 'Qualité image maximale',    tags: ['quality'] },
      { id: 'black-forest-labs/flux.2-pro',                 name: 'FLUX.2 Pro',              desc: 'Production haut de gamme',  tags: ['quality'] },
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
  { id: 'fr', name: 'Français',     native: 'Français',           promptName: 'French',                 sub: 'Idéal pour le lore',         color: '#42A5F5', svg: SVG.language },
  { id: 'en', name: 'Anglais',      native: 'English',            promptName: 'English',                sub: 'Le web global',              color: '#4FC3F7', svg: SVG.language },
  { id: 'es', name: 'Espagnol',     native: 'Español',            promptName: 'Spanish',                sub: 'Europe & Amériques',         color: '#FF7043', svg: SVG.language },
  { id: 'de', name: 'Allemand',     native: 'Deutsch',            promptName: 'German',                sub: 'Technique • communauté',     color: '#FFA726', svg: SVG.language },
  { id: 'it', name: 'Italien',      native: 'Italiano',           promptName: 'Italian',                sub: 'Rythmé & émotif',            color: '#66BB6A', svg: SVG.language },
  { id: 'pt', name: 'Portugais',    native: 'Português',          promptName: 'Portuguese',             sub: 'Brésil & Portugal',          color: '#AED581', svg: SVG.language },
  { id: 'ja', name: 'Japonais',     native: '日本語',              promptName: 'Japanese',               sub: 'Gaming • manga • web',       color: '#EC407A', svg: SVG.language },
  { id: 'zh', name: 'Chinois',      native: '中文',                promptName: 'Chinese (Simplified)',   sub: 'Le plus grand bassin',       color: '#FFB74D', svg: SVG.language },
  { id: 'ko', name: 'Coréen',       native: '한국어',              promptName: 'Korean',                sub: 'K-culture & SF',             color: '#BA68C8', svg: SVG.language },
  { id: 'ru', name: 'Russe',        native: 'Русский',            promptName: 'Russian',               sub: 'Cyrillique • forums',        color: '#8D6E63', svg: SVG.language },
  { id: 'ar', name: 'Arabe',        native: 'العربية',            promptName: 'Arabic',                sub: 'RTL • MENA',                 color: '#26A69A', svg: SVG.language },
  { id: 'id', name: 'Indonésien',   native: 'Bahasa Indonesia',   promptName: 'Indonesian',            sub: 'Asie du Sud-Est',            color: '#AB47BC', svg: SVG.language },
];

const ERAS = [
  { id: 'old_republic',  name: 'Ancienne République', years: '25 000 – 1 000 av. BY', color: '#81D4FA', svg: SVG.republic },
  { id: 'clone_wars',    name: 'Guerres des Clones',  years: '22 – 19 av. BY',        color: '#4FC3F7', svg: SVG.jedi },
  { id: 'imperial',      name: 'Ère Impériale',       years: '19 av. – 5 apr. BY',    color: '#e0e0e0', svg: SVG.empire },
  { id: 'new_republic',  name: 'Nouvelle République', years: '5 – 34 apr. BY',        color: '#FF6B35', svg: SVG.rebel },
  { id: 'first_order',   name: 'Premier Ordre',       years: '34 apr. BY+',           color: '#FF1744', svg: SVG.firstOrder },
  { id: 'high_republic', name: 'Haute République',    years: '500 – 100 av. BY',      color: '#FFE082', svg: SVG.jedi },
];

const FACTIONS = [
  { id: 'jedi',       name: 'Ordre Jedi',            sub: 'Gardiens de la paix',      color: '#4FC3F7', svg: SVG.jedi, members: '10 000+' },
  { id: 'sith',       name: 'Ordre Sith',            sub: 'Maîtres des ténèbres',     color: '#FF1744', svg: SVG.sith, members: '2-10' },
  { id: 'empire',     name: 'Empire Galactique',     sub: 'Paix par l\'ordre',        color: '#e0e0e0', svg: SVG.empire, members: 'Multiples systèmes' },
  { id: 'rebels',     name: 'Alliance Rebelle',      sub: 'Espoir de la galaxie',     color: '#FF6B35', svg: SVG.rebel, members: 'Variable' },
  { id: 'republic',   name: 'République Galactique', sub: 'Démocratie & justice',    color: '#81D4FA', svg: SVG.republic, members: 'Systèmes fondateurs' },
  { id: 'mandalore',  name: 'Mandalorians',          sub: 'C\'est la voie',           color: '#A5D6A7', svg: SVG.mando, members: 'Nucléus' },
  { id: 'first_order', name: 'Premier Ordre',         sub: 'Héritage Impérial',        color: '#B71C1C', svg: SVG.firstOrder, members: 'Militaire' },
  { id: 'hutt',       name: 'Cartel Hutt',           sub: 'Le crime paie',            color: '#FFE082', svg: SVG.hutt, members: 'Territoires neutres' },
  { id: 'neutral',    name: 'Indépendant',           sub: 'Libre de tout lien',       color: '#bdbdbd', svg: SVG.wanderer, members: 'Illimité' },
];

/* ─── EXPANDED ROLES — with attributes and skills ─────────────────────── */
const ROLES = [
  {
    id: 'jedi_knight',
    name: 'Chevalier Jedi',
    sub: 'Maître du Côté Lumineux',
    color: '#4FC3F7',
    svg: SVG.lightsaberBlue,
    faction: 'jedi',
    description: 'Guerriers de la paix, formés aux arts de la Force et du sabre laser.',
    attributes: { combat: 75, diplomacy: 60, stealth: 40, tech: 35, force: 70, survival: 55 },
    skills: {
      lightsaber_combat: 'Maîtrise avancée du sabre laser',
      force_push: 'Manipulation de la Force pour repousser',
      force_sense: 'Perception des intentions',
      parry: 'Déviation des tirs d\'énergie'
    },
    interactions: { sith: 'antagonist', empire: 'opposed', rebels: 'allied', republic: 'aligned' }
  },
  {
    id: 'jedi_master',
    name: 'Maître Jedi',
    sub: 'Siège au Haut Conseil',
    color: '#81D4FA',
    svg: SVG.jedi,
    faction: 'jedi',
    description: 'Vétérans du Côté Lumineux, mentors et stratèges.',
    attributes: { combat: 65, diplomacy: 85, stealth: 30, tech: 40, force: 90, survival: 60 },
    skills: {
      force_heal: 'Guérison par la Force',
      battle_meditation: 'Influence sur le champ de bataille',
      wisdom: 'Connaissance ancestrale',
      telekinesis: 'Manipulation d\'objets à distance'
    },
    interactions: { sith: 'antagonist', empire: 'opposed', rebels: 'allied', republic: 'aligned' }
  },
  {
    id: 'padawan',
    name: 'Padawan',
    sub: 'Apprenti en formation',
    color: '#B3E5FC',
    svg: SVG.padawan,
    faction: 'jedi',
    description: 'Jeunes apprentis Jedi, en quête de connaissance et d\'expérience.',
    attributes: { combat: 40, diplomacy: 50, stealth: 55, tech: 45, force: 50, survival: 45 },
    skills: {
      lightsaber_basic: 'Techniques de base du sabre',
      force_guidance: 'École de la pensée',
      learning: 'Apprentissage rapide',
      jump: 'Saut en Force'
    },
    interactions: { sith: 'antagonist', empire: 'opposed', rebels: 'curious', republic: 'aligned' }
  },
  {
    id: 'sith_apprentice',
    name: 'Apprenti Sith',
    sub: 'Disciple des ténèbres',
    color: '#FF1744',
    svg: SVG.lightsaberRed,
    faction: 'sith',
    description: 'Aspirants Sith, avides de pouvoir et de connaissance du Côté Obscur.',
    attributes: { combat: 70, diplomacy: 35, stealth: 50, tech: 45, force: 65, survival: 50 },
    skills: {
      force_lightning: 'Éclair de Force',
      rage: 'Amplification par la colère',
      fear_induce: 'Induction de terreur',
      quick_draw: 'Tir rapide'
    },
    interactions: { jedi: 'antagonist', republic: 'opposed', empire: 'aligned', rebels: 'hostile' }
  },
  {
    id: 'sith_lord',
    name: 'Seigneur Sith',
    sub: 'Maître du Côté Obscur',
    color: '#D50000',
    svg: SVG.sith,
    faction: 'sith',
    description: 'Maîtres Sith, manipulateurs et détenteurs de pouvoir absolu.',
    attributes: { combat: 85, diplomacy: 70, stealth: 55, tech: 50, force: 95, survival: 65 },
    skills: {
      force_lightning: 'Éclair de Force dévastateur',
      force_choke: 'Strangulation à distance',
      mind_trick: 'Manipulation mentale',
      force_drain: 'Absorption de la vie'
    },
    interactions: { jedi: 'antagonist', republic: 'destroy', empire: 'controls', rebels: 'hunts' }
  },
  {
    id: 'inquisitor',
    name: 'Inquisiteur',
    sub: 'Chasseur de Jedi',
    color: '#C62828',
    svg: SVG.lightsaberRing,
    faction: 'empire',
    description: 'Traqueurs impériaux, spécialisés dans l\'éradication des derniers Jedi.',
    attributes: { combat: 65, diplomacy: 25, stealth: 70, tech: 40, force: 55, survival: 50 },
    skills: {
      lightsaber_deflect: 'Déviation avancée',
      tracking: 'Pistage des fugitifs',
      interrogation: 'Extraction d\'informations',
      survive_harsh: 'Survie en territoires hostiles'
    },
    interactions: { jedi: 'hunts', sith: 'serves', rebels: 'hostile', neutral: 'suspicious' }
  },
  {
    id: 'nightsister',
    name: 'Sœur de la Nuit',
    sub: 'Magie de Dathomir',
    color: '#8E24AA',
    svg: SVG.nightsister,
    faction: 'neutral',
    description: 'Sorcières de Dathomir, mystérieuses et redoutées.',
    attributes: { combat: 55, diplomacy: 40, stealth: 75, tech: 30, force: 60, survival: 70 },
    skills: {
      magick: 'Magie nightsister',
      stealth_natural: 'Camouflage naturel',
      poison: 'Création de poisons',
      ancestral_commune: 'Communication ancestrale'
    },
    interactions: { jedi: 'neutral', sith: 'wary', mandalore: 'alliance', neutral: 'territorial' }
  },
  {
    id: 'mandalorian',
    name: 'Mandalorien',
    sub: 'Guerrier au beskar',
    color: '#A5D6A7',
    svg: SVG.mandoHelmet,
    faction: 'mandalore',
    description: 'Combattants légendaires, défenseurs de leur culture et de leur armure.',
    attributes: { combat: 80, diplomacy: 45, stealth: 55, tech: 60, force: 0, survival: 85 },
    skills: {
      jetpack: '机动跃迁',
      beskar_armor: '装甲防护',
      hunter_instincts: '猎人本能',
      weapons_expert: '武器专家'
    },
    interactions: { jedi: 'neutral', sith: 'mercenary', bounty_hunter: 'respect', neutral: 'neutral' }
  },
  {
    id: 'bounty_hunter',
    name: 'Chasseur de primes',
    sub: 'Contrats & crédits',
    color: '#FFE082',
    svg: SVG.bountyHelmet,
    faction: 'neutral',
    description: 'Chasseurs professionnels, motivés par la récompense.',
    attributes: { combat: 70, diplomacy: 40, stealth: 65, tech: 55, force: 0, survival: 75 },
    skills: {
      tracking: 'Pistage de cibles',
      explosives: 'Utilisation d\'explosifs',
      intimidation: 'Extorsion par la menace',
      ship_pilot: 'Pilotage de vaisseau'
    },
    interactions: { hutt: 'business', mandalore: 'respect', empire: 'mercenary', rebels: 'mercenary' }
  },
  {
    id: 'smuggler',
    name: 'Contrebandier',
    sub: 'Vite fait, bien fait',
    color: '#FFAB40',
    svg: SVG.smuggler,
    faction: 'neutral',
    description: 'Navigateurs des routes commerciales illicites.',
    attributes: { combat: 50, diplomacy: 65, stealth: 70, tech: 60, force: 0, survival: 70 },
    skills: {
      fast_talk: 'Persuasion rapide',
      nav_routes: 'Connaissance des routes',
      droid_hack: 'Piratage de droïdes',
      improvise: 'Improvisation'
    },
    interactions: { hutt: 'business', empire: 'evade', rebels: 'allied', neutral: 'network' }
  },
  {
    id: 'mercenary',
    name: 'Mercenaire',
    sub: 'Deux blasters, zéro principe',
    color: '#FF8F00',
    svg: SVG.mercenary,
    faction: 'neutral',
    description: 'Soldats aguerris, disponibles au plus offrant.',
    attributes: { combat: 75, diplomacy: 30, stealth: 50, tech: 45, force: 0, survival: 70 },
    skills: {
      heavy_weapons: 'Armes lourdes',
      tactical: 'Stratégie de combat',
      morale_break: 'Casser le moral',
      fortify: 'Fortification de position'
    },
    interactions: { empire: 'mercenary', rebels: 'mercenary', hutt: 'mercenary', neutral: 'varies' }
  },
  {
    id: 'pilot',
    name: 'As de l\'Espace',
    sub: 'Né pour voler',
    color: '#FF6B35',
    svg: SVG.xwing,
    faction: 'rebels',
    description: 'Pilotes d\'élite, maîtres du combat spatial.',
    attributes: { combat: 60, diplomacy: 40, stealth: 45, tech: 70, force: 0, survival: 55 },
    skills: {
      dogfight: 'Combat spatial',
      ship_repair: 'Réparation de vaisseau',
      evasive: 'Manœuvres évasives',
      targeting: 'Ciblage précis'
    },
    interactions: { empire: 'enemy', rebels: 'allied', first_order: 'enemy', neutral: 'respect' }
  },
  {
    id: 'clone_trooper',
    name: 'Soldat Clone',
    sub: 'Exécuteur de l\'Ordre',
    color: '#BDBDBD',
    svg: SVG.cloneHelmet,
    faction: 'republic',
    description: 'Soldats silencieux, PROGRAMMÉS pour obéir.',
    attributes: { combat: 85, diplomacy: 10, stealth: 35, tech: 45, force: 0, survival: 60 },
    skills: {
      phase1_armor: 'Armure de Phase I',
      tcw_tactics: 'Tactique Clone Wars',
      rush: 'Charge massive',
      flash_training: 'Formation accélérée'
    },
    interactions: { jedi: 'follows', sith: 'confused', republic: 'loyal', empire: 'former' }
  },
  {
    id: 'stormtrooper',
    name: 'Stormtrooper',
    sub: 'Infanterie Impériale',
    color: '#ECEFF1',
    svg: SVG.stormHelmet,
    faction: 'empire',
    description: 'Troupes d\'assaut de l\'Empire, craintes et nombreux.',
    attributes: { combat: 70, diplomacy: 10, stealth: 30, tech: 40, force: 0, survival: 55 },
    skills: {
      e_web: 'Utilisation E-web',
      formation: 'Combat en formation',
      patrol: 'Patrouille et surveillance',
      quick_adapt: 'Adaptation rapide'
    },
    interactions: { jedi: 'hunts', rebels: 'enemy', sith: 'serves', neutral: 'inspect' }
  },
  {
    id: 'imperial_officer',
    name: 'Officier Impérial',
    sub: 'Autorité & stratégie',
    color: '#546E7A',
    svg: SVG.imperialOfficer,
    faction: 'empire',
    description: 'Commandants impériaux, combinant tactique et autorité.',
    attributes: { combat: 45, diplomacy: 70, stealth: 25, tech: 55, force: 0, survival: 50 },
    skills: {
      command: 'Commandement d\'unité',
      tactical_planning: 'Planification tactique',
      intimidate: 'Intimider les subordonnés',
      star_destroyer: 'Commandement naval'
    },
    interactions: { empire: 'rank', rebels: 'enemy', jedi: 'suspect', neutral: 'control' }
  },
  {
    id: 'senator',
    name: 'Sénateur',
    sub: 'Pouvoir politique',
    color: '#CE93D8',
    svg: SVG.senator,
    faction: 'republic',
    description: 'Représentants politiques, maîtres de la diplomatie et de l\'influence.',
    attributes: { combat: 15, diplomacy: 95, stealth: 30, tech: 35, force: 0, survival: 40 },
    skills: {
      negotiate: 'Négociation avancée',
      political_maneuver: 'Manœuvres politiques',
      speech: 'Discours inspirant',
      network: 'Réseau de contacts'
    },
    interactions: { republic: 'represents', empire: 'opposes', jedi: 'advisor', neutral: 'influence' }
  },
  {
    id: 'spy',
    name: 'Agent Secret',
    sub: 'Ombres & secrets',
    color: '#7E57C2',
    svg: SVG.spy,
    faction: 'neutral',
    description: 'Espions et infiltrateurs, operant dans l\'ombre.',
    attributes: { combat: 35, diplomacy: 60, stealth: 90, tech: 50, force: 0, survival: 55 },
    skills: {
      disguise: 'Se fondre dans la masse',
      info_extract: 'Extraction d\'informations',
      poison_resist: 'Résistance aux poisons',
      vanish: 'Disparaître sans trace'
    },
    interactions: { empire: 'double_agent', rebels: 'double_agent', hutt: 'info_dealer', neutral: 'varies' }
  },
  {
    id: 'engineer',
    name: 'Ingénieur',
    sub: 'Bâtisseur de l\'impossible',
    color: '#4DB6AC',
    svg: SVG.engineer,
    faction: 'neutral',
    description: 'Experts techniques, capables de réparer ou construire tout.',
    attributes: { combat: 25, diplomacy: 45, stealth: 35, tech: 95, force: 0, survival: 55 },
    skills: {
      starship_engineer: 'Moteurs de vaisseaux',
      droid_program: 'Programmation de droïdes',
      weapon_mod: 'Modification d\'armes',
      base_build: 'Construction de base'
    },
    interactions: { empire: 'essential', rebels: 'essential', neutral: 'independent', any: 'useful' }
  },
  {
    id: 'medic',
    name: 'Médecin de Terrain',
    sub: 'Au front, sauver des vies',
    color: '#66BB6A',
    svg: SVG.medic,
    faction: 'neutral',
    description: 'Professionnels de la médecine, essentiels en temps de conflit.',
    attributes: { combat: 30, diplomacy: 55, stealth: 40, tech: 70, force: 0, survival: 65 },
    skills: {
      combat_medic: 'Premiers secours au combat',
      surgery: 'Chirurgie d\'urgence',
      antidote: 'Création d\'antidotes',
      trauma_care: 'Soins des traumatismes'
    },
    interactions: { empire: 'medical', rebels: 'medical', neutral: 'neutral_health', any: 'needed' }
  },
  {
    id: 'droid',
    name: 'Droïde Avancé',
    sub: 'Intelligence mécanique',
    color: '#90A4AE',
    svg: SVG.droid,
    faction: 'neutral',
    description: 'Droïdes sapients, pensez et ressentez comme des êtres vivants.',
    attributes: { combat: 40, diplomacy: 35, stealth: 45, tech: 85, force: 0, survival: 80 },
    skills: {
      self_repair: 'Auto-réparation',
      data_analysis: 'Analyse de données',
      interface: 'Interface avec autres droïdes',
      memory: 'Mémoire parfaite'
    },
    interactions: { jedi: 'varies', empire: 'owned', neutral: 'freedom_seeking', any: 'tool_or_person' }
  }
];

const PREMISES = [
  { id: 'chosen',     name: 'L\'Élu',          sub: 'Une prophétie ancienne vous désigne', color: '#FFE81F', svg: SVG.chosen },
  { id: 'outcast',    name: 'Le Banni',        sub: 'Trahi, seul, et déterminé',           color: '#CE93D8', svg: SVG.outcast },
  { id: 'heist',      name: 'Le Braquage',     sub: 'Un artefact que tous convoitent',     color: '#FFB74D', svg: SVG.heist },
  { id: 'war',        name: 'La Guerre',       sub: 'Au cœur d\'une bataille décisive',    color: '#EF5350', svg: SVG.war },
  { id: 'mystery',    name: 'Le Mystère',      sub: 'Un secret qui change tout',           color: '#80CBC4', svg: SVG.mystery },
  { id: 'redemption', name: 'La Rédemption',   sub: 'Racheter un passé sombre',            color: '#AED581', svg: SVG.redemption },
  { id: 'survival',   name: 'La Survie',       sub: 'Échouer, c\'est mourir',              color: '#FF8A65', svg: SVG.survival },
  { id: 'legacy',     name: 'L\'Héritage',     sub: 'Un nom, un fardeau, un destin',       color: '#BA68C8', svg: SVG.legacy },
];

/* ═════════════════════════════════════════════
   UI i18n — FULL translations for 8 languages
   (does NOT affect story narration language)
════════════════════════════════════════════ */
const UI_LANGUAGES = [
  { id: 'fr', label: 'Français', native: 'FR' },
  { id: 'en', label: 'English',  native: 'EN' },
  { id: 'es', label: 'Español',  native: 'ES' },
  { id: 'de', label: 'Deutsch',  native: 'DE' },
  { id: 'it', label: 'Italiano', native: 'IT' },
  { id: 'pt', label: 'Português',native: 'PT' },
  { id: 'ja', label: '日本語',    native: 'JA' },
  { id: 'zh', label: '中文',      native: 'ZH' },
];

const I18N = {
  fr: {
    subtitle: 'Histoire Interactive IA',
    chooseProvider: 'Choisissez votre fournisseur IA',
    apiKeyLabel: 'Clé API',
    testContinue: 'Tester & Continuer',
    rememberKey: 'Mémoriser la clé (stockage local)',
    hintKey: 'Votre clé API ne quitte jamais votre navigateur.',
    chooseModel: 'Choisissez votre modèle',
    chooseModelSub: 'Le modèle qui donnera vie à votre histoire',
    searchModel: 'Rechercher un modèle…',
    back: '← Retour',
    confirm: 'Confirmer →',
    imageGen: 'Générateur d\'images',
    imageGenSub: 'Optionnel — illustrez chaque scène de votre aventure',
    imageModelLabel: 'Modèle d\'image',
    imageKeyLabel: 'Clé API (si différente)',
    imageKeyPlaceholder: 'Laisser vide pour réutiliser la clé principale',
    skip: 'Passer cette étape',
    forgeDestiny: 'Forgez votre destin',
    forgeDestinySub: 'Chaque choix façonne une galaxie différente',
    narrationLang: 'Langue de narration',
    era: 'Ère',
    faction: 'Faction',
    role: 'Rôle',
    premise: 'Point de départ',
    startStory: 'Commencer l\'histoire',
    turn: 'Tour',
    prologue: 'Prologue',
    weavingFate: 'L\'IA tisse votre destin…',
    menu: 'Menu',
    continue: 'Continuer',
    newStory: 'Nouvelle histoire',
    customPlaceholder: 'Écrivez votre propre action…',
    customSend: 'Agir',
    aiError: 'Erreur IA',
    retry: 'Vérifiez votre clé API et réessayez.',
    uiLang: 'Interface',
    retryAction: 'Réessayer cette action',
    // New collaborative features
    yourVersion: 'Votre version des événements',
    yourVersionPlaceholder: 'Rédigez votre interprétation personnelle de ces événements…',
    incorporate: 'Incorporer à l\'histoire',
    incorporated: 'Votre version a été ajoutée au récit',
    viewEdits: 'Voir mes modifications',
    editHistory: 'Historique des modifications',
    // Role details
    attributes: 'Attributs',
    skills: 'Compétences',
    combat: 'Combat',
    diplomacy: 'Diplomatie',
    stealth: 'Discrétion',
    tech: 'Technique',
    force: 'Force',
    survival: 'Survie',
    factionAligned: 'Alignement',
    // Image generation
    generatingImage: 'Génération de l\'image…',
    imageGenerated: 'Illustration',
    imageFailed: 'Image non disponible',
    retryImage: 'Réessayer',
    // UI language
    selectLanguage: 'Changer la langue de l\'interface',
    // Story navigation
    chapter: 'Chapitre',
    // Expanded narrative sections
    context: 'Contexte',
    action: 'Action',
    dialogue: 'Dialogue',
    reflection: 'Réflexion',
    atmosphere: 'Atmosphère',
    // Collaboratif
    addDetails: 'Ajouter des détails',
    rewritePassage: 'Réécrire ce passage',
    yourThoughts: 'Vos pensées',
  },
  en: {
    subtitle: 'AI Interactive Story',
    chooseProvider: 'Choose your AI provider',
    apiKeyLabel: 'API Key',
    testContinue: 'Test & Continue',
    rememberKey: 'Remember key (local storage)',
    hintKey: 'Your API key never leaves your browser.',
    chooseModel: 'Choose your model',
    chooseModelSub: 'The model that will bring your story to life',
    searchModel: 'Search for a model…',
    back: '← Back',
    confirm: 'Confirm →',
    imageGen: 'Image generator',
    imageGenSub: 'Optional — illustrate each scene of your adventure',
    imageModelLabel: 'Image model',
    imageKeyLabel: 'API key (if different)',
    imageKeyPlaceholder: 'Leave empty to reuse main key',
    skip: 'Skip this step',
    forgeDestiny: 'Forge your destiny',
    forgeDestinySub: 'Every choice shapes a different galaxy',
    narrationLang: 'Narration language',
    era: 'Era',
    faction: 'Faction',
    role: 'Role',
    premise: 'Starting point',
    startStory: 'Begin the story',
    turn: 'Turn',
    prologue: 'Prologue',
    weavingFate: 'The AI is weaving your fate…',
    menu: 'Menu',
    continue: 'Continue',
    newStory: 'New story',
    customPlaceholder: 'Write your own action…',
    customSend: 'Act',
    aiError: 'AI Error',
    retry: 'Check your API key and try again.',
    uiLang: 'Interface',
    retryAction: 'Retry this action',
    // New collaborative features
    yourVersion: 'Your version of events',
    yourVersionPlaceholder: 'Write your personal interpretation of these events…',
    incorporate: 'Incorporate into story',
    incorporated: 'Your version has been added to the narrative',
    viewEdits: 'View my edits',
    editHistory: 'Edit history',
    // Role details
    attributes: 'Attributes',
    skills: 'Skills',
    combat: 'Combat',
    diplomacy: 'Diplomacy',
    stealth: 'Stealth',
    tech: 'Tech',
    force: 'Force',
    survival: 'Survival',
    factionAligned: 'Alignment',
    // Image generation
    generatingImage: 'Generating image…',
    imageGenerated: 'Illustration',
    imageFailed: 'Image unavailable',
    retryImage: 'Retry',
    // UI language
    selectLanguage: 'Change interface language',
    // Story navigation
    chapter: 'Chapter',
    // Expanded narrative sections
    context: 'Context',
    action: 'Action',
    dialogue: 'Dialogue',
    reflection: 'Reflection',
    atmosphere: 'Atmosphere',
    // Collaborative
    addDetails: 'Add details',
    rewritePassage: 'Rewrite this passage',
    yourThoughts: 'Your thoughts',
  },
  es: {
    subtitle: 'Historia Interactiva con IA',
    chooseProvider: 'Elige tu proveedor de IA',
    apiKeyLabel: 'Clave API',
    testContinue: 'Probar y Continuar',
    rememberKey: 'Recordar clave (almacenamiento local)',
    hintKey: 'Tu clave API nunca sale de tu navegador.',
    chooseModel: 'Elige tu modelo',
    chooseModelSub: 'El modelo que dará vida a tu historia',
    searchModel: 'Buscar un modelo…',
    back: '← Atrás',
    confirm: 'Confirmar →',
    imageGen: 'Generador de imágenes',
    imageGenSub: 'Opcional — ilustra cada escena de tu aventura',
    imageModelLabel: 'Modelo de imagen',
    imageKeyLabel: 'Clave API (si es diferente)',
    imageKeyPlaceholder: 'Dejar vacío para reutilizar la clave principal',
    skip: 'Saltar este paso',
    forgeDestiny: 'Forja tu destino',
    forgeDestinySub: 'Cada elección moldea una galaxia diferente',
    narrationLang: 'Idioma de narración',
    era: 'Era',
    faction: 'Facción',
    role: 'Rol',
    premise: 'Punto de partida',
    startStory: 'Comenzar la historia',
    turn: 'Turno',
    prologue: 'Prólogo',
    weavingFate: 'La IA teje tu destino…',
    menu: 'Menú',
    continue: 'Continuar',
    newStory: 'Nueva historia',
    customPlaceholder: 'Escribe tu propia acción…',
    customSend: 'Actuar',
    aiError: 'Error de IA',
    retry: 'Verifica tu clave API e inténtalo de nuevo.',
    uiLang: 'Interfaz',
    retryAction: 'Reintentar esta acción',
    yourVersion: 'Tu versión de los eventos',
    yourVersionPlaceholder: 'Escribe tu interpretación personal de estos eventos…',
    incorporate: 'Incorporar a la historia',
    incorporated: 'Tu versión ha sido añadida al relato',
    viewEdits: 'Ver mis ediciones',
    editHistory: 'Historial de ediciones',
    attributes: 'Atributos',
    skills: 'Habilidades',
    combat: 'Combate',
    diplomacy: 'Diplomacia',
    stealth: 'Sigilo',
    tech: 'Técnica',
    force: 'Fuerza',
    survival: 'Supervivencia',
    factionAligned: 'Alineación',
    generatingImage: 'Generando imagen…',
    imageGenerated: 'Ilustración',
    imageFailed: 'Imagen no disponible',
    retryImage: 'Reintentar',
    selectLanguage: 'Cambiar idioma de interfaz',
    chapter: 'Capítulo',
    context: 'Contexto',
    action: 'Acción',
    dialogue: 'Diálogo',
    reflection: 'Reflexión',
    atmosphere: 'Atmósfera',
    addDetails: 'Añadir detalles',
    rewritePassage: 'Reescribir este pasaje',
    yourThoughts: 'Tus pensamientos',
  },
  de: {
    subtitle: 'KI Interaktive Geschichte',
    chooseProvider: 'Wähle deinen KI-Anbieter',
    apiKeyLabel: 'API-Schlüssel',
    testContinue: 'Testen & Fortfahren',
    rememberKey: 'Schlüssel merken (lokaler Speicher)',
    hintKey: 'Dein API-Schlüssel verlässt niemals deinen Browser.',
    chooseModel: 'Wähle dein Modell',
    chooseModelSub: 'Das Modell, das deine Geschichte zum Leben erweckt',
    searchModel: 'Modell suchen…',
    back: '← Zurück',
    confirm: 'Bestätigen →',
    imageGen: 'Bildgenerator',
    imageGenSub: 'Optional — illustriere jede Szene',
    imageModelLabel: 'Bildmodell',
    imageKeyLabel: 'API-Schlüssel (falls anders)',
    imageKeyPlaceholder: 'Leer lassen zum Wiederverwenden',
    skip: 'Überspringen',
    forgeDestiny: 'Schmiede dein Schicksal',
    forgeDestinySub: 'Jede Wahl formt eine andere Galaxie',
    narrationLang: 'Erzählsprache',
    era: 'Ära',
    faction: 'Fraktion',
    role: 'Rolle',
    premise: 'Ausgangspunkt',
    startStory: 'Geschichte beginnen',
    turn: 'Runde',
    prologue: 'Prolog',
    weavingFate: 'Die KI webt dein Schicksal…',
    menu: 'Menü',
    continue: 'Fortfahren',
    newStory: 'Neue Geschichte',
    customPlaceholder: 'Schreibe deine eigene Aktion…',
    customSend: 'Handeln',
    aiError: 'KI-Fehler',
    retry: 'Prüfe deinen API-Schlüssel und versuche es erneut.',
    uiLang: 'Oberfläche',
    retryAction: 'Aktion wiederholen',
    yourVersion: 'Deine Version der Ereignisse',
    yourVersionPlaceholder: 'Schreibe deine persönliche Interpretation dieser Ereignisse…',
    incorporate: 'In die Geschichte einarbeiten',
    incorporated: 'Deine Version wurde zur Erzählung hinzugefügt',
    viewEdits: 'Meine Bearbeitungen anzeigen',
    editHistory: 'Bearbeitungsverlauf',
    attributes: 'Attribute',
    skills: 'Fähigkeiten',
    combat: 'Kampf',
    diplomacy: 'Diplomatie',
    stealth: 'Heimlichkeit',
    tech: 'Technik',
    force: 'Macht',
    survival: 'Überleben',
    factionAligned: 'Ausrichtung',
    generatingImage: 'Bild wird generiert…',
    imageGenerated: 'Illustration',
    imageFailed: 'Bild nicht verfügbar',
    retryImage: 'Wiederholen',
    selectLanguage: 'Oberflächensprache ändern',
    chapter: 'Kapitel',
    context: 'Kontext',
    action: 'Aktion',
    dialogue: 'Dialog',
    reflection: 'Reflexion',
    atmosphere: 'Atmosphäre',
    addDetails: 'Details hinzufügen',
    rewritePassage: 'Diese Passage umschreiben',
    yourThoughts: 'Deine Gedanken',
  },
  it: {
    subtitle: 'Storia Interattiva IA',
    chooseProvider: 'Scegli il tuo provider IA',
    apiKeyLabel: 'Chiave API',
    testContinue: 'Testa e Continua',
    rememberKey: 'Ricorda chiave (locale)',
    hintKey: 'La tua chiave API non lascia mai il browser.',
    chooseModel: 'Scegli il tuo modello',
    chooseModelSub: 'Il modello che darà vita alla tua storia',
    searchModel: 'Cerca un modello…',
    back: '← Indietro',
    confirm: 'Conferma →',
    imageGen: 'Generatore immagini',
    imageGenSub: 'Opzionale — illustra ogni scena',
    imageModelLabel: 'Modello immagine',
    imageKeyLabel: 'Chiave API (se diversa)',
    imageKeyPlaceholder: 'Lascia vuoto per riutilizzare',
    skip: 'Salta',
    forgeDestiny: 'Forgia il tuo destino',
    forgeDestinySub: 'Ogni scelta plasma una galassia diversa',
    narrationLang: 'Lingua di narrazione',
    era: 'Era',
    faction: 'Fazione',
    role: 'Ruolo',
    premise: 'Punto di partenza',
    startStory: 'Inizia la storia',
    turn: 'Turno',
    prologue: 'Prologo',
    weavingFate: 'L\'IA sta tessendo il tuo destino…',
    menu: 'Menu',
    continue: 'Continua',
    newStory: 'Nuova storia',
    customPlaceholder: 'Scrivi la tua azione…',
    customSend: 'Agisci',
    aiError: 'Errore IA',
    retry: 'Verifica la chiave API e riprova.',
    uiLang: 'Interfaccia',
    retryAction: 'Riprova questa azione',
    yourVersion: 'La tua versione degli eventi',
    yourVersionPlaceholder: 'Scrivi la tua interpretazione personale di questi eventi…',
    incorporate: 'Incorpora nella storia',
    incorporated: 'La tua versione è stata aggiunta alla narrazione',
    viewEdits: 'Vedi le mie modifiche',
    editHistory: 'Cronologia modifiche',
    attributes: 'Attributi',
    skills: 'Abilità',
    combat: 'Combattimento',
    diplomacy: 'Diplomazia',
    stealth: 'Furtività',
    tech: 'Tecnica',
    force: 'Forza',
    survival: 'Sopravvivenza',
    factionAligned: 'Allineamento',
    generatingImage: 'Generazione immagine…',
    imageGenerated: 'Illustrazione',
    imageFailed: 'Immagine non disponibile',
    retryImage: 'Riprova',
    selectLanguage: 'Cambia lingua interfaccia',
    chapter: 'Capitolo',
    context: 'Contesto',
    action: 'Azione',
    dialogue: 'Dialogo',
    reflection: 'Riflessione',
    atmosphere: 'Atmosfera',
    addDetails: 'Aggiungi dettagli',
    rewritePassage: 'Riscrivi questo passaggio',
    yourThoughts: 'I tuoi pensieri',
  },
  pt: {
    subtitle: 'História Interativa IA',
    chooseProvider: 'Escolha seu provedor IA',
    apiKeyLabel: 'Chave API',
    testContinue: 'Testar & Continuar',
    rememberKey: 'Lembrar chave (local)',
    hintKey: 'Sua chave API nunca sai do navegador.',
    chooseModel: 'Escolha seu modelo',
    chooseModelSub: 'O modelo que dará vida à sua história',
    searchModel: 'Buscar modelo…',
    back: '← Voltar',
    confirm: 'Confirmar →',
    imageGen: 'Gerador de imagens',
    imageGenSub: 'Opcional — ilustre cada cena',
    imageModelLabel: 'Modelo de imagem',
    imageKeyLabel: 'Chave API (se diferente)',
    imageKeyPlaceholder: 'Deixe vazio para reutilizar',
    skip: 'Pular',
    forgeDestiny: 'Forje seu destino',
    forgeDestinySub: 'Cada escolha molda uma galáxia diferente',
    narrationLang: 'Idioma da narração',
    era: 'Era',
    faction: 'Facção',
    role: 'Papel',
    premise: 'Ponto de partida',
    startStory: 'Iniciar história',
    turn: 'Turno',
    prologue: 'Prólogo',
    weavingFate: 'A IA tece seu destino…',
    menu: 'Menu',
    continue: 'Continuar',
    newStory: 'Nova história',
    customPlaceholder: 'Escreva sua ação…',
    customSend: 'Agir',
    aiError: 'Erro IA',
    retry: 'Verifique sua chave API e tente novamente.',
    uiLang: 'Interface',
    retryAction: 'Tentar novamente',
    yourVersion: 'A sua versão dos eventos',
    yourVersionPlaceholder: 'Escreva a sua interpretação pessoal destes eventos…',
    incorporate: 'Incorporar à história',
    incorporated: 'A sua versão foi adicionada à narrativa',
    viewEdits: 'Ver as minhas edições',
    editHistory: 'Histórico de edições',
    attributes: 'Atributos',
    skills: 'Competências',
    combat: 'Combate',
    diplomacy: 'Diplomacia',
    stealth: 'Furtividade',
    tech: 'Técnica',
    force: 'Força',
    survival: 'Sobrevivência',
    factionAligned: 'Alinhamento',
    generatingImage: 'A gerar imagem…',
    imageGenerated: 'Ilustração',
    imageFailed: 'Imagem indisponível',
    retryImage: 'Tentar novamente',
    selectLanguage: 'Alterar idioma da interface',
    chapter: 'Capítulo',
    context: 'Contexto',
    action: 'Ação',
    dialogue: 'Diálogo',
    reflection: 'Reflexão',
    atmosphere: 'Atmosfera',
    addDetails: 'Adicionar detalhes',
    rewritePassage: 'Reescrever esta passagem',
    yourThoughts: 'Os seus pensamentos',
  },
  ja: {
    subtitle: 'AIインタラクティブストーリー',
    chooseProvider: 'AIプロバイダーを選択',
    apiKeyLabel: 'APIキー',
    testContinue: 'テストして続行',
    rememberKey: 'キーを記憶（ローカル保存）',
    hintKey: 'APIキーはブラウザから離れません。',
    chooseModel: 'モデルを選択',
    chooseModelSub: 'ストーリーに命を吹き込むモデル',
    searchModel: 'モデルを検索…',
    back: '← 戻る',
    confirm: '確認 →',
    imageGen: '画像生成',
    imageGenSub: 'オプション — 各シーンを画像で',
    imageModelLabel: '画像モデル',
    imageKeyLabel: 'APIキー（別の場合）',
    imageKeyPlaceholder: 'メインキーを再利用',
    skip: 'スキップ',
    forgeDestiny: '運命を鍛える',
    forgeDestinySub: '選択ごとに異なる銀河が生まれる',
    narrationLang: 'ナレーション言語',
    era: '時代',
    faction: '勢力',
    role: '役割',
    premise: '出発点',
    startStory: '物語を始める',
    turn: 'ターン',
    prologue: 'プロローグ',
    weavingFate: 'AIが運命を紡いでいます…',
    menu: 'メニュー',
    continue: '続ける',
    newStory: '新しい物語',
    customPlaceholder: '自分の行動を書く…',
    customSend: '行動',
    aiError: 'AIエラー',
    retry: 'APIキーを確認して再試行してください。',
    uiLang: 'インターフェース',
    retryAction: '再試行',
    yourVersion: 'あなたのバージョン',
    yourVersionPlaceholder: 'これらの出来事へのあなたの解釈を書いてください…',
    incorporate: '物語に組み込む',
    incorporated: 'あなたのバージョンが物語に追加されました',
    viewEdits: '編集を見る',
    editHistory: '編集履歴',
    attributes: '属性',
    skills: 'スキル',
    combat: '戦闘',
    diplomacy: '外交',
    stealth: '隠密',
    tech: '技術',
    force: 'フォース',
    survival: 'サバイバル',
    factionAligned: '勢力',
    generatingImage: '画像生成中…',
    imageGenerated: 'イラスト',
    imageFailed: '画像利用不可',
    retryImage: '再試行',
    selectLanguage: 'インターフェース言語を変更',
    chapter: '章',
    context: '文脈',
    action: '行動',
    dialogue: '対話',
    reflection: '考察',
    atmosphere: '雰囲気',
    addDetails: '詳細を追加',
    rewritePassage: 'この段落を書き直す',
    yourThoughts: 'あなたの考え',
  },
  zh: {
    subtitle: 'AI互动故事',
    chooseProvider: '选择您的AI提供商',
    apiKeyLabel: 'API密钥',
    testContinue: '测试并继续',
    rememberKey: '记住密钥（本地存储）',
    hintKey: '您的API密钥绝不离开浏览器。',
    chooseModel: '选择您的模型',
    chooseModelSub: '让您的故事焕发生命的模型',
    searchModel: '搜索模型…',
    back: '← 返回',
    confirm: '确认 →',
    imageGen: '图像生成器',
    imageGenSub: '可选 — 为每个场景配图',
    imageModelLabel: '图像模型',
    imageKeyLabel: 'API密钥（如不同）',
    imageKeyPlaceholder: '留空以重用主密钥',
    skip: '跳过',
    forgeDestiny: '锻造您的命运',
    forgeDestinySub: '每个选择塑造不同的银河',
    narrationLang: '叙述语言',
    era: '时代',
    faction: '阵营',
    role: '角色',
    premise: '起点',
    startStory: '开始故事',
    turn: '回合',
    prologue: '序章',
    weavingFate: 'AI正在编织您的命运…',
    menu: '菜单',
    continue: '继续',
    newStory: '新故事',
    customPlaceholder: '写下您的行动…',
    customSend: '行动',
    aiError: 'AI错误',
    retry: '请检查API密钥并重试。',
    uiLang: '界面',
    retryAction: '重试此动作',
    yourVersion: '您的版本',
    yourVersionPlaceholder: '写下您对这些事件的个人解读…',
    incorporate: '纳入故事',
    incorporated: '您的版本已添加到叙事中',
    viewEdits: '查看我的编辑',
    editHistory: '编辑历史',
    attributes: '属性',
    skills: '技能',
    combat: '战斗',
    diplomacy: '外交',
    stealth: '隐匿',
    tech: '技术',
    force: '原力',
    survival: '生存',
    factionAligned: '阵营',
    generatingImage: '正在生成图像…',
    imageGenerated: '插图',
    imageFailed: '图像不可用',
    retryImage: '重试',
    selectLanguage: '更改界面语言',
    chapter: '章节',
    context: '背景',
    action: '行动',
    dialogue: '对话',
    reflection: '思考',
    atmosphere: '氛围',
    addDetails: '添加细节',
    rewritePassage: '重写此段落',
    yourThoughts: '您的想法',
  },
};

/* ─── Translation helper function ─────────────────────── */
function t(key, lang) {
  const l = lang || window.__UI_LANG__ || 'fr';
  return (I18N[l] && I18N[l][key]) || I18N.fr[key] || key;
}

/* ─── Role attribute display names ─────────────────────── */
const ATTRIBUTE_NAMES = {
  combat: 'combat',
  diplomacy: 'diplomacy',
  stealth: 'stealth',
  tech: 'tech',
  force: 'force',
  survival: 'survival'
};
