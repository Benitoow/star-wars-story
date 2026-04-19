# Star Wars Story Manager — v2.0.0

> Créez et vivez des histoires Star Wars interactives propulsées par IA agentique.

[![Cloudflare Pages](https://img.shields.io/badge/Deployed-Cloudflare%20Pages-orange)](https://cloudflare.com)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.5-FF3E00)](https://kit.svelte.dev)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-primary%20provider-7C3AED)](https://openrouter.ai)

---

## Français

### Présentation

Star Wars Story Manager est une PWA locale-first qui permet de vivre des histoires interactives Star Wars guidées par une IA Maître du Jeu. L'IA ne se contente pas de narrer — elle gère un monde vivant : état du joueur, PNJs avec mémoire, factions, chronologie, blessures, ressources.

### Fonctionnalités principales

**Moteur narratif agentique (v2.0)**
- L'IA utilise le **tool calling natif** d'OpenRouter pour appeler des fonctions réelles (`set_scene`, `update_world`, `update_npc`, `update_faction`, `offer_choices`) au lieu de générer un JSON monolithique
- Boucle agentique multi-étapes (jusqu'à 8 steps/tour) — l'IA peut raisonner puis agir
- Événements galactiques hors-scène : un second agent simule le monde pendant que le joueur joue
- Fallback JSON structuré automatique pour les providers sans tool calling

**Living World State**
- `PlayerState` : HP (0-100), crédits, lieu, date narrative, blessures actives, inventaire
- `NpcRelation` : affinité -100..100, statut (allié/neutre/hostile/mort), faction, historique
- `FactionStandings` : réputation -100..100 par faction (Empire, Alliance, Jedi, Sith, Hutt…)
- `Chronologie` : journal des événements horodatés
- HUD flottant en temps réel (collapsible) pendant le jeu

**Conséquences mécaniques**
- HP < 20 → choix combat/force marqués ⚠ + difficulté augmentée
- Crédits ≤ 0 → choix impliquant un paiement désactivés
- Blessures graves → malus sur furtivité et combat

**Rythme narratif intelligent**
- Suivi des `section_type` des 5 derniers chapitres
- Directive automatique si 2+ scènes intenses consécutives : "ce tour DOIT être repos/dialogue/interlude"
- 8 types de scènes : `action`, `dialogue`, `exploration`, `tension`, `revelation`, `repos`, `interlude`, `confrontation`

**Dashboard & gestion**
- Tableau de bord avec grille/liste, recherche, filtres (ère, faction, rôle, tags)
- Dossiers avec couleurs
- Corbeille avec restauration et vidage définitif
- Archivage d'histoires
- Import/export JSON

**Setup wizard**
- 6 étapes : Ère → Faction & Rôle → Trame → Style IA → Protagoniste → Lancement
- 5 ères galactiques, 9 factions, 20 rôles, 7 trames narratives
- Styles d'écriture, tons, POV, longueur, intensité du contenu

### OpenRouter — Provider recommandé

OpenRouter est le provider **par défaut et recommandé** pour plusieurs raisons :
- Accès à 400+ modèles depuis une seule clé API
- Tool calling natif (requis pour le mode agentique)
- Modèles gratuits très performants disponibles
- Modèle par défaut actuel : `google/gemma-4-26b-a4b-it`

Modèles recommandés (du plus économique au plus puissant) :
| Modèle | Type | Notes |
|--------|------|-------|
| `google/gemma-4-26b-a4b-it` | Standard | Défaut actuel |
| `google/gemma-3-27b-it:free` | Gratuit | Excellente option budget |
| `meta-llama/llama-3.3-70b-instruct:free` | Gratuit | Excellent raisonnement |
| `mistralai/mistral-small-3.2-24b-instruct:free` | Gratuit | Rapide |
| `google/gemini-2.0-flash-001` | Payant | Très rapide, qualité pro |
| `anthropic/claude-3-haiku` | Payant | Excellent narrateur |
| `anthropic/claude-sonnet-4.5` | Payant | Premium |

### Installation & développement

```bash
git clone <repo>
cd star-wars-story
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173)

**Prérequis :** Node.js 18+, une clé API OpenRouter (gratuite sur [openrouter.ai](https://openrouter.ai))

### Qualité & vérification

Le projet est verrouillé avec une suite qualité complète :

- `npm run lint`
- `npm run check`
- `npm run test`
- `npm run build`

Un workflow CI GitHub exécute la même chaîne sur push/pull request.

### Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | SvelteKit 2.5.0 + Svelte 4.2.20 |
| Base de données | Dexie.js v4 (IndexedDB) |
| IA | OpenRouter (tool calling) + fallback JSON |
| Déploiement | Cloudflare Pages |
| PWA | Service Worker custom (`static/sw.js`) + Web Manifest |
| Style | CSS custom (dark theme, design Star Wars) |

### Architecture

```
src/
├── lib/
│   ├── ai/
│   │   └── storyEngine.ts     # Moteur IA : tool calling, prompts GM, world state
│   ├── components/
│   │   ├── GameHUD.svelte     # HUD monde vivant (HP, crédits, factions…)
│   │   ├── Header.svelte      # Header avec dropdown langue custom
│   │   ├── Sidebar.svelte     # Navigation principale
│   │   └── StoryCard.svelte   # Carte histoire avec menu actions
│   ├── db/
│   │   └── index.ts           # Schéma Dexie, CRUD, import/export
│   ├── stores/
│   │   ├── editor.ts          # État de l'éditeur (setup, autosave)
│   │   ├── stories.ts         # Stories store + filtres dérivés
│   │   └── ui.ts              # UI store (sidebar, search, viewMode)
│   └── config/
│       └── languages.ts       # Langues UI supportées
└── routes/
    ├── +layout.svelte          # Layout global
    ├── +page.svelte            # Dashboard
    ├── editor/[id]/+page.svelte # Éditeur + mode jeu
    ├── settings/+page.svelte   # Paramètres providers/modèles
    ├── folders/                # Gestion dossiers
    └── trash/+page.svelte      # Corbeille
```

### Données & vie privée

- **100% local** — toutes les données sont dans IndexedDB du navigateur
- Les clés API ne quittent jamais le navigateur
- Aucun compte, aucun serveur, aucun tracking

---

## English

### Overview

Star Wars Story Manager is a local-first PWA for interactive Star Wars storytelling powered by an agentic AI Game Master. The AI manages a living world — player state, NPCs with memory, factions, chronology, injuries, resources — using native tool calling on OpenRouter.

### Quick Start

1. Open the app and go to **Settings**
2. Select **OpenRouter** as provider and paste your API key
3. The default model is currently `google/gemma-4-26b-a4b-it` (you can switch to free models in Settings)
4. Go back to the dashboard and create a new story
5. Complete the setup wizard and launch your adventure

### Key Features

- **Agentic AI GM** with native tool calling (OpenRouter)
- **Living world** tracked in real time: HP, credits, NPCs, factions, injuries, inventory
- **Smart narrative pacing** — automatically avoids non-stop action
- **Background world simulation** — galactic events happen off-screen
- **Fully offline** after first load (PWA)
- **Offline fallback page** (`/offline.html`) + cache shell/runtime séparés
- **Safe SW update lifecycle** (skip waiting + reload contrôlé)
- **Local-first** — no account, no server, your data stays in your browser

### Release Notes

See [CHANGELOG.md](./CHANGELOG.md) for full history.

---

*May the Force be with your prompts.*
