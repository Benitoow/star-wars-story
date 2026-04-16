# Star Wars Interactive Story — Enhanced System Specification

## 1. Project Overview

**Project Name:** Star Wars — Histoire Interactive IA  
**Type:** Single-page interactive narrative web application  
**Core Functionality:** AI-powered choose-your-own-adventure Star Wars stories with immersive visuals, role-based gameplay, multilingual support, and collaborative storytelling.  
**Target Users:** Star Wars fans who want personalized, AI-generated interactive stories in the Star Wars universe.

---

## 2. Visual System & SVG Organization

### 2.1 SVG Asset Architecture

#### Faction SVGs (9 total)
Each faction has a dedicated SVG icon that clearly represents its identity:

| Faction ID | Name | SVG Icon | Color | File Reference |
|------------|------|----------|-------|----------------|
| `jedi` | Ordre Jedi | Jedi crest (rays) | #4FC3F7 | config.js: SVG.jedi |
| `sith` | Ordre Sith | T-cross symbol | #FF1744 | config.js: SVG.sith |
| `empire` | Empire Galactique | 12-petal imperial crest | #e0e0e0 | config.js: SVG.empire |
| `rebels` | Alliance Rebelle | Phoenix crest | #FF6B35 | config.js: SVG.rebel |
| `republic` | République Galactique | Circular sigil | #81D4FA | config.js: SVG.republic |
| `mandalore` | Mandalorians | Mythosaur skull | #A5D6A7 | config.js: SVG.mando |
| `first_order` | Premier Ordre | Hexagonal crest | #B71C1C | config.js: SVG.firstOrder |
| `hutt` | Cartel Hutt | H with halo | #FFE082 | config.js: SVG.hutt |
| `neutral` | Indépendant | Hooded silhouette | #bdbdbd | config.js: SVG.wanderer |

#### Role SVGs (20 roles with distinct icons)
Each role has a unique SVG icon representing their class/archetype:

| Role ID | Name | SVG Icon | Faction Association |
|---------|------|----------|---------------------|
| `jedi_knight` | Chevalier Jedi | Blue lightsaber | jedi |
| `jedi_master` | Maître Jedi | Jedi crest | jedi |
| `padawan` | Padawan | Jedi with braid | jedi |
| `sith_apprentice` | Apprenti Sith | Red lightsaber | sith |
| `sith_lord` | Seigneur Sith | Sith crest | sith |
| `inquisitor` | Inquisiteur | Ring lightsaber | empire |
| `nightsister` | Sœur de la Nuit | Dathomir witch | neutral |
| `mandalorian` | Mandalorien | Mythosaur helmet | mandalore |
| `bounty_hunter` | Chasseur de primes | Boba Fett helmet | neutral |
| `smuggler` | Contrebandier | Millennium Falcon silhouette | neutral |
| `mercenary` | Mercenaire | Dual blasters | neutral |
| `pilot` | As de l'Espace | X-Wing fighter | rebels |
| `clone_trooper` | Soldat Clone | Clone helmet | republic |
| `stormtrooper` | Stormtrooper | Imperial stormtrooper | empire |
| `imperial_officer` | Officier Impérial | Imperial officer cap | empire |
| `senator` | Sénateur | Senatorial robes | republic |
| `spy` | Agent Secret | Spy/undercover | neutral |
| `engineer` | Ingénieur | Gear/cog symbol | neutral |
| `medic` | Médecin de Terrain | Medical symbol | neutral |
| `droid` | Droïde Avancé | Astromech droid | neutral |

### 2.2 SVG Display System
- Role selection cards show: SVG icon, role name, faction badge, subtitle
- Faction selection cards show: SVG icon, faction name, description, member count indicator
- Selected states clearly highlight with faction color glow
- SVG icons rendered inline using currentColor for theming adaptability

---

## 3. Expanded Role System

### 3.1 Role Attributes
Each role has 6 core attributes (0-100 scale):

| Attribute | Description |
|-----------|-------------|
| `combat` | Combat prowess, lightsaber/blaster skills |
| `diplomacy` | Persuasion, negotiation, political acumen |
| `stealth` | Sneaking, espionage, infiltration |
| `tech` | Mechanical, hacking, droid interaction |
| `force` | Force sensitivity level (0 if non-Force users) |
| `survival` | Endurance, resourcefulness, adaptability |

### 3.2 Role Skills
Each role has 4 unique skills that define their capabilities:

