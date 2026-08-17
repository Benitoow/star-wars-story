# Star Wars Story — v3.2 « Lite »

> Écris ta légende — une aventure interactive Star Wars où chaque choix façonne un monde vivant, guidée par une IA Maître du Jeu.

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00)](https://kit.svelte.dev)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00)](https://svelte.dev)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-fetch%20direct-7C3AED)](https://openrouter.ai)

> **v3.2 « Mémoire »** ajoute une mémoire inspirée de Mnemosyne : récupération par pertinence à chaque scène, consolidation périodique des vieux faits, et embeddings sémantiques optionnels (Réglages → Avancés). Voir le [CHANGELOG](./CHANGELOG.md).

---

## Français

### Présentation

PWA **local-first** : tu crées un protagoniste (ère, faction, rôle, trame) et l'IA déroule une aventure interactive Star Wars. Elle ne se contente pas de narrer — elle tient un **monde vivant** : PV, crédits, lieu, date, blessures, inventaire, PNJ avec relations, réputation des factions, chronologie. Tout est sauvegardé localement et reprend où tu t'étais arrêté.

### Fonctionnalités

- **Maître du Jeu IA** avec deux moteurs au choix dans les réglages :
  - **Direct** — un seul appel, rapide.
  - **Agentique** — pipeline **Directeur → Écrivain → Relecteur → Cerveau** (4 appels). Les sous-agents **partagent l'état du monde** : prose cohérente (pas de PNJ ressuscité ni de lieu erroné), deltas mécaniques sains, et un Relecteur qui peaufine la scène avant affichage.
- **Jet de dé caché** : chaque choix (attribut + difficulté) déclenche un jet invisible qui oriente la narration. Depuis la 3.1, les **aptitudes** du personnage (profil 1–5 dérivé du rôle et de la faction) modifient réellement les jets, la **difficulté est recalibrée** (DC 7–15) et chaque choix affiche son **risque** (faible / modéré / élevé) et son **arbitrage** (tradeoff/stakes). XP, niveaux et gains d'aptitude après les actions significatives.
- **Fil rouge de campagne** : titre, objectif, progression et statut persistants ; **événements hors champ** visibles dans le HUD et le journal ; ressources ennemies **finies** (pas de vague identique sans cause) ; **fins réelles** — victoire, défaite, retraite ou mort après une dernière chance de survie.
- **Inventaire utile** : un choix peut exiger un objet (`requires_items`) et le consommer (`consumes_items`) — les objets du sac ouvrent de vraies options.
- **Conversations validées** : à la fin d'un échange, le résumé (faits retenus, progression, conséquences) est affiché et doit être **validé ou annulé** avant d'être gravé dans le monde et la mémoire.
- **Mémoire par pertinence** (inspirée de Mnemosyne) : seuls les faits liés à la scène courante sont injectés (scoring mots-clés + récence), les vieilles notes sont **consolidées** en synthèses tous les 10 tours, et des **embeddings sémantiques** optionnels (Réglages → Avancés) améliorent le rappel avec repli automatique.
- **Codex d'époque** : références factuelles par ère (factions, lieux, figures, technologies, événements) injectées à la demande en contexte optionnel, plus un **dossier de campagne** généré une fois au tour 1 — le modèle construit l'histoire avec de vrais repères, sans être piloté.
- **Monde vivant** : relations PNJ et réputation des factions affichées en **paliers lisibles** (Loyal, Allié, Neutre, Hostile…) plutôt qu'en nombres bruts.
- **Création en 4 étapes** : ère → personnage → trame → style.
- **Bibliothèque** d'histoires (grille « affiches »), suppression **annulable**.
- **8 types de scènes** + rythme imposé (après 2 scènes intenses, une accalmie).
- Multilingue (la langue choisie pilote les récits), thème clair/sombre.

> **Langue (décision assumée) :** l'app est **FR-first** — interface et prompts internes rédigés en français. Seule la **langue des récits** (sortie du modèle) suit le réglage de langue, via une instruction dédiée. Une traduction de l'UI serait un chantier séparé, non planifié.

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
npm run test     # vitest (moteur + store)
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
