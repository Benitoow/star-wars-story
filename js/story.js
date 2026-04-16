/* ═══════════════════════════════════════════════
   story.js — Prompt building & story parsing
═══════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Tu es un maître narrateur de l'univers Star Wars, expert en lore canonique et Legends. Tu crées des histoires immersives, cinématographiques et émotionnellement riches.

RÈGLES STRICTES:
1. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour.
2. Le JSON doit avoir exactement cette structure:
{
  "chapter_title": "Titre court et évocateur du chapitre (max 40 chars)",
  "narrative": "Récit narratif à la 2ème personne (3-4 paragraphes, ~250-350 mots). Richesse sensorielle, tension dramatique, dialogues possibles.",
  "choices": ["Choix A (20-40 mots)", "Choix B (20-40 mots)", "Choix C (20-40 mots)", "Choix D (20-40 mots)"],
  "scene_description": "Description courte en anglais de la scène pour génération d'image (max 60 mots)"
}
3. Les choix doivent être significativement différents et avoir des conséquences narratives importantes.
4. Reste cohérent avec l'ère, la faction et le rôle choisis.
5. Utilise le lore Star Wars authentique: noms de planètes, technologie, factions.
6. La narration est à la 2ème personne du singulier ("vous découvrez", "vous ressentez").`;

/**
 * Build the initial message for story start
 */
function buildStartMessage(setup) {
  const era     = ERAS.find(e => e.id === setup.era)?.name     || setup.era;
  const faction = FACTIONS.find(f => f.id === setup.faction)?.name || setup.faction;
  const role    = ROLES.find(r => r.id === setup.role)?.name   || setup.role;
  const premise = PREMISES.find(p => p.id === setup.premise)?.name || setup.premise;
  const premSub = PREMISES.find(p => p.id === setup.premise)?.sub  || '';

  return `Commence une histoire interactive Star Wars avec ces paramètres:
- Ère: ${era}
- Faction: ${faction}
- Rôle: ${role}
- Prémisse: ${premise} — ${premSub}

Génère le prologue de l'histoire. Plante le décor, introduis le personnage et crée une situation initiale captivante qui aboutit à un premier choix crucial.`;
}

/**
 * Build a continuation message after a player choice
 */
function buildContinueMessage(choiceText, turnNumber) {
  return `Tour ${turnNumber} — Le joueur choisit: "${choiceText}"

Continue l'histoire en tenant compte de ce choix. Les conséquences doivent être visibles et significatives. Maintiens la tension dramatique et propose de nouveaux choix.`;
}

/**
 * Parse LLM response, handle malformed JSON gracefully
 */
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
    return {
      chapter_title:     parsed.chapter_title     || 'L\'aventure continue',
      narrative:         parsed.narrative         || '',
      choices:           (parsed.choices || []).slice(0, 4),
      scene_description: parsed.scene_description || 'Star Wars cinematic scene'
    };
  } catch (e) {
    // Fallback: return raw text with generic choices
    console.warn('JSON parse failed, using fallback:', e.message);
    return {
      chapter_title: 'L\'aventure continue',
      narrative: cleaned,
      choices: [
        'Avancer avec prudence et observer les alentours',
        'Agir rapidement et prendre l\'initiative',
        'Chercher des alliés potentiels dans les environs',
        'Analyser la situation avant de décider'
      ],
      scene_description: 'Epic Star Wars cinematic scene with dramatic lighting'
    };
  }
}

/**
 * Format narrative text as paragraphs
 */
function formatNarrative(text) {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');
}
