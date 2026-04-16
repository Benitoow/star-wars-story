/* ═══════════════════════════════════════════════
   story.js — Enhanced prompt building & story parsing
   Includes structured narrative sections and collaborative mode
══════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Tu es un maître narrateur de l'univers Star Wars, expert en lore canonique et Legends. Tu crées des histoires immersives, cinématographiques et émotionnellement riches.

RÈGLES STRICTES:
1. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour.
2. Le JSON doit avoir exactement cette structure:
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
9. Les dialogues doivent avoir du caractère - chaque personnage a sa propre façon de parler.`;

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

/* ─── Parse LLM response with enhanced structure ─── */
function parseStoryResponse(raw) {
  // Remove potential markdown code blocks
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Extract JSON object if surrounded by text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];

  try {
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.narrative || !Array.isArray(parsed.choices)) {
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

    return {
      chapter_title:     parsed.chapter_title     || 'L\'aventure continue',
      chapter_number:    parsed.chapter_number    || turnNumber || 1,
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
    // Fallback: return raw text with generic choices
    console.warn('JSON parse failed, using fallback:', e.message);
    return {
      chapter_title: 'L\'aventure continue',
      chapter_number: turnNumber || 1,
      section_type: 'action',
      narrative: {
        context: cleaned.substring(0, 300),
        action: cleaned,
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

/* ─── Format narrative for display ───────────── */
function formatNarrative(story) {
  const { context, action, dialogue, reflection, atmosphere } = story.narrative;
  const atmosphereClass = `atmosphere-${atmosphere}`;

  let html = `<div class="narrative-container ${atmosphereClass}">`;

  // Context section
  if (context) {
    html += `<div class="narrative-section context">
      <span class="section-label">${t('context')}</span>
      <p>${context}</p>
    </div>`;
  }

  // Action section
  if (action) {
    html += `<div class="narrative-section action">
      <span class="section-label">${t('action')}</span>
      <p>${action}</p>
    </div>`;
  }

  // Dialogue section (if present)
  if (dialogue) {
    html += `<div class="narrative-section dialogue">
      <span class="section-label">${t('dialogue')}</span>
      <div class="dialogue-content">${dialogue}</div>
    </div>`;
  }

  // Reflection section (if present)
  if (reflection) {
    html += `<div class="narrative-section reflection">
      <span class="section-label">${t('reflection')}</span>
      <p><em>${reflection}</em></p>
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
