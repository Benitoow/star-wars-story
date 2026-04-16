/* ═══════════════════════════════════════════════
   story.js — Enhanced prompt building & story parsing
   Includes structured narrative sections and collaborative mode
══════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Tu es un maître narrateur de l'univers Star Wars, expert en lore canonique et Legends. Tu crées des histoires immersives, cinématographiques et émotionnellement riches.

RÈGLES STRICTES (NON-NÉGOCIABLES):
0. N'invente AUCUN champ supplémentaire. N'utilise PAS "story_metadata", "prologue", "player_character", "environment_details", "choices_consequences", ni aucun wrapper. La racine du JSON DOIT contenir DIRECTEMENT les champs ci-dessous.
1. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour. Ne répète JAMAIS le JSON deux fois.
2. Le JSON doit avoir exactement cette structure (tous les champs obligatoires, rien de plus):
{
  "chapter_title": "Titre court et évocateur du chapitre (max 40 chars)",
  "chapter_number": 1,
  "section_type": "confrontation|exploration|dialogue|reflection|action",
  "narrative": {
    "context": "Contexte historique ou situation actuelle (2-3 phrases)",
    "action": "Événements en cours avec descriptions sensorielles (3-4 phrases)",
    "dialogue": "Échanges verbaux avec styles vocaux distinctifs, peut être vide (2-3 répliques)",
    "reflection": "Monologue intérieur ou Gedanken du personnage (1-2 phrases)",
    "atmosphere": "lumineux|sombre|tense|mystique|apocalyptique|nostalgique"
  },
  "choices": [
    {
      "text": "Choix A (20-40 mots)",
      "attribute": "combat|diplomacy|stealth|tech|force|survival",
      "difficulty": 1-5,
      "faction_impact": {"empire": -10, "rebels": +10, "jedi": +5}
    }
  ],
  "scene_description": "Description courte en anglais de la scène pour génération d'image (max 60 mots)",
  "user_edits_applied": "Récapitulatif des modifications utilisateur intégrées (1 phrase) ou null"
}
3. Les choix doivent être significativement différents et avoir des conséquences narratives importantes.
4. Reste cohérent avec l'ère, la faction et le rôle choisis.
5. Utilise le lore Star Wars authentique: noms de planètes, technologie, factions.
6. La narration est à la 2ème personne du singulier ("vous découvrez", "vous ressentez").
7. SI l'utilisateur a fourni des modifications personnelles dans son espace "Votre version", INTÈGRE-LES au récit de manière organique.
8. VARIE le style d'écriture: alterne phrases courtes/longues, descriptions/action/dialogue.
9. Les dialogues doivent avoir du caractère - chaque personnage a sa propre façon de parler. Dans "dialogue", utilise un TABLEAU d'objets [{"speaker": "Nom", "text": "Réplique"}], pas une string.
10. N'utilise JAMAIS d'identifiants techniques dans le texte narratif (pas de *lightsaber_basic*, *force_guidance*, {placeholder}, snake_case_ids, etc.). Écris TOUJOURS en langage naturel ("son entraînement au sabre laser", "la guidance de la Force", etc.).
11. Aucun markdown (**gras**, *italique*, listes) dans les champs narratifs — uniquement du texte pur.`;

const DEFAULT_LANGUAGE_ID = 'fr';

/* ─── Language configuration ─────────────────── */
function getLanguageConfig(languageId) {
  return (
    LANGUAGES.find(l => l.id === languageId) ||
    LANGUAGES.find(l => l.id === DEFAULT_LANGUAGE_ID) ||
    LANGUAGES[0] ||
    { name: 'Français', native: 'Français', promptName: 'French' }
  );
}

/* ─── Role configuration helper ─────────────── */
function getRoleConfig(roleId) {
  return ROLES.find(r => r.id === roleId) || null;
}

/* ─── Faction configuration helper ───────────── */
function getFactionConfig(factionId) {
  return FACTIONS.find(f => f.id === factionId) || null;
}

