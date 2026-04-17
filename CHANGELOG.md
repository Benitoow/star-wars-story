# Changelog

## v1.0.0 — 2026-04-17

Première release officielle du site **Star Wars Story**.

### ✨ Nouveautés majeures
- Onboarding narratif en plusieurs étapes (identité, intensité, configuration).
- Dashboard local-first pour créer, ouvrir et supprimer les histoires.
- Reprise de session depuis le dashboard (tour/chapitre/messages/choix restaurés).
- Mémoire de trame persistante avec journaux cachés (compétences, relations, factions, camp, protagoniste).
- Système de progression cachée et conséquences narratives plus riches.
- Rendu narratif amélioré avec sections (contexte, action, dialogue, réflexion).
- Correctif dialogue pour éviter l'affichage `[object Object]`.

### 🖼️ Image & providers
- Gestion multi-providers texte/image.
- Fallbacks robustes en cas d’échec d’API image.

### 🧠 Robustesse IA
- Parsing JSON renforcé.
- Validation légère des sorties pour modèles faibles.
- Coercition de schéma pour formats de réponse imparfaits.

### 🛠️ Notes techniques
- Application statique compatible GitHub Pages.
- Données utilisateur stockées en local (`localStorage`).

### 📚 Historique complet des commits (37)

> Ordre chronologique (du plus ancien au plus récent).

- `c4f9d22` — 2026-04-16 — Initial commit: Star Wars Interactive Story
- `3a18b82` — 2026-04-16 — Add GitHub Actions workflow for GitHub Pages deployment
- `e7780f5` — 2026-04-16 — feat: real brand SVGs, model search, title fix, OpenRouter images
- `45acd86` — 2026-04-16 — feat: fonts SF Distant Galaxy/Chakra Petch, Groq/Together SVGs, image providers++
- `3fcb105` — 2026-04-16 — Fix CSS overflow, official faction/era SVGs, new provider logos, favicon
- `c356e82` — 2026-04-16 — feat: add choice mask styles and update faction SVGs in config
- `f539694` — 2026-04-16 — feat: add language selection feature and update story prompts
- `cdcedff` — 2026-04-16 — feat: Enhance story.js with structured narrative sections and collaborative editing features
- `218a225` — 2026-04-16 — feat: unify story and UI language settings; remove narration language selector
- `21e9dc0` — 2026-04-16 — feat: add trash management page with story restoration and deletion features
- `9438801` — 2026-04-16 — Add SVG files for various Star Wars emblems and icons
- `e1cf9b2` — 2026-04-16 — feat: add dashboard screen for story management and enhance story handling
- `7ca0702` — 2026-04-16 — feat: add text model editing button and functionality in dashboard
- `f5c9db4` — 2026-04-16 — refactor: remove redundant setup section label updates in UI language function
- `cd45049` — 2026-04-16 — feat: enhance story parsing with turn number support and update choice icon rendering
- `ab5c9fe` — 2026-04-16 — feat: update dashboard styles for improved responsiveness and readability
- `52984c2` — 2026-04-16 — feat: increase gap in dashboard hero copy for improved layout
- `a770bf6` — 2026-04-16 — feat: add UI language selection and localization support
- `08f9a9c` — 2026-04-16 — feat: enhance story editor with icon support for eras, factions, and roles
- `2b6a354` — 2026-04-16 — feat: add API key validation and improve error handling in API calls
- `0953928` — 2026-04-16 — fix: normalize SVG reference handling in renderChoiceIcon function
- `268976a` — 2026-04-16 — refactor: remove unused role detail panel and update story menu button styling
- `63ee7a0` — 2026-04-16 — fix: update OpenRouter endpoint for image generations and add SVG caching for choice icons
- `f76e252` — 2026-04-16 — style: fix header layout by adjusting flex properties for better alignment
- `8641963` — 2026-04-16 — fix: enhance SVG handling in stylizeChoiceSvg function to ensure proper attributes and class assignment
- `4b3864d` — 2026-04-16 — fix: improve error handling in callLLM function and enhance formatProviderError for better debugging
- `767efda` — 2026-04-16 — fix: update OpenRouter endpoint for image generations and enhance error handling in LLM response parsing
- `dd8a9d6` — 2026-04-16 — fix: update script versioning in index.html for consistency
- `cde625e` — 2026-04-16 — fix: enhance narrative section styling and animation, improve dialogue formatting and escaping
- `8f1fa3b` — 2026-04-16 — fix: update OpenRouter endpoint for image generation and enhance error handling in tryImageProvider function
- `a4e2c0e` — 2026-04-17 — fix: add first name input for character setup and enhance story memory handling
- `ef04e01` — 2026-04-17 — fix: update styling for improved readability and enhance narrative text cleaning functionality
- `9c80ca9` — 2026-04-17 — fix: enhance narrative formatting by restructuring display logic and improving section handling
- `3b309ad` — 2026-04-17 — fix: enhance skill progress management by adding hidden skill tracking and improving memory handling
- `cab773e` — 2026-04-17 — feat: enhance story schema with relationship, reputation, and camp updates
- `b5c799c` — 2026-04-17 — feat: add identity and intensity screens with character name inputs and narrative intensity options
- `9bf17ce` — 2026-04-17 — chore: prepare v1.0.0 release metadata and changelog
