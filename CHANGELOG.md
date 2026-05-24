# Changelog

## v2.7.5 — 2026-05-24

### ⚔️ Hardening des Choix Narratifs & Pertinence Extrême des Options

- **Élimination des Choix Génériques (prompts.ts)** :
  * Refonte en profondeur des contrats de choix dans le prompt système monolithique (`buildSystemPrompt`), le prompt de reprise narrative (`buildContinuePrompt`) et le prompt de l'agent cérébral du pipeline (`buildPipelineBrainUserPrompt`).
  * Enforcement d'une interdiction absolue sur les choix d'options génériques, répétitifs et abstraits (ex: "Observer les alentours", "Utiliser la Force pour ressentir le danger", "Négocier avec le marchand", "Préparer un plan").
  * Obligation stricte de lier chaque choix de manière organique et logique à des actions physiques, verbales ou tactiques extrêmement spécifiques, immédiates et uniques, ancrées dans la scène précise qui vient de se dérouler.
- **Stabilité Post-Intégration** :
  * Type-safety absolue certifiée par `svelte-check` avec **0 erreur et 0 avertissement**.
  * Intégration validée sur la suite complète de **160 tests unitaires 100% au vert**.

## v2.7.4 — 2026-05-24

### 💾 Correction de Persistance des Paramètres & Libération Narratives des Modèles

- **Sauvegarde du Mode de Génération (persistence/index.ts)** :
  * Résolution du bug de nettoyage des préférences (`normalizePreferencesRecord`) qui omettait systématiquement les propriétés `textRuntimeMode` (choix du pipeline 4 agents vs 1 agent structuré) et `textReasoningEffort` (effort de raisonnement). Ces choix de l'utilisateur sont désormais correctement validés, castés strictement en TypeScript pour Svelte-check, et persistés de façon permanente dans la base de données locale Dexie (IndexedDB).
- **Zéro Filtrage Narratif / Libération des IA** :
  * Retrait et vérification de l'absence totale de tout système de censure, filtrage ou bridage narratif intermédiaire dans l'application. La prémisse, les actions joueur et la prose générée par l'IA circulent de façon transparente pour garantir une liberté narrative absolue en fonction des limites et des filtres propres au modèle d'IA sélectionné (ex: support natif du mode "Brut" et "Adulte" en jeu).
- **Stabilité Post-Intégration** :
  * Type-safety absolue confirmée par `svelte-check` avec **0 erreur et 0 avertissement**.
  * Intégration testée avec succès sur l'ensemble de la suite de **160 tests unitaires 100% au vert**.

## v2.7.3 — 2026-05-24

### 🤖 Résolution de l'Orchestration à 4 Agents & Résilience Réseau

- **Mise à Jour du Pipeline à 4 Agents (agentic.ts)** :
  * Intégration dynamique et robuste du prompt système pour l'agent `writer` (`buildPipelineWriterSystemPrompt`) au lieu d'utiliser un prompt statique isolé. Les sous-agents héritent désormais de la continuité chronologique complète (ère de jeu, protagoniste, style littéraire, ton, POV, prémisse et la règle 13 du prologue au premier tour).
  * Création d'une fonction de parsing intelligente de secours (`parseSetupFromSystemPrompt`) capable de reconstituer fidèlement la structure `setup` depuis les messages système existants de l'historique de jeu pour garantir la compatibilité des anciens tests unitaires.
  * Liaison de la configuration de partie `setup` dans le contrôleur de page (`+page.svelte`) pour transmettre le snapshot au pipeline.
- **Robustesse Réseau & Gestion des Erreurs (providers.ts)** :
  * Élimination des erreurs de syntaxe et de structure de blocs suite à l'introduction de la boucle de tentatives avec backoff exponentiel.
  * Gestion propre et granulaire des erreurs réseau et des délais d'attente (`isAbortError`) par essai unitaire avec enregistrement d'événements de diagnostics distincts.