```
jedi_knight:
  - lightsaber_combat: "Maîtrise du sabre laser à double lame"
  - force_push: "Manipulation de la Force pour repousser les obstacles"
  - force_sense: "Perception des intentions et émotions"
  - parry: "Déviation des tirs d'énergie"

sith_lord:
  - force_lightning: "Éclair de Force dévastateur"
  - force_choke: "Strangulation à distance"
  - mind_trick: "Manipulation mentale advanced"
  - force_drain: "Absorption de la vie"

mandalorian:
  - jetpack: "机动跃迁"
  - beskar_armor: "装甲防护"
  - hunter_instincts: "猎人本能"
  - weapons_expert: "武器专家"
```

### 3.3 Role-Faction Interactions
- **Jedi roles** get bonuses when aligned with `republic` or `neutral`
- **Sith roles** get bonuses when aligned with `empire` or `first_order`
- **Mandalorian** can join any faction but retains `mandalore` heritage bonuses
- **Bounty Hunter/Smuggler** get unique dialogue options with `hutt` faction
- **Clone/Stormtrooper** roles have forced faction alignment (cannot choose `neutral`)

### 3.4 Cross-Role Dynamics
- Jedi + Sith encounters: Force confrontation scenarios
- Mandalorian + Bounty Hunter: Shared `mandalore` culture dialogue
- Pilot + Spy: Space station infiltration missions
- Engineer + Droid: Technical puzzle solutions
- Medic + any: Healing/support dialogue trees

---

## 4. Narrative System

### 4.1 Story Structure
Each chapter follows a thematic structure:

```json
{
  "chapter_title": "Titre du chapitre",
  "chapter_number": 1,
  "section_type": "confrontation|exploration|dialogue|reflection|action",
  "narrative": {
    "context": "Contexte historique ou situation actuelle",
    "action": "Événements en cours avec descriptions sensorielles",
    "dialogue": "Échanges verbaux avec styles vocaux distinctifs",
    "reflection": "Monologue intérieur ou Gedanken"
  },
  "choices": [
    {
      "text": "Texte du choix",
      "required_attribute": "combat|diplomacy|stealth|tech|force|survival",
      "difficulty": 1-5,
      "faction_impact": {"empire": -10, "rebels": +10}
    }
  ],
  "scene_description": "English description for image generation",
  "atmosphere": "lumineux|sombre|tense|mystique|apocalyptique"
}
```

### 4.2 Narrative Sections
- **Contexte Historique:** Backstory elements, galaxy state, faction politics
- **Événements Marquants:** Key plot points with cinematic descriptions
- **Enjeux Actuels:** Current stakes and consequences of actions
- **Dialogues/Monologues:** Character voice with distinct personality
- **Descriptions Atmosphériques:** Environmental sensory details

### 4.3 Language-Varied Writing
- Rotate sentence structures (short/medium/long)
- Alternate between action, description, dialogue
- Use Star Wars-specific vocabulary and terminology
- Avoid repetition of phrases across chapters

---

## 5. Multilingual Support

### 5.1 UI Languages (8)
Interface elements in: French (FR), English (EN), Spanish (ES), German (DE), Italian (IT), Portuguese (PT), Japanese (JA), Chinese (ZH)

### 5.2 Instant Language Switching
- Language selector in header, always accessible
- No page reload required
- All UI text updates instantly via `t()` translation function
- User preference saved to localStorage

### 5.3 Translation Scope
UI Elements translated:
- Menu labels and buttons
- Setup section headers
- Role/faction descriptions
- Error messages
- Placeholder text
- Tooltips and hints

NOT translated (always in selected narration language):
- Story narrative content
- Chapter titles
- Choice text
- Scene descriptions

---

## 6. Collaborative Mode

### 6.1 User Interpretation Space
After each chapter's AI narrative, users can:
- **Rewrite passages:** Edit any paragraph of the AI's narrative
- **Add details:** Insert additional descriptions, memories, or backstory
- **Alternative interpretation:** Provide alternate version of events
- **Character thoughts:** Add inner monologue for their character

### 6.2 Collaboration UI
- "Votre version" expandable panel below AI narrative
- Rich text editing with formatting options
- Character count indicator
- "Incorporer à l'histoire" button to save edits

### 6.3 Integration Flow
1. AI presents chapter narrative
2. User reads, then expands "Votre version" panel
3. User writes/edits their interpretation
4. User clicks "Agir" to continue, their version is appended to context
5. Next chapter considers user's additions in context