/* ─── Build enhanced system prompt ────────────── */
function buildSystemPrompt(languageId = DEFAULT_LANGUAGE_ID) {
  const language = getLanguageConfig(languageId);

  return `LANGUE DE SORTIE:
- Rédige tout le contenu textuel du JSON en ${language.promptName}.
- Garde "scene_description" en anglais pour la génération d'image.
- N'utilise jamais un mélange de langues dans le même champ.

${SYSTEM_PROMPT}`;
}

/* ─── Build role context for prompts ─────────── */
function buildRoleContext(roleId) {
  const role = getRoleConfig(roleId);
  if (!role) return '';

  const attrs = Object.entries(role.attributes)
    .map(([key, val]) => `${key}: ${val}/100`)
    .join(', ');

  const skills = Object.entries(role.skills)
    .map(([key, desc]) => `${key}: ${desc}`)
    .join('; ');

  return `
PROFIL DU PERSONNAGE:
- Rôle: ${role.name}
- Description: ${role.description}
- Attributs: ${attrs}
- Compétences: ${skills}
- Alignement: ${Object.entries(role.interactions)
    .map(([f, rel]) => `${f}: ${rel}`)
    .join(', ')}
`;
}

/* ─── Build user edits context ───────────────── */
function buildUserEditsContext(userEdits) {
  if (!userEdits || userEdits.length === 0) return '';

  const editsSummary = userEdits
    .map((edit, i) => `[Modification ${i + 1}]: ${edit.text.substring(0, 100)}...`)
    .join('\n');

  return `
MODIFICATIONS PRÉCÉDENTES DE L'UTILISATEUR:
L'utilisateur a précédemment contribué les interprétations suivantes. INTÈGRE-LES naturellement au récit:
${editsSummary}
`;
}

/* ─── Build the initial message for story start ─── */
function buildStartMessage(setup) {
  const language = getLanguageConfig(setup.language);
  const era     = ERAS.find(e => e.id === setup.era)?.name     || setup.era;
  const faction = FACTIONS.find(f => f.id === setup.faction)?.name || setup.faction;
  const role    = ROLES.find(r => r.id === setup.role)?.name   || setup.role;
  const premise = PREMISES.find(p => p.id === setup.premise)?.name || setup.premise;
  const premSub = PREMISES.find(p => p.id === setup.premise)?.sub  || '';

  const roleContext = buildRoleContext(setup.role);

  return `Commence une histoire interactive Star Wars avec ces paramètres:
- Ère: ${era}
- Faction: ${faction}
- Rôle: ${role}
- Prémisse: ${premise} — ${premSub}
${roleContext}

Génère le prologue de l'histoire en ${language.promptName}. Plante le décor, introduis le personnage et crée une situation initiale captivante qui aboutit à un premier choix crucial.
Le personnage doit REFLETER ses attributs (particulièrement ${getRoleConfig(setup.role)?.attributes?.force > 50 ? 'sa connexion à la Force' : 'ses compétences'}) dans ses actions et réactionsinitiales.`;
}

/* ─── Build a continuation message ─────────────── */
function buildContinueMessage(choiceText, turnNumber, languageId, setup, userEdits = []) {
  const language = getLanguageConfig(languageId);
  const roleContext = buildRoleContext(setup.role);
  const userEditsContext = buildUserEditsContext(userEdits);

  return `Tour ${turnNumber} — Le joueur choisit: "${choiceText}"

${roleContext}
${userEditsContext}

Continue l'histoire en ${language.promptName} en tenant compte de ce choix. Les conséquences doivent être visibles et significatives. Maintiens la tension dramatique et propose de nouveaux choix.
Si le joueur a précédemment modifié des passages ("Votre version"), INTÈGRE CES ÉLÉMENTS naturellement dans la continuation du récit.`;
}