- **Stabilité Post-Intégration** :
  * Garantie de type-safety totale via `svelte-check` avec **0 erreur et 0 avertissement**.
  * Validation rigoureuse de la suite de tests unitaires avec **160 tests unitaires 100% au vert**.

## v2.7.2 — 2026-05-24

### ⏳ Conformité de la Date Narrative & Prologue Immersif Tour 1

- **Conformité des Dates Narratives (worldStateReducer.ts)** : 
  * Correction du bug de corruption de chaîne de date narrative. Désormais, si l'IA renvoie une date absolue avec marqueurs d'ère (`AVBY`, `APBY`, `BBY`, `ABY`), celle-ci est retournée directement et proprement au lieu d'être concaténée de façon erronée comme décalage (ex: élimine définitivement les corruptions de format du type `22 AVBY, Jour 1 +22 AVBY, Jour 2`).
  * Assouplissement du matching de jour absolu (`absoluteDayMatch` regex) en cherchant le motif de mot-clé de jour n'importe où dans la chaîne (`\bjour\s*(\d+)\b`) au lieu de restreindre strictement au début et fin de chaîne (`^`/`$`), évitant ainsi les échecs de parsing de jour lorsque l'IA insère des mots additionnels.
- **Règles Strictes de Prologue Narratif (prompts.ts & page.svelte)** :
  * Liaison dynamique du numéro de tour courant au prompt système de tous les agents (`scribe -> director -> writer -> brain`).
  * Injection automatique d'une **nouvelle directive MJ rigide (Règle 13)** lorsque le jeu commence (Tour 1) : force l'IA à ouvrir l'histoire par une riche et immersive introduction littéraire du protagoniste (apparence, origines, background immédiat lié à son rôle, pourquoi il se trouve là et la tension immédiate), posant proprement l'ambiance et le décor choisi avant d'enclencher des péripéties abruptes.
- **Validation & Robustesse (Tests Unitaires)** : 
  * Ajout d'une suite complète de tests unitaires dédiée à la conformité et au parsing des dates narratives (`worldStateReducer.test.ts`), augmentant la suite de tests à **160 tests unitaires 100% au vert**.

## v2.7.1 — 2026-05-24

### 🎭 Libération du Lieu d'Ouverture & Introduction Narrative (Choix IA)

- **Lieu de Départ Dynamique (IA)** : Remplacement de l'initialisation rigide et pré-déterminée par faction (`worldStateReducer.ts`) par un placeholder `"À déterminer par l'introduction"`. L'IA choisit désormais en toute liberté le lieu de départ le plus pertinent avec le rôle et la prémisse (ex: évite de faire démarrer un *Padawan banni* dans une enclave Jedi sacrée sous l'Empire, le plaçant plutôt dans une cantina crasseuse ou un vaisseau cargo en fuite).
- **Introduction Cinématique du Personnage** : Refonte de l'exigence du premier tour dans le prompt initial (`buildStartPrompt`). L'IA n'ouvre plus de manière abrupte sans contexte (*in medias res*), mais compose une véritable scène d'ouverture introduisant l'identité du protagoniste, son rôle, sa situation présente et la menace immédiate qui pèse sur lui.

### 🎨 Portrait IA de Protagoniste & Décors Spatiaux Premium (v2.7.1)

- **Décors Cosmiques Ultra-Premium (Unsplash)** : Intégration de 10 sublimes photographies d'art spatial en haute résolution (provenant d'artistes Unsplash comme Jake Weirick) à la place des anciens fonds légers et répétitifs.
- **Ambiances Dynamiques par Mood (SceneBackdrop)** : Association automatique des décors à la tension et au type de scène en cours :
  * `action` -> Supernova et explosions cosmiques d'étoiles
  * `confrontation` -> Nébuleuse rouge sombre écarlate très contrastée (Jake Weirick)
  * `exploration` -> Gaz galactique vert émeraude et mystérieux
  * `dialogue` -> Fond étoilé lointain et discret pour optimiser la lecture
  * `repos` -> Nébuleuse d'un bleu profond apaisant
  * `tension` -> Tempête de poussière spatiale aux lueurs ambrées/dorées
  * `revelation` -> Anomalie gravitationnelle et distorsions violettes/noires
