# Changelog

## Unreleased — 2026-04-19

### Lot 4 — Single source of truth config

- Centralisation des providers/modèles/defaults/aliases dans `src/lib/config/providers.ts`
- Migration des consommateurs principaux : `settings/+page.svelte`, `storyEngine.ts`, `db/index.ts`, `persistence/index.ts`
- Compatibilité legacy renforcée via alias image `openrouter -> openrouter_img`

### Lot 5 — Runtime & PWA hardening

- `static/sw.js` renforcé : caches séparés shell/runtime, `navigationPreload`, stratégie HTML network-first, assets stale-while-revalidate
- Ajout d’un fallback hors ligne dédié : `static/offline.html`
- Lifecycle SW géré côté app (`src/routes/+layout.svelte`) : update detection, `SKIP_WAITING`, rechargement contrôlé
- Garde-fous runtime : toasts online/offline et persistance des préférences avec gestion d’erreurs

### Lot 6 — Repo cleanup & docs sync

- Harmonisation de la route canonique de création (`/stories/new`) dans les points d’entrée UI
- Documentation synchronisée (README/SPEC/CHANGELOG) avec l’état réel du projet
- Validation complète post-cleanup : lint, check, test, build

## v2.0.0 — 2026-04-18

### Moteur narratif agentique (refonte majeure)