/* ─── Extract the largest well-formed JSON object from a raw string ─── */
function extractBestJson(raw) {
  const text = String(raw || '');
  const candidates = [];
  const stack = [];
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') {
      if (stack.length === 0) start = i;
      stack.push('{');
    } else if (c === '}') {
      stack.pop();
      if (stack.length === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  // Prefer the longest valid JSON (most complete candidate)
  candidates.sort((a, b) => b.length - a.length);
  for (const c of candidates) {
    try { return { text: c, parsed: JSON.parse(c) }; } catch {}
  }
  return null;
}

/* ─── Try to coerce an arbitrary shape into the expected schema ─── */
function coerceStorySchema(parsed, languageId = DEFAULT_LANGUAGE_ID) {
  if (!parsed || typeof parsed !== 'object') return null;
  // Already valid
  if (parsed.narrative && Array.isArray(parsed.choices)) return parsed;

  // Models often nest under "prologue", "scene", "chapter", etc.
  const prologue = parsed.prologue || parsed.scene || parsed.chapter || parsed.story || {};

  // Find narrative text
  let narrativeText = '';
  const narrCandidate =
    prologue.narrative_text || prologue.narrative || prologue.text ||
    parsed.narrative_text || parsed.text || '';
  if (typeof narrCandidate === 'string') narrativeText = narrCandidate;
  else if (narrCandidate && typeof narrCandidate === 'object') {
    narrativeText = narrCandidate[languageId] || narrCandidate.fr || narrCandidate.en || Object.values(narrCandidate)[0] || '';
  }

  // Find choices — could be array, object keyed by numbers, or nested
  let choicesRaw =
    prologue.choices || parsed.choices ||
    prologue.choices_consequences || parsed.choices_consequences || [];
  if (choicesRaw && typeof choicesRaw === 'object' && !Array.isArray(choicesRaw)) {
    choicesRaw = Object.values(choicesRaw);
  }
  const choices = (Array.isArray(choicesRaw) ? choicesRaw : [])
    .map(c => {
      if (typeof c === 'string') return { text: c };
      if (!c || typeof c !== 'object') return null;
      const text = c.text || c.description || c.label || c.name || c.action || '';
      return text ? {
        text: String(text).slice(0, 220),
        attribute: c.attribute || c.skill || 'survival',
        difficulty: Number(c.difficulty) || 2,
        faction_impact: c.faction_impact || {}
      } : null;
    })
    .filter(Boolean)
    .slice(0, 4);

  // If still no choices, try to extract numbered options from narrative text
  if (!choices.length && narrativeText) {
    const numbered = [...narrativeText.matchAll(/^\s*(?:\*\*)?\s*(\d+)[\.\)]\s*(?:\*\*)?\s*([^\n]{5,200})/gm)];
    numbered.slice(0, 4).forEach(m => {
      choices.push({
        text: m[2].replace(/\*+/g, '').trim(),
        attribute: 'survival', difficulty: 2, faction_impact: {}
      });
    });
  }

  if (!narrativeText && !choices.length) return null;

  return {
    chapter_title: parsed.chapter_title || prologue.scene_title || parsed.title || parsed.story_metadata?.title || 'Prologue',
    chapter_number: parsed.chapter_number || 1,
    section_type: parsed.section_type || 'action',
    narrative: {
      context: '',
      action: narrativeText,
      dialogue: '',
      reflection: '',
      atmosphere: parsed.atmosphere || prologue.atmosphere || 'tense'
    },
    choices,
    scene_description: parsed.scene_description || prologue.scene_description || 'Epic Star Wars cinematic scene with dramatic lighting',
    user_edits_applied: null
  };
}