- **Génération Intégrée de Portraits** : Ajout d'une section dédiée à la génération de portrait de protagoniste par IA dans l'assistant de configuration (`SetupWizard.svelte`), créant des illustrations uniques synchronisées avec l'allégeance, le rôle et la chronologie de départ.
- **Saisie de Détails Physiques (Overrides)** : Implémentation d'un champ de texte facultatif permettant de spécifier des détails physiques ou styles graphiques précis (ex: "Twi'lek bleu, bure de Jedi marron..."), s'insérant dynamiquement au prompt de l'image.
- **Intégration du Portrait en Jeu (GameHUD)** : Remplacement de l'affichage textuel classique d'identité par une véritable **carte d'identité graphique** avec affichage circulaire premium de l'avatar/portrait IA (38px, contour néon doré Star Wars) dans le HUD latéral.
- **Indicateur d'Action Joueur Immersif** : Ajout d'un petit indicateur d'avatar circulaire (34px) adjacent à la zone de saisie d'action personnalisée (`+page.svelte`), renforçant l'identification visuelle pendant les choix.
- **Support Robuste des Fournisseurs d'Images** : Implémentation complète de `src/lib/ai/imageEngine.ts` prenant en charge OpenRouter, fal.ai, DALL-E (OpenAI) et Stability AI, avec conversion Base64 automatique pour la persistance locale IndexedDB (Dexie.js).
- **Stabilisation du Sélecteur OpenRouter Images** : Correction de la synchronisation dynamique buggy en éliminant les modèles de texte de la liste et en stabilisant le mapping de clé API partagée/décroissante.

### 🌐 Moteur IA Multilingue & Titrages Évocateurs (Evocative Titles)

- **Directives de Langue Dynamiques** : Introduction de la fonction `getPromptLanguageInstructions` traduisant le choix de l'utilisateur (`fr`, `en`, `es`, `de`, `it`, `pt`, `ja`, `zh`) en directives strictes à destination de l'IA.
- **Hardening de la Boucle Agentique** : Injection des contraintes de langue dans **tous les sous-agents** du pipeline (`scribe -> director -> writer -> brain`) et dans le duo de simulation galactique (`observer -> adjudicator`), forçant les modèles à répondre intégralement dans la langue choisie (ex: Français) et éliminant définitivement les dérives en anglais.
- **Résolution Native de Langue** : Liaison automatique de la langue de l'histoire à la préférence d'interface `uiLanguage` de l'utilisateur ou à la langue de son navigateur en cas de sélection automatique (`auto`).
- **Titrages Évocateurs & Hardening du Brain** : Amélioration du prompt de l'agent `brain` (`buildPipelineBrainUserPrompt`) pour exiger systématiquement des titres de scènes hautement cinématiques et créatifs en Français, évitant les retours vides ou génériques ("Tour N").
- **Générateur Thématique de Secours** : Refonte complète des algorithmes de titrage programmatiques (`deriveFallbackChapterTitleFromScene` et `deriveChapterTitleFromNarrative`) avec un moteur de correspondance de mots-clés Star Wars (ex: sabre -> "Échos dans la Force", enclave -> "Les Mystères de l'Enclave", etc.) et une extraction de phrase beaucoup plus naturelle et concise (limitée à 5 mots pertinents).

## v2.7.0 — 2026-05-24

### ✨ Refonte Visuelle "Musée-Cinéma" (CanariasArt)