- **Tool calling natif OpenRouter** — l'IA appelle des fonctions réelles au lieu de générer un JSON monolithique : `set_scene`, `update_world`, `update_npc`, `update_faction`, `add_memory`, `offer_choices`, `finalize_turn`
- **Boucle agentique multi-étapes** (jusqu'à 8 steps/tour) — l'IA raisonne puis agit, les outils s'enchaînent dynamiquement
- **Agent de simulation galactique** — second agent de fond qui simule les événements du monde (batailles, élections, crises) pendant que le joueur joue
- **Fallback JSON structuré** automatique pour les providers sans tool calling

### Living World State

- **`PlayerState`** — HP (0–100), crédits, lieu, date narrative, blessures actives (`active`/`healing`/`critical`), inventaire avec quantités
- **`NpcRelation`** — affinité −100..100, statut (allié/neutre/hostile/mort/inconnu), faction, note, `last_seen`
- **`FactionStandings`** — réputation −100..100 pour Empire, Alliance, Jedi, Sith, Hutt Cartel, Mandalorien, Neutre
- **`ChronologyEntry`** — journal horodaté des événements avec tag de type (combat, dialogue, découverte…)
- **`StateUpdate` delta-based** — deltas HP/crédits, upsert NPCs par nom, clamp factions, résolution/ajout de blessures, fusion inventaire, appends chronologie

### GameHUD — interface monde vivant

- Nouveau composant `GameHUD.svelte` — panneau flottant collapsible en jeu (coin supérieur droit)
- Barre HP colorée (vert → jaune → rouge), crédits, lieu, date narrative
- Liste des blessures actives avec icônes de sévérité
- NPCs trackés avec dot d'affinité coloré + score
- Barres mini factions avec label et valeur
- Design dark theme, bordure dorée, backdrop blur

### Conséquences mécaniques sur les choix

- HP < 20 → choix `combat` / `force` marqués ⚠ + `diffBonus` +2
- Blessure grave active → choix `combat` / `stealth` marqués ⚠ + `diffBonus` +1
- Crédits ≤ 0 + mots-clés paiement → choix désactivés (bouton grisé)

### Rythme narratif intelligent

- Enum `section_type` (8 types) : `action`, `dialogue`, `exploration`, `tension`, `revelation`, `repos`, `interlude`, `confrontation`
- Suivi des 5 derniers `section_type` dans `chapterHistory`
- 2+ scènes intenses consécutives → directive GM : "ce tour DOIT être repos/dialogue/interlude"
- 3+ scènes intenses consécutives → directive renforcée avec interdiction explicite d'action/combat

### OpenRouter — provider n°1

- OpenRouter promu **provider par défaut et recommandé**
- Modèle par défaut : `google/gemma-3-27b-it:free` (gratuit, aucun crédit requis)
- Liste modèles étendue : free tier d'abord (Gemma, Llama, Mistral, Qwen), puis payants
- Badges mis à jour : `⚡ Agentique`, `Tool calling natif`, `400+ modèles`
- Détection `supportsAgenticToolCalling()` pour activer/désactiver la boucle agentique

### Model chip dans la topbar de jeu

- Chip discret affichant le modèle actif pendant le jeu (nom court sans préfixe provider)
- Dot vert pulsant si mode agentique actif (`⚡`)
- Tooltip avec statut complet du provider

### Favicons & PWA icons

- Nouvelle source `fav.jpg` → génération de toutes les tailles PWA via Sharp
- `favicon.ico` multi-size (16 / 32 / 48 px) assemblé manuellement
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`
- `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (PWA installable)
- `apple-touch-icon.png` 180×180 (iOS)
- `manifest.json` mis à jour avec l'array d'icônes complet + version 2.0.0

### Corrections de bugs

- **Réactivité du nombre de modèles** dans Settings — `getTextProviderModels()` n'était pas réactif dans Svelte ; remplacé par des déclarations `$:` dérivées
- **Guillemets typographiques** (U+2018/U+2019) introduits par les éditions IA cassaient le parsing TypeScript/Svelte — corrigés, chaînes françaises converties en template literals
- **Corbeille** — `loadTrash()` renvoyait toutes les histoires ; filtre `isDeleted === true` ajouté
- **Modèle par défaut DB** — `textModel` mis à jour vers `google/gemma-3-27b-it:free` dans le schéma Dexie

### Documentation

- `README.md` entièrement réécrit pour v2.0 — sections FR + EN, tableau modèles OpenRouter, arbre architecture, stack technique
- `CHANGELOG.md` mis à jour

---

## v1.2.0 — 2026-04-17

### Bugfixes & cleanup (SvelteKit app)

- **Added `showToast` helper** to `ui.ts` — was used in every route but never exported, breaking all notifications.
- **Fixed editor store usage** — `currentSetup` was mutated directly (invalid on a derived store); replaced with `updateSetupField()`. `story.update()` on a derived store replaced with `updateContent()`. Textarea `bind:value` on a read-only store replaced with controlled `value` + `on:input`.
- **Fixed trash page** — `loadTrash()` returned all stories (deleted and active); now filters to `isDeleted === true` only.
- **Removed duplicate `<Sidebar>` and `<Header>`** from settings, editor, and trash pages — the layout already renders them, causing double sidebars and headers.
- **Created `PageHeader.svelte`** component — per-page title bar with back button and actions slot, used by settings, editor, and trash.
- **Removed phantom Image Generation settings** — DALL-E / Stable Diffusion / Midjourney UI options had no implementation behind them.
- **Wired keyboard shortcuts** in layout — `Ctrl+N` (new story), `Ctrl+F` (search), `Ctrl+B` (sidebar), `Ctrl+,` (settings) now actually work.
- **Added Dexie v3 index** for `setup.era` and `setup.faction` — dashboard filters previously triggered full table scans.
- **Fixed `index.html`** — replaced invalid double-`<html>` document (legacy app stub prepended to full HTML) with a clean dev instructions page.
- **Cleaned up `sw.js`** — removed dead background sync stub (`syncStories`) that only logged to console.
- **Added build config** — `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json` were missing from the repository, making the project impossible to install or build.

## v1.1.2 — 2026-04-17

### Technical reset (legacy retirement)
- Moved the legacy vanilla JS runtime from repository root into `archives/legacy-js/`.
- Added a root `index.html` transition stub.
- Updated documentation to reflect a Svelte-first codebase.

## v1.1.1 — 2026-04-17

### Hotfix
- Fixed `stringifyNarrativeValue` not available in the camp summary path (legacy runtime).

## v1.1.0 — 2026-04-17

### Cloudflare release cleanup
- Archived the classic vanilla JS prototype.
- Clarified that the playable version lives on the Cloudflare-hosted site.
- Removed the GitHub Pages deployment workflow.

## v1.0.0 — 2026-04-17

First official release of **Star Wars Story** (legacy vanilla JS runtime).

- Multi-step story onboarding (identity, tone intensity, setup).
- Local-first dashboard to create, open, and manage stories.
- Full session resume support (turn, chapter, messages, choices).
- Multi-provider text/image handling with fallback behavior.
- Stronger JSON parsing and schema coercion for API responses.