---

## 7. Image Generation System

### 7.1 Provider Network
Primary providers with automatic fallback:
1. OpenRouter (gemini-2.5-flash-image, gpt-5-image)
2. fal.ai (FLUX Schnell, Recraft V3, Ideogram V2)
3. Together AI (FLUX.1 Schnell Free, FLUX.1 Dev)
4. DALL-E 3 (fallback)
5. Stability AI (SD Ultra)

### 7.2 Robustness Mechanisms
- **Automatic retry:** 3 attempts with exponential backoff
- **Fallback chain:** Try next provider if primary fails
- **Placeholder:** Elegant Star Wars-themed placeholder on total failure
- **Timeout:** 30-second timeout per attempt
- **User notification:** Subtle indicator if image generation fails

### 7.3 Image Display
- Aspect ratio: 16:7 cinematic
- Border glow matching faction color
- Loading shimmer animation
- Click to enlarge modal view

---

## 8. Technical Architecture

### 8.1 File Structure
```
star-wars-story/
├── index.html           # Main HTML with new UI elements
├── favicon.svg          # Rebel Alliance phoenix
├── css/
│   └── style.css        # Extended with new styles
├── js/
│   ├── app.js           # Main logic, UI language switching, collaboration
│   ├── config.js        # Expanded roles, attributes, skills, I18N
│   ├── api.js           # Image generation with fallback
│   └── story.js         # Enhanced narrative structure
└── svg/                 # External SVG assets (used in config.js as inline)
```

### 8.2 State Management
```javascript
const state = {
  provider: null,
  apiKey: '',
  model: null,
  imgProvider: 'none',
  imgModel: null,
  imgApiKey: '',
  uiLang: 'fr',           // NEW: UI language preference
  setup: {
    language: null,        // Narration language
    era: null,
    faction: null,
    role: null,
    premise: null
  },
  userEdits: [],          // NEW: Collaborative mode edits
  messages: [],
  turn: 0,
  isGenerating: false,
  currentChapter: null    // NEW: For collaborative mode
};
```

### 8.3 Key Functions
- `switchUILanguage(langId)` - Instant UI language change
- `saveUserEdit(chapterNum, editedText)` - Store collaborative edits
- `applyUserEditsToContext()` - Include edits in next prompt
- `generateImageWithFallback(prompt)` - Robust image generation
- `renderNarrativeSection(narrativeObj)` - Structured narrative display

---

## 9. New UI Components

### 9.1 Language Switcher
- Compact dropdown in story header
- Shows current language code (FR, EN, etc.)
- Hover shows full language name
- Checkmark on current selection

### 9.2 Role Detail Panel
- Expands on role hover/click
- Shows: Name, faction, 6 attributes with bars, 4 skills with descriptions
- Color-coded by faction

### 9.3 Collaborative Panel
- Collapsed by default: "Votre version des événements"
- Expands to show textarea with Star Wars-themed styling
- "Incorporer" button to save
- Shows history of user's edits

### 9.4 Image Generation Status
- Loading: Animated lightsaber blade extending
- Success: Image with faction-colored border
- Failed: Star Wars-themed placeholder with retry option

---

## 10. Acceptance Criteria

### SVG Organization
- [ ] Each faction has exactly one clear, recognizable SVG icon
- [ ] Each role has a unique SVG that cannot be confused with another role
- [ ] No missing SVG assignments - all 9 factions and 20 roles have icons

### Role System
- [ ] All 20 roles have 6 attributes and 4 skills defined
- [ ] Role selection shows attributes/skills in detail panel
- [ ] Cross-role interactions affect narrative options

### Narrative
- [ ] Chapters include context, action, dialogue, and atmospheric sections
- [ ] Writing style varies to maintain engagement
- [ ] Each choice shows potential attribute checks and faction impacts

### Multilingual
- [ ] UI switches instantly between 8 languages without page reload
- [ ] All UI text properly translated in all 8 languages
- [ ] Story content remains in selected narration language

### Collaborative
- [ ] Users can edit any narrative passage after AI presents it
- [ ] User edits are included in subsequent story generation
- [ ] Edit history is preserved and viewable

### Image Generation
- [ ] Images generate successfully for >95% of attempts
- [ ] Fallback providers activate on primary failure
- [ ] User sees clear feedback on generation status