- **Esthétique Épurée Ultra-Premium** : Remplacement de l'ancien style "cockpit" surchargé, des lueurs jaunes néon et des ombres portées de science-fiction agressives par une interface minimaliste en verre transparent (`var(--surface-glass)` et `var(--border-subtle)`).
- **Typographie d'Exposition Fine** : Intégration de la police **Cinzel** (majuscules fines et espacées) pour tous les en-têtes, boutons ghosts et breadcrumbs.
- **Confort de Lecture Littéraire** : Alignement de la prose narrative sur la police à empattement **Bitter** avec une colonne de lecture rationalisée à une largeur idéale de **64ch**.
- **HUD Flottant & Graphiques 3px** : Amincissement des barres de progression de statut (points de vie, influence de secteur, standings de factions) à **3px** d'épaisseur maximum pour un rendu minimaliste haut de gamme.
- **Refonte des Composants Majeurs** : Alignement complet de [SetupWizard.svelte](file:///c:/Users/starx/Documents/CODE/star-wars-story/src/lib/components/editor/SetupWizard.svelte), [GameHUD.svelte](file:///c:/Users/starx/Documents/CODE/star-wars-story/src/lib/components/GameHUD.svelte), [PageHeader.svelte](file:///c:/Users/starx/Documents/CODE/star-wars-story/src/lib/components/PageHeader.svelte), de la page de jeu [+page.svelte (editor)](file:///c:/Users/starx/Documents/CODE/star-wars-story/src/routes/editor/%5Bid%5D/+page.svelte) et de la page des paramètres [+page.svelte (settings)](file:///c:/Users/starx/Documents/CODE/star-wars-story/src/routes/settings/+page.svelte).

### 🔧 Améliorations de l'Environnement de Développement

- **Hardening d'ESLint** : Mise à jour de [eslint.config.mjs](file:///c:/Users/starx/Documents/CODE/star-wars-story/eslint.config.mjs) pour ignorer le dossier de travail temporaire `.claude/`, éliminant plus de 8 000 faux-positifs.
- **Indicateurs de Qualité** : Type-check (`svelte-check`) et tests unitaires du moteur (155 tests) confirmés à 100% au vert.
- **Nettoyage des Logs** : Suppression des fichiers de logs temporaires et obsolètes de la racine du workspace (`build.log`, `check.log`, `check_out.txt`, `lint.log`, `test.log`, `.log` de déploiement).

## v2.6.2 — 2026-04-24

### 🏗️ Story engine consolidation — v10/10

- **Refactor complet des utilitaires dupliques** : `cleanText`, `clamp`, `isObjectRecord`, `CANONICAL_PLAYER_ACTION_PATTERNS` et `extractCanonicalPlayerAction` (7 copies) centralises dans un seul module `src/lib/ai/storyEngine/utils/shared.ts`
- **Correction de regex incoherentes** : les versions `cleanText` de `prompts.ts` et `worldStateFallbacks.ts` ne gerent pas `\r\n` correctement — corrigees par l'import du shared
- **34 nouveaux tests chaotiques** (`storyEngine.chaos.test.ts`) couvrant les cas limites des reponses LLM : JSON dans markdown, JSON prefixe `json {`, texte de diagnostic inutile, tableau en retour, valeurs extremes, donnees corrompues, bruit memoire
- **Suite de tests passee de 94 a 128 tests**, 11 fichiers de tests

## v2.6.1 — 2026-04-24

### 🤖 Sélecteur d'effort de raisonnement

- Nouveau champ `textReasoningEffort` dans les préférences utilisateur (persisté en IndexedDB)
- Lors de la synchronisation des modèles OpenRouter, capture des `supported_parameters` par modèle : seuls les modèles déclarant `"reasoning"` affichent le sélecteur — zéro hardcodage
- Sélecteur d'effort exposé dans les Settings (écran IA Texte) avec les 6 niveaux réels OpenRouter : `xhigh · high · medium · low · minimal · none`
- Par défaut : aucun niveau forcé, OpenRouter gère automatiquement selon le modèle
- `StoryProviderConfig` enrichi d'un `reasoningEffortOverride` transmis au payload API ; `buildReasoningPayload` utilise l'override si fourni, `none` désactive explicitement le reasoning

### 🗂️ Catalogue de modèles

- Ajout de `deepseek/deepseek-v4-flash` (MoE 284B/13B actifs, contexte 1M tokens)
- Ajout de `moonshotai/kimi-k2.6` (reasoning fort, 91.1% GPQA Diamond)
- Nettoyage de `MODEL_CAPS_PATTERNS` : suppression des `reasoningEffort` hardcodés par modèle, désormais pilotés par le choix utilisateur
- Type `reasoningEffort` aligné sur les vrais niveaux OpenRouter (`xhigh | high | medium | low | minimal | none`), `adaptive` et `max` retirés

## v2.6.0 — 2026-04-23

### 📋 Story Engine contracts & validation layer

- Contrats TypeScript (`contracts.ts`) avec validations centralisées :
  - `normalizeStoryGenerationMode()` — normalisation des modes structuré/agentique
  - `isPlayableStoryChapter()` — validation des chapitres avec contenu narratif jouable (action/dialogue minimum)
  - `assertSupportedStoryProviderConfig()` — assertion de configuration provider supportée avec fallback
  - `sanitizeStoryMessageHistory()` — nettoyage sécurisé de l'historique des messages (rôles + limites de taille)
  - `validateStoryChapter()` — validation structurelle complète des chapitres générés

### 🧪 Soak tests & e2e smoke tests

- **Soak tests** (`storyEngine.soak.test.ts`) — 200 tours simulés sans régression d'état :
  - Validation de la persistance et restauration des sessions (localStorage)
  - Détection de divergences entre l'état sauvegardé et l'état rejouable
  - Gestion des corruptions de sessions et recovery narratif
  - Résilience du reducer `worldStateReducer` sur longue durée
- **Smoke tests e2e** (`story-engine.smoke.spec.ts`) — vérification du workflow complet en navigateur :
  - Playwright : création de setup, génération de tour, validation du HUD joueur
  - Tests de l'interface GameHUD sous charge (faction standings, blessures, chronologie)
- **Tests unitaires contrats** (`storyEngine.contracts.test.ts`) — couverture des normalizations et assertions

### 🔧 Infrastructure & fixtures de test

- Configuration Playwright pour les tests e2e (`playwright.config.ts`)
- Configuration Vitest dédiée aux soak tests (`vitest.soak.config.ts`)
- Fixtures de test : réponses provider, scénarios de corruption, replay scenarios
- Amélioration de la couverture de `interactiveSession`, `narrativeGuardrails`, `worldStateReducer`, logger
- CI/CD : ajout de étapes de soak tests au workflow GitHub Actions

## v2.5.0 — 2026-04-21

### 🏗️ Fondations runtime du moteur

- Sessions interactives locales consolidées avec `interactiveSession.ts` : sauvegarde, restauration et nettoyage du contexte de campagne
- Ajout des garde-fous narratifs (`narrativeGuardrails.ts`), du journal d'histoire, du catalogue de setup et d'un logger centralisé
- Base du story engine structurée avec module providers/types, premiers fallbacks d'état monde et intégration initiale Vite/SvelteKit
- Modèle texte par défaut réaligné sur `qwen/qwen3.5-9b` pour éviter de dépendre d'un preset déjà obsolète

### 🤖 Pipeline agentique & résilience

- Résilience renforcée du moteur : timeouts de tool-calling, fallback diagnostique et emergency seed pour garder la narration debout quand le provider déraille
- Payloads structurés et extraction d'action narrative ajoutés au pipeline au lieu de laisser le modèle improviser son propre contrat
- Tool-calling natif élargi progressivement à Gemma 4 puis à d'autres modèles compatibles, avec préférences provider et capacités OpenRouter revues
- Infrastructure prompts/providers agentique posée proprement pour séparer orchestration, raisonnement et exécution

### 🎮 Surface de jeu & UX éditeur

- Assemblage du flux moderne de jeu : `SetupWizard.svelte`, `GameHUD.svelte`, moteur de génération d'histoire et interface de partie réellement jouable
- Breadcrumbs dans l'éditeur, états de chargement revus et HUD enrichi avec labels de rôle/faction côté joueur
- `planDialogueDisplay()` intégré à l'éditeur, avec harmonisation du format des dialogues et des labels de factions dans la narration
- Extraction des noms de PNJ et gestion mémoire améliorées pour éviter que le moteur confonde présence narrative et pollution contextuelle

### ✨ Consolidation runtime & qualité

- Refactor structurel du code pour sortir du spaghetti croissant et ramener un peu de lisibilité dans le runtime
- Filtrage du bruit mémoire, dérivation automatique des titres de chapitre et diversification des attributs de choix pour des sorties moins mécaniques
- Introduction d'un réducteur canonique d'état monde et de helpers runtime dédiés aux background events, à leur visibilité et à leurs effets mémoire
- Renforcement de la couverture de tests sur la sanitization narrative, la qualité des transitions, les sessions interactives, le runtime et le reducer d'état monde

### 📋 Single source of truth config

- Centralisation des providers/modèles/defaults/aliases dans `src/lib/config/providers.ts`
- Migration des consommateurs principaux : `settings/+page.svelte`, `storyEngine.ts`, `db/index.ts`, `persistence/index.ts`
- Compatibilité legacy renforcée via alias image `openrouter -> openrouter_img`

### 🔒 Runtime & PWA hardening

- `static/sw.js` renforcé : caches séparés shell/runtime, `navigationPreload`, stratégie HTML network-first, assets stale-while-revalidate
- Ajout d’un fallback hors ligne dédié : `static/offline.html`
- Lifecycle SW géré côté app (`src/routes/+layout.svelte`) : update detection, `SKIP_WAITING`, rechargement contrôlé
- Garde-fous runtime : toasts online/offline et persistance des préférences avec gestion d’erreurs

### 📚 Repo cleanup & docs sync

- Harmonisation de la route canonique de création (`/stories/new`) dans les points d’entrée UI
- Documentation synchronisée (README/SPEC/CHANGELOG) avec l’état réel du projet
- Validation complète post-cleanup : lint, check, test, build

## v2.0.0 — 2026-04-18

### 🎭 Moteur narratif agentique (refonte majeure)

- **Tool calling natif OpenRouter** — l'IA appelle des fonctions réelles au lieu de générer un JSON monolithique : `set_scene`, `update_world`, `update_npc`, `update_faction`, `add_memory`, `offer_choices`, `finalize_turn`
- **Boucle agentique multi-étapes** (jusqu'à 8 steps/tour) — l'IA raisonne puis agit, les outils s'enchaînent dynamiquement
- **Agent de simulation galactique** — second agent de fond qui simule les événements du monde (batailles, élections, crises) pendant que le joueur joue
- **Fallback JSON structuré** automatique pour les providers sans tool calling

### 🌍 Living World State

- **`PlayerState`** — HP (0–100), crédits, lieu, date narrative, blessures actives (`active`/`healing`/`critical`), inventaire avec quantités
- **`NpcRelation`** — affinité −100..100, statut (allié/neutre/hostile/mort/inconnu), faction, note, `last_seen`
- **`FactionStandings`** — réputation −100..100 pour Empire, Alliance, Jedi, Sith, Hutt Cartel, Mandalorien, Neutre
- **`ChronologyEntry`** — journal horodaté des événements avec tag de type (combat, dialogue, découverte…)
- **`StateUpdate` delta-based** — deltas HP/crédits, upsert NPCs par nom, clamp factions, résolution/ajout de blessures, fusion inventaire, appends chronologie

### 🎮 GameHUD — interface monde vivant

- Nouveau composant `GameHUD.svelte` — panneau flottant collapsible en jeu (coin supérieur droit)
- Barre HP colorée (vert → jaune → rouge), crédits, lieu, date narrative
- Liste des blessures actives avec icônes de sévérité
- NPCs trackés avec dot d'affinité coloré + score
- Barres mini factions avec label et valeur
- Design dark theme, bordure dorée, backdrop blur

### ⚡ Conséquences mécaniques sur les choix

- HP < 20 → choix `combat` / `force` marqués ⚠ + `diffBonus` +2
- Blessure grave active → choix `combat` / `stealth` marqués ⚠ + `diffBonus` +1
- Crédits ≤ 0 + mots-clés paiement → choix désactivés (bouton grisé)

### 🎵 Rythme narratif intelligent

- Enum `section_type` (8 types) : `action`, `dialogue`, `exploration`, `tension`, `revelation`, `repos`, `interlude`, `confrontation`
- Suivi des 5 derniers `section_type` dans `chapterHistory`
- 2+ scènes intenses consécutives → directive GM : "ce tour DOIT être repos/dialogue/interlude"
- 3+ scènes intenses consécutives → directive renforcée avec interdiction explicite d'action/combat

### 🔌 OpenRouter — provider n°1

- OpenRouter promu **provider par défaut et recommandé**
- Modèle par défaut : `google/gemma-3-27b-it:free` (gratuit, aucun crédit requis)
- Liste modèles étendue : free tier d'abord (Gemma, Llama, Mistral, Qwen), puis payants
- Badges mis à jour : `⚡ Agentique`, `Tool calling natif`, `400+ modèles`
- Détection `supportsAgenticToolCalling()` pour activer/désactiver la boucle agentique

### 💎 Model chip dans la topbar de jeu

- Chip discret affichant le modèle actif pendant le jeu (nom court sans préfixe provider)
- Dot vert pulsant si mode agentique actif (`⚡`)
- Tooltip avec statut complet du provider

### 🖼️ Favicons & PWA icons

- Nouvelle source `fav.jpg` → génération de toutes les tailles PWA via Sharp
- `favicon.ico` multi-size (16 / 32 / 48 px) assemblé manuellement
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`
- `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (PWA installable)
- `apple-touch-icon.png` 180×180 (iOS)
- `manifest.json` mis à jour avec l'array d'icônes complet + version 2.0.0

### 🐛 Corrections de bugs

- **Réactivité du nombre de modèles** dans Settings — `getTextProviderModels()` n'était pas réactif dans Svelte ; remplacé par des déclarations `$:` dérivées
- **Guillemets typographiques** (U+2018/U+2019) introduits par les éditions IA cassaient le parsing TypeScript/Svelte — corrigés, chaînes françaises converties en template literals
- **Corbeille** — `loadTrash()` renvoyait toutes les histoires ; filtre `isDeleted === true` ajouté
- **Modèle par défaut DB** — `textModel` mis à jour vers `google/gemma-3-27b-it:free` dans le schéma Dexie

### 📖 Documentation

- `README.md` entièrement réécrit pour v2.0 — sections FR + EN, tableau modèles OpenRouter, arbre architecture, stack technique
- `CHANGELOG.md` mis à jour

---

## v1.2.0 — 2026-04-17

### 🔧 Bugfixes & cleanup (SvelteKit app)

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

### 🔄 Technical reset (legacy retirement)
- Moved the legacy vanilla JS runtime from repository root into `archives/legacy-js/`.
- Added a root `index.html` transition stub.
- Updated documentation to reflect a Svelte-first codebase.

## v1.1.1 — 2026-04-17

### 🩹 Hotfix
- Fixed `stringifyNarrativeValue` not available in the camp summary path (legacy runtime).

## v1.1.0 — 2026-04-17

### ☁️ Cloudflare release cleanup
- Archived the classic vanilla JS prototype.
- Clarified that the playable version lives on the Cloudflare-hosted site.
- Removed the GitHub Pages deployment workflow.

## v1.0.0 — 2026-04-17

🎉 First official release of **Star Wars Story** (legacy vanilla JS runtime).

- Multi-step story onboarding (identity, tone intensity, setup).
- Local-first dashboard to create, open, and manage stories.
- Full session resume support (turn, chapter, messages, choices).
- Multi-provider text/image handling with fallback behavior.
- Stronger JSON parsing and schema coercion for API responses.
*