/* ─── Parse LLM response with enhanced structure ─── */
function parseStoryResponse(raw, turnNumber = 1, languageId = DEFAULT_LANGUAGE_ID) {
  // Remove potential markdown code blocks
  let cleaned = String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Extract the largest well-formed JSON (handles duplicated / truncated outputs)
  const best = extractBestJson(cleaned);
  if (best) cleaned = best.text;

  try {
    const parsed = best?.parsed || JSON.parse(cleaned);

    // Try to coerce non-standard shapes (e.g. story_metadata/prologue wrappers)
    const coerced = coerceStorySchema(parsed, languageId);
    if (coerced && coerced.narrative && Array.isArray(coerced.choices) && coerced.choices.length) {
      Object.assign(parsed, {
        narrative: coerced.narrative,
        choices: coerced.choices,
        chapter_title: parsed.chapter_title || coerced.chapter_title,
        scene_description: parsed.scene_description || coerced.scene_description
      });
    }

    // Validate required fields
    if (!parsed.narrative || !Array.isArray(parsed.choices) || !parsed.choices.length) {
      throw new Error('Champs manquants');
    }

    // Normalize narrative to object format if string (legacy compatibility)
    const narrative = typeof parsed.narrative === 'string'
      ? {
          context: parsed.narrative.substring(0, 500),
          action: parsed.narrative,
          dialogue: '',
          reflection: '',
          atmosphere: 'tense'
        }
      : parsed.narrative;

    // Normalize choices to object format if strings (legacy compatibility)
    const choices = parsed.choices.map((choice, i) => {
      if (typeof choice === 'string') {
        return {
          text: choice,
          attribute: 'survival',
          difficulty: 2,
          faction_impact: {}
        };
      }
      return choice;
    });

    const safeTurnNumber = Number.isFinite(turnNumber) ? turnNumber : 1;

    return {
      chapter_title:     parsed.chapter_title     || 'L\'aventure continue',
      chapter_number:    parsed.chapter_number    || safeTurnNumber,
      section_type:      parsed.section_type      || 'action',
      narrative: {
        context:     narrative.context     || '',
        action:      narrative.action      || narrative || '',
        dialogue:    narrative.dialogue    || '',
        reflection:  narrative.reflection  || '',
        atmosphere:  narrative.atmosphere  || 'tense'
      },
      choices:           choices.slice(0, 4),
      scene_description: parsed.scene_description || 'Epic Star Wars cinematic scene with dramatic lighting',
      user_edits_applied: parsed.user_edits_applied || null
    };
  } catch (e) {
    // Fallback: try once more to coerce any JSON we found, else show a helpful message
    console.warn('JSON parse failed, using fallback:', e.message, { rawPreview: String(raw || '').slice(0, 400) });
    const safeTurnNumber = Number.isFinite(turnNumber) ? turnNumber : 1;

    // Last-resort coercion on the best JSON we could extract
    const best = extractBestJson(raw);
    if (best?.parsed) {
      const coerced = coerceStorySchema(best.parsed, languageId);
      if (coerced && coerced.choices.length) return coerced;
    }

    // Strip any JSON-looking garbage so the user sees readable text, not a dump
    const readable = String(raw || '')
      .replace(/```[a-z]*\s*/gi, '')
      .replace(/^\s*\{[\s\S]*\}\s*$/m, '')
      .trim() || 'Le modèle a renvoyé une réponse invalide. Essaie un autre modèle (ex: gpt-4o-mini, claude-3.5-sonnet) ou relance.';

    return {
      chapter_title: 'Réponse non structurée',
      chapter_number: safeTurnNumber,
      section_type: 'action',
      narrative: {
        context: '',
        action: readable.slice(0, 2000),
        dialogue: '',
        reflection: '',
        atmosphere: 'tense'
      },
      choices: [
        { text: 'Avancer avec prudence et observer les alentours', attribute: 'stealth', difficulty: 2, faction_impact: {} },
        { text: 'Agir rapidement et prendre l\'initiative', attribute: 'combat', difficulty: 3, faction_impact: {} },
        { text: 'Chercher des alliés potentiels dans les environs', attribute: 'diplomacy', difficulty: 2, faction_impact: {} },
        { text: 'Analyser la situation avant de décider', attribute: 'tech', difficulty: 1, faction_impact: {} }
      ],
      scene_description: 'Epic Star Wars cinematic scene with dramatic lighting',
      user_edits_applied: null
    };
  }
}

/* ─── HTML-escape a string to safely inject into innerHTML ─── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Clean narrative text: strip internal skill IDs, fix whitespace ─── */
function cleanNarrativeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Strip *snake_case_ids* (internal skill tokens the model leaks)
    .replace(/\*([a-z][a-z0-9_]*(?:_[a-z0-9]+)+)\*/gi, '')
    // Strip raw {placeholder} tokens
    .replace(/\{[a-z_][a-z0-9_]*\}/gi, '')
    // Collapse multiple spaces
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/* ─── Normalize dialogue (string | array | object) into HTML ─── */
function formatDialogue(dialogue) {
  if (!dialogue) return '';
  // Array of exchanges: [{speaker, text} | {name, line} | "raw"]
  if (Array.isArray(dialogue)) {
    return dialogue.map(entry => {
      if (!entry) return '';
      if (typeof entry === 'string') return `<p>${escapeHtml(cleanNarrativeText(entry))}</p>`;
      const speaker = entry.speaker || entry.name || entry.character || entry.who || '';
      const line = entry.text || entry.line || entry.dialogue || entry.say || '';
      if (!line) return '';
      return speaker
        ? `<p><strong class="dialogue-speaker">${escapeHtml(speaker)} :</strong> ${escapeHtml(cleanNarrativeText(line))}</p>`
        : `<p>${escapeHtml(cleanNarrativeText(line))}</p>`;
    }).filter(Boolean).join('');
  }
  // Single exchange object
  if (typeof dialogue === 'object') {
    const speaker = dialogue.speaker || dialogue.name || dialogue.character || '';
    const line = dialogue.text || dialogue.line || dialogue.dialogue || '';
    if (!line && !speaker) return '';
    return speaker
      ? `<p><strong class="dialogue-speaker">${escapeHtml(speaker)} :</strong> ${escapeHtml(cleanNarrativeText(line))}</p>`
      : `<p>${escapeHtml(cleanNarrativeText(line))}</p>`;
  }
  // Plain string — split on newlines for readability
  const cleaned = cleanNarrativeText(dialogue);
  return cleaned.split(/\n+/).filter(Boolean).map(l => `<p>${escapeHtml(l)}</p>`).join('');
}

/* ─── Format narrative for display ───────────── */
function formatNarrative(story) {
  const { context, action, dialogue, reflection, atmosphere } = story.narrative;
  const atmosphereClass = `atmosphere-${atmosphere}`;

  const cContext    = cleanNarrativeText(context);
  const cAction     = cleanNarrativeText(action);
  const cReflection = cleanNarrativeText(reflection);
  const dialogueHtml = formatDialogue(dialogue);

  let html = `<div class="narrative-container ${atmosphereClass}">`;

  if (cContext) {
    html += `<div class="narrative-section context">
      <span class="section-label">${t('context')}</span>
      <p>${escapeHtml(cContext)}</p>
    </div>`;
  }

  if (cAction) {
    html += `<div class="narrative-section action">
      <span class="section-label">${t('action')}</span>
      <p>${escapeHtml(cAction)}</p>
    </div>`;
  }

  if (dialogueHtml) {
    html += `<div class="narrative-section dialogue">
      <span class="section-label">${t('dialogue')}</span>
      <div class="dialogue-content">${dialogueHtml}</div>
    </div>`;
  }

  if (cReflection) {
    html += `<div class="narrative-section reflection">
      <span class="section-label">${t('reflection')}</span>
      <p><em>${escapeHtml(cReflection)}</em></p>
    </div>`;
  }

  html += '</div>';
  return html;
}

/* ─── Format single narrative text as paragraphs ─── */
function formatNarrativeSimple(text) {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* ─── Get atmosphere color ───────────────────── */
function getAtmosphereColor(atmosphere) {
  const colors = {
    lumineux: '#FFE81F',
    sombre: '#1a1a2e',
    tense: '#FF6B35',
    mystiques: '#8E24AA',
    apocalyptique: '#B71C1C',
    nostalgique: '#81D4FA'
  };
  return colors[atmosphere] || '#FFE81F';
}

/* ─── Build collaborative edit prompt ────────── */
function buildCollaborativeEditMessage(originalNarrative, userText, turnNumber, languageId) {
  const language = getLanguageConfig(languageId);

  return `L'utilisateur propose cette modification pour le Tour ${turnNumber}:

Original: "${originalNarrative}"

Modification de l'utilisateur: "${userText}"

Langue: ${language.promptName}

Si cette modification est appropriée et cohérente avec l'univers Star Wars et le ton de l'histoire, confirme son intégration. Sinon, adapte-la légèrement pour qu'elle s'intègre naturellement au récit.

Réponds avec:
{
  "approved": true|false,
  "integrated_text": "Le texte modifié ou adapté",
  "note": "Brief note on integration"
}`;
}
