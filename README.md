# Star Wars Story — v3.0 « Lite »

> Écris ta légende — une aventure interactive Star Wars où chaque choix façonne un monde vivant, guidée par une IA Maître du Jeu.

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00)](https://kit.svelte.dev)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00)](https://svelte.dev)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-fetch%20direct-7C3AED)](https://openrouter.ai)

> **v3.0 « Lite »** est une **réécriture complète depuis zéro** de la 2.x, devenue trop lourde à maintenir. Base propre, modulaire et testée — voir le [CHANGELOG](./CHANGELOG.md).

---

## Français

### Présentation

PWA **local-first** : tu crées un protagoniste (ère, faction, rôle, trame) et l'IA déroule une aventure interactive Star Wars. Elle ne se contente pas de narrer — elle tient un **monde vivant** : PV, crédits, lieu, date, blessures, inventaire, PNJ avec relations, réputation des factions, chronologie. Tout est sauvegardé localement et reprend où tu t'étais arrêté.

### Fonctionnalités

- **Maître du Jeu IA** avec deux moteurs au choix dans les réglages :
  - **Direct** — un seul appel, rapide.
  - **Agentique** — pipeline **Directeur → Écrivain → Relecteur → Cerveau** (4 appels). Les sous-agents **partagent l'état du monde** : prose cohérente (pas de PNJ ressuscité ni de lieu erroné), deltas mécaniques sains, et un Relecteur qui peaufine la scène avant affichage.
- **Jet de dé caché** : chaque choix (attribut + difficulté) déclenche un jet invisible qui oriente la narration — pas de fiche de perso à l'écran.
- **Monde vivant** : relations PNJ et réputation des factions affichées en **paliers lisibles** (Loyal, Allié, Neutre, Hostile…) plutôt qu'en nombres bruts.
- **Création en 4 étapes** : ère → personnage → trame → style.
- **Bibliothèque** d'histoires (grille « affiches »), suppression **annulable**.
- **8 types de scènes** + rythme imposé (après 2 scènes intenses, une accalmie).
- Multilingue (la langue choisie pilote les récits), thème clair/sombre.

### Provider

OpenRouter, en **`fetch` direct** (pas de SDK). Une seule clé → tout le catalogue. Modèle par défaut : `qwen/qwen3.5-9b` (modifiable dans les réglages).

### Installation & développement

```bash
npm install
npm run dev      # http://localhost:5173
```

Puis **Réglages → clé API OpenRouter**, et lance une **Nouvelle histoire**.

**Prérequis :** Node.js 18+, une clé [openrouter.ai](https://openrouter.ai).

### Qualité

```bash
npm run check    # svelte-check : 0 erreur / 0 warning
npm run test     # vitest : 39 tests
npm run build
```

### Stack

| Composant | Technologie |
|-----------|-------------|
| Framework | SvelteKit 2 · Svelte 5 |
| Persistance | Dexie.js v4 (IndexedDB), local-first |
| IA | OpenRouter (fetch direct), modes structured-json & agentique |
| Déploiement | Cloudflare Pages |
| Style | CSS « museum-cinema » (Cinzel & Bitter) |

### Architecture

```
src/
├── lib/
│   ├── engine/        # moteur pur (zéro dépendance UI, testé)
│   │   ├── types · text · worldState · parsing · dice
│   │   ├── provider   # transport OpenRouter (fetch direct)
│   │   ├── generate · agentic   # orchestration d'un tour
│   │   └── prompts/   # system · turn · style · language
│   ├── content/       # catalogue SW, config provider, langues
│   ├── persistence/   # Dexie : stories · sessions · preferences
│   ├── stores/        # ui · preferences · play (runtime)
│   ├── ui/            # SceneBackdrop · GameHud · StoryCard · TopNav · Toast
│   └── version.ts
└── routes/
    ├── +layout.svelte
    ├── +page.svelte           # bibliothèque
    ├── new/+page.svelte       # assistant de création
    ├── play/[id]/+page.svelte # écran de jeu
    └── settings/+page.svelte  # réglages
```

**Discipline :** aucun fichier > ~300 lignes, zéro logique métier dans les composants.

### Données & vie privée

100 % local (IndexedDB). La clé API ne quitte jamais le navigateur. Aucun compte, aucun serveur, aucun tracking.

---

## English

Local-first PWA for interactive Star Wars storytelling powered by an AI Game Master that maintains a living world (HP, credits, NPCs, factions, injuries, chronology).

**Quick start:** `npm install && npm run dev` → open **Settings**, paste your **OpenRouter** API key → create a **new story**.

Two engines: **Direct** (one call) and **Agentic** (Director → Writer → Reviewer → Brain, sharing world state). Hidden dice roll behind each choice. Default model `qwen/qwen3.5-9b`.

See [CHANGELOG.md](./CHANGELOG.md) for the full history.

---

*May the Force be with your prompts.*
