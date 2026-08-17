# Changelog

## v3.2.0 — « Mémoire » — 2026-08-17

**Mémoire inspirée de Mnemosyne** : fini le bloc plat de faits injecté tel quel — la mémoire est désormais **récupérée par pertinence** à chaque scène, **consolidée** périodiquement, et peut utiliser des **embeddings sémantiques** (optionnels) pour rappeler les bons faits au bon moment.

### 🔍 Récupération par pertinence (toujours active)
- **Scoring lexical** (`retrieval.ts`) : chaque fait est noté selon son chevauchement de mots-clés avec la scène courante (pondération IDF), la **récence** (demi-vie de 8 tours) et sa catégorie.
- **Sélection bornée** : seuls les ~24 faits les plus pertinents sont injectés dans les prompts, plus les faits des 3 derniers tours pour la continuité de scène — les longues campagnes ne saturent plus le contexte.
- La requête est construite depuis l'action du joueur, le lieu, le titre et la prose du dernier chapitre ; les conversations (Mode Direct) utilisent la scène, le dernier message et le PNJ.
- Appliqué aux trois canaux : Direct (`buildSystemPrompt`), Agentique (Écrivain + Cerveau) et Mode Direct (répliques + débrief).

### 🧠 Embeddings sémantiques (option dans Réglages → Avancés)
- **« Mémoire sémantique »** : embeddings OpenRouter (`qwen/qwen3-embedding-8b`) pour la requête et les faits ; similarité cosinus fusionnée avec le scoring lexical.
- **Cache IndexedDB** (table `embeddings`, DB v2) : chaque fait n'est encodé qu'une fois, les vecteurs persistent entre sessions ; la requête (unique à chaque tour) n'est jamais persistée — la table ne grossit pas indéfiniment.
- **Repli automatique** : panne réseau, erreur de cache IndexedDB, provider MiMo (sans endpoint embeddings) ou réponse vide → retour silencieux au scoring lexical. La mémoire sémantique ne bloque jamais un tour.

### 🧹 Consolidation épisodique (tous les 10 tours)
- Les **notes anciennes** (≥ 8 tours, à partir de 4 faits, max 8 par passe) sont condensées par le modèle en une **synthèse datée** unique — les relations ne sont jamais consolidées.
- **Sans risque** : en cas d'échec de l'appel, la mémoire reste strictement inchangée (aucune perte) ; une garde de concurrence abandonne la passe si un tour est soumis pendant la synthèse (pas d'écrasement des faits récents).

### ⚡ Préfixe stable (input cache OpenRouter)
- Le system prompt (Direct et Écrivain agentique) ne porte plus que des **instructions stables** ; le monde, la mémoire, l'archive et le canon voyagent dans le **message utilisateur final**.
- Le préfixe [system + historique] reste donc identique entre les tours → le **cache d'input du provider** s'applique à tout le début du prompt (tokens d'historique servis au tarif réduit, souvent −50 % à −90 % selon le provider).
- `buildSystemPrompt` (ancien format tout-en-un) reste disponible pour la compatibilité.

### 🗄️ Technique
- Nouveaux modules purs et testés : `retrieval.ts`, `embedding.ts`, `consolidate.ts`, `memoryRetrieval.ts` (assemblage) + cache `persistence/embeddings.ts`.
- Préférence `memoryEmbeddings` (défaut : désactivé) — les anciennes sauvegardes de réglages restent valides.
- **136 tests Vitest verts** (23 nouveaux) · `svelte-check` 0 erreur / 0 warning · ESLint 0 erreur · build Cloudflare OK.

## v3.1.0 — « Gameplay » — 2026-08-17

**Passe d'amélioration du jeu** : les attributs comptent vraiment, les jets sont lisibles et mieux calibrés, la campagne a un fil rouge, l'inventaire sert à jouer, les choix sont des dilemmes, les conversations sont validées avant d'être gravées et les fins sont réelles.

### 🎲 Compétences, jets et risques
- **Aptitudes réelles** : profil 1–5 dérivé du rôle et de la faction (`catalog.ts` → `deriveSkillProfile`), persisté dans l'état joueur. Les choix utilisent l'aptitude correspondante dans le jet (`dice.ts`).
- **Recalibrage des jets** : DC = 5 + 2 × difficulté (7–15 au lieu de 9–17) ; bonus d'aptitude (0–4) ajouté au dé ; les actions simples réussissent fiablement, les exploits restent risqués.
- **Risque lisible** : chaque choix affiche son niveau (faible/modéré/élevé) calculé depuis l'aptitude du joueur, l'aptitude mobilisée et son score ; le jet caché lui-même reste invisible.
- **Progression** : XP (100 = niveau), niveaux et gains d'aptitude (`skill_gains`) gérés par `applyStateUpdate` ; le HUD affiche le niveau et la barre d'XP ; le journal liste les aptitudes.

### 🎯 Campagne, fil rouge et monde vivant
- **Campagne persistante** : titre, objectif, progression et statut (`CampaignState`) dans l'état du monde, initialisée au tour 1, mise à jour chaque tour via `campaign_update` (prompts Direct et Agentique) ; visible dans le HUD et dans le journal (onglet « Monde »).
- **Événements hors champ** : `world_events_new` (0–2 par tour justifié), horodatés par tour et date, dédupliqués, visibles dans le HUD et le journal.
- **Ressources ennemies finies** : règles de prompts renforcées (pas de vague identique, pas de renforts sans cause, victoire qui laisse `environment_status` et mémoire durables) — appliquées aux deux moteurs.
- **Noms propres préservés** : `detectOverusedTerms` ne signale plus le lieu courant et les PNJ connus comme tics stylistiques ; budget de contexte par défaut ramené à 32 k tokens (jouable sur les fenêtres courantes).

### ⚖️ Choix et inventaire
- **Choix opposés** : chaque choix peut porter `tradeoff` (ce qu'il sacrifie) et `stakes` (ce qu'il risque) ; les prompts imposent des dilemmes mutuellement exclusifs à coûts différents (temps, sécurité, allié, argent, information).
- **Déduplication enrichie** : en cas de doublon, la variante la plus riche en informations est conservée.
- **Inventaire mécanique** : `requires_items` (option désactivée si l'objet manque, quantités vérifiées) et `consumes_items` (retiré de façon déterministe après le tour, sans double consommation si le modèle l'a déjà déclaré via `inventory_lost`).
- **Numéro de chapitre verrouillé** : `chapter_number` est toujours celui du moteur, jamais celui du modèle.

### ☠️ Enjeux réels et fins
- **Dernière chance** : une scène à 0 PV ouvre une scène de survie critique (`criticalTurns`) ; une fin `death` ne peut ni sauter cette chance ni être écrasée ensuite.
- **Fins explicites** : `victory`, `defeat`, `retirement` et `death` — un objectif accompli clôt la campagne, un statut `failed` produit une fin `defeat` visible, l'interface bloque choix et conversations après la fin.
- **Échec de génération récupérable** : l'action en attente est conservée, « Modifier l'action » réactive le formulaire et « Réessayer » relance exactement la même action (avec son jet).

### 💬 Conversations validées
- Le débrief d'une conversation (Mode Direct) produit un **résumé à valider** : récap jouable, faits retenus, progression du fil rouge et conséquences. Rien n'est appliqué (monde, mémoire, historique) avant **Valider** ; « Annuler les conséquences » referme l'échange sans effet.
- Le contrat de débrief intègre XP, `campaign_update`, `world_events_new`, `ending` et la règle anti-canonisation des prédictions ; les choix du débrief portent `tradeoff`/`stakes`.

### 🗄️ Compatibilité
- Les anciennes sauvegardes (sans aptitudes, XP, campagne ni événements) sont **réparées au chargement** (`cloneWorldState` à l'ouverture de session).
- Dates narratives sans accumulation de fragments redondants ; mémoire des notes objets (`{"text":…}`) lue correctement (déjà en place, consolidée par les tests).

### 🧪 Qualité
- 113 tests Vitest verts (nouveaux tests : jets/aptitudes, risque, inventaire, campagne, fins, migration de sauvegarde, reprise après erreur, débrief validé, noms propres).
- `svelte-check` : 0 erreur / 0 warning · ESLint : 0 erreur · build Cloudflare OK.

## v3.0.0 — « Lite » — 2026-05-26

**Réécriture complète, depuis zéro.** La 2.x était devenue trop lourde et impossible à maintenir — le désordre était concentré dans 3 fichiers de 1 600 à 2 400 lignes (settings, écran de jeu, assistant). La 3.0 « Lite » repart sur une base **propre, modulaire et testée**, sans rien perdre du cœur du jeu. ~21 500 lignes supprimées, reconstruites proprement.

### 🎮 Le jeu (préservé et affûté)
- **Maître du Jeu IA** : aventure interactive Star Wars à monde vivant.
- **Deux moteurs narratifs**, au choix dans les réglages :
  * **Direct** — un seul appel (rapide).
  * **Agentique** — pipeline **Directeur → Écrivain → Relecteur → Cerveau** (4 appels). Nouveauté majeure : les sous-agents **partagent l'état du monde** (l'Écrivain reçoit le bloc monde complet, le Directeur et le Cerveau un digest) → prose cohérente (pas de PNJ ressuscité ni de lieu erroné) et deltas mécaniques sains. Un **Relecteur** peaufine la scène avant affichage, avec repli sûr sur le brouillon en cas d'échec.
- **Jet de dé caché** : chaque choix (attribut + difficulté) déclenche un jet invisible qui oriente la narration, sans fiche de perso à l'écran.
- **Monde vivant** persistant : PV, crédits, lieu, date, blessures, inventaire, PNJ, réputation des factions, chronologie. Sauvegarde et reprise automatiques.

### 🎨 Interface
- Direction **« museum-cinema »** : plein écran, imagerie cinématique, typo gravée (Cinzel / Bitter), sobre.
- Bibliothèque en grille « affiches », **assistant de création en 4 étapes** (ère → personnage → trame → style), écran de jeu immersif.
- HUD **« État »** repensé : relations PNJ et réputation des factions en **paliers lisibles** (Loyal/Allié/Amical/Neutre/Méfiant/Hostile/Ennemi…) plutôt qu'en nombres bruts −100/+100, avec barres froid→chaud.
- **Réglages épurés** : clé OpenRouter + modèle, langue (qui pilote vraiment les récits), thème, et avancés (moteur narratif, raisonnement). Sauvegarde explicite et claire.

### 🧱 Technique
- Stack conservée et saine : SvelteKit 2 · Svelte 5 · Vite · Dexie (IndexedDB) · Vitest.
- Moteur **100 % modulaire** — discipline anti-bordel : **aucun fichier > ~300 lignes**, zéro logique métier dans les composants. **39 tests** verts.
- **OpenRouter en `fetch` direct** (jamais le SDK, cassé en navigateur), pas de plafond de tokens, raisonnement « auto » par défaut.
- Bannissement strict du tiret cadratin en tête de dialogue, choix génériques proscrits, cohérence d'ère imposée — reconstruits proprement.
- Base IndexedDB neuve (`StarWarsStory`), application installable (PWA, manifest assaini).

### 🗑️ Retiré (par rapport à la 2.x)
- Dossiers, page Corbeille dédiée (→ **suppression annulable**), historique de versions, statistiques, profils créatifs, génération d'images, raccourcis clavier, catalogue de modèles statique, et les réglages de style **globaux** redondants (désormais uniquement par histoire, dans l'assistant). Réintroductibles si le besoin se confirme.

### ⏳ Repoussé (hors v1 Lite)
- Service worker hors-ligne, génération d'images, récupération dynamique de la liste des modèles OpenRouter.

> _La lignée 2.x (jusqu'à 2.7.19) n'est plus maintenue : la 3.0 est une base neuve. L'historique complet reste ci-dessous et dans Git._

## v2.7.19 — 2026-05-25

### 🧠 Libération totale et globale du raisonnement à toutes les étapes (`agentic.ts`)

- **Raisonnement systématique activé pour tous** :
  * Suite à la demande expresse de l'utilisateur d'activer le raisonnement à l'ensemble du pipeline multi-agent, nous avons passé le paramètre `skipReasoning` à `false` pour l'ensemble des étapes de génération de l'histoire.
  * Les quatre étapes du pipeline (*Scribe*, *Directeur*, *Écrivain*, *Cerveau*) s'exécutent désormais avec le **raisonnement activé à 100%**.
  * Permet aux modèles modernes (GPT 5.5, Sonnet 4.6, Grok 4.3, Gemini 3.5 Flash, DeepSeek V4 Pro/Flash) de mobiliser toute leur puissance de réflexion structurée non seulement pour la prose littéraire, mais aussi pour résumer la situation, ajuster la tension dramatique, et calculer les statistiques et choix en JSON de façon ultra-intelligente.
- **Diagnostics** :
  * 162 tests Vitest validés à 100% au vert.
  * Svelte-check à 0 erreur et 0 warning.

## v2.7.18 — 2026-05-25

### 🧠 Restauration du raisonnement global par défaut (`providers.ts`)

- **Rétablissement du raisonnement pour tous les modèles** :
  * Suite à la clarification essentielle de l'utilisateur concernant l'écosystème moderne de modèles d'IA (GPT 5.5, Sonnet 4.6, Grok 4.3, Gemini 3.5 Flash, DeepSeek V4 Pro/Flash), nous avons rétabli l'activation globale du `reasoningStyle: 'openai-effort'` par défaut.
  * Tous les modèles, y compris les versions de Grok et les autres modèles haut de gamme, gèrent de façon native et fluide le raisonnement et supportent l'envoi de ces paramètres.
  * Suppression de la liste restrictive de détection manuelle qui avait été introduite à tort.
- **Diagnostics** :
  * Intégration validée à 100% avec 162 tests Vitest au vert.
  * Type-checking global `svelte-check` validé à 0 erreur et 0 warning.

## v2.7.17 — 2026-05-25

### 🛡️ Correction du plantage et fallback silencieux des modèles non-raisonnement comme Grok-2 (`providers.ts`)

- **Raisonnement conditionnel strict** :
  * Détection d'une anomalie critique : par défaut, le `reasoningStyle` était forcé à `'openai-effort'` pour TOUS les modèles du catalogue. Cela forçait l'envoi systématique du paramètre `reasoning: { effort: 'none' }` pour les requêtes rapides (`scribe`, `director`, `world-adjudicator`).
  * Des modèles comme **Grok-2**, **Grok-beta**, **GPT-4o** ou **Claude** sur OpenRouter ne supportent pas le paramètre `reasoning`. Son envoi provoquait une erreur HTTP 400 Bad Request silencieuse rejetée par l'API.
  * À cause de cet échec, notre pipeline multi-agent basculait systématiquement sur les **fallbacks locaux d'urgence** (qui renvoyaient des textes de secours très courts et des choix génériques et peu pertinents).
  * Résolution en limitant l'activation de `reasoningStyle: 'openai-effort'` **exclusivement** aux modèles de raisonnement confirmés (`o1`, `o3`, `r1`, `grok-3`, `grok-4`, `thinking`, `mimo`). Pour tous les autres, le paramètre `reasoning` est désormais totalement omis, rétablissant des appels d'API réussis à 100% avec des réponses complètes et riches pour Grok-2.
- **Diagnostics** :
  * Intégration validée avec succès sur 162 tests unitaires au vert.
  * Svelte-check à 0 erreur et 0 warning.

## v2.7.16 — 2026-05-25

### 🔓 Suppression du bridage forcé de `max_tokens` (`providers.ts`)

- **Bannissement des limites de sortie forcées par défaut** :
  * Suite au retour de l'utilisateur sur le fait que l'injection forcée d'une limite `max_tokens` / `max_completion_tokens` de 4096 par défaut bride la créativité et casse le raisonnement de modèles comme Grok et DeepSeek V4 Pro (surtout dans le mode "Long"), nous avons supprimé ce plafond.
  * La payload HTTP transmise à OpenRouter ou aux APIs OpenAI compatibles n'inclut désormais **plus aucun paramètre `max_tokens` ou `max_completion_tokens` par défaut** lorsque celui-ci est `undefined` dans la configuration de l'étape et que le modèle ne définit pas sa propre limite physique de sortie (`caps.maxOutputTokens`).
  * Permet aux modèles de s'auto-réguler et d'utiliser toute leur enveloppe de génération naturelle pour fournir une prose riche et non tronquée.
- **Diagnostics** :
  * Suite de 162 tests Vitest validée à 100% au vert.
  * Diagnostic `svelte-check` à 0 erreur et 0 warning.

## v2.7.15 — 2026-05-25

### 🔓 Correction du bridage silencieux de tokens d'OpenRouter (`providers.ts`)

- **Résolution du bridage de tokens par défaut** :
  * Détection d'un comportement d'OpenRouter qui applique une limite de sortie extrêmement basse par défaut (souvent 256 ou 512 tokens maximum) lorsque le paramètre `max_tokens` (`max_completion_tokens`) est omis de la requête API.
  * Ce bridage silencieux affectait lourdement les modèles sensibles comme Grok (qui raccourcissaient drastiquement leurs réponses pour tenir dans cette petite enveloppe).
  * Résolution définitive en imposant une **valeur par défaut généreuse de 4096 tokens** (`resolvedMaxTokens`) dans les payloads des transports SDK et fetch direct lorsque aucune limite n'est explicitement requise.
  * Redonne aux modèles (comme Grok ou Qwen) l'espace complet pour s'exprimer avec une prose riche et des choix complexes sans être coupés ou bridés par le réseau.
- **Diagnostics** :
  * Validation globale validée à **162 tests Vitest 100% au vert** et `svelte-check` à 0 erreur.

## v2.7.14 — 2026-05-25

### 🚫 Interdiction stricte et nettoyage absolu du tiret cadratin "—" dans les dialogues (`prompts.ts`, `parsing.ts`)

- **Bannissement des tirets dans les prompts de l'IA** :
  * Mise à jour de toutes les instructions système du Maître du Jeu (`prompts.ts`) et de l'Écrivain (`buildPipelineWriterSystemPrompt`) pour y formuler une **interdiction absolue et explicite** d'utiliser le tiret cadratin `"—"` ou n'importe quel tiret en début de réplique de dialogue.
  * Force le format de dialogue exclusif `"Nom : réplique"`.
- **Nettoyage automatique robuste** :
  * Intégration d'un double filtre de sécurité dans `sanitizeNarrativeText` (`parsing.ts`) pour supprimer de manière automatique et transparente tout tiret cadratin (`—`, `–`, `-`) situé au début d'une ligne ou après le double point d'introduction d'une réplique.
  * Utilisation d'un negative lookahead `(?!\d)` pour s'assurer que les signes moins suivis de chiffres (ex: `hp:-10` ou `credits:-200`) restent parfaitement intacts et préservés pour la mise à jour de l'état monde.
- **Diagnostics** :
  * Validation globale maintenue à **162 tests Vitest 100% au vert** et `svelte-check` à 0 erreur.

## v2.7.13 — 2026-05-25

### 🛡️ Protection robuste du portrait d'avatar généré par IA (`interactiveSession.ts`, `+page.svelte`)

- **Préservation des images d'avatar IA** :
  * Résolution du bug où l'avatar sous forme d'image Base64 générée par l'IA était effacé et réinitialisé par l'emoji de base `'🧑‍🚀'` lors du rechargement d'une session de jeu.
  * Implémentation d'une règle de protection d'avatar dans `sanitizeSetupSnapshot` (`interactiveSession.ts`) et dans le chargement de page principal (`+page.svelte`).
  * Si la story chargée dispose d'une image d'avatar IA valide (commençant par `data:` ou `http`) et que la session restaurée tente de lui appliquer un emoji de base ou une chaîne vide, l'image d'avatar IA est désormais systématiquement conservée et protégée de tout écrasement.
- **Tests unitaires dédiés** :
  * Ajout d'un test d'intégration pour valider la protection de l'avatar IA en cas de session contenant un emoji par défaut.
  * Validation globale portée à **162 tests Vitest 100% au vert** et 0 avertissement.

## v2.7.12 — 2026-05-25

### 🛠️ Résolution du bug de bascule réactive du panneau avancé (`SetupWizard.svelte`)

- **Correction du toggle d'options avancées** :
  * Résolution du bug de boucle réactive qui forçait la réouverture instantanée du panneau d'options avancées à la milliseconde près lorsque l'utilisateur cliquait sur "Masquer les réglages détaillés" sous une configuration personnalisée.
  * Remplacement de la condition réactive agressive par un suivi intelligent à usage unique (`lastActiveStepId`) qui détecte la transition vers l'étape de style pour initialiser l'état du panneau une seule fois.
  * Laisse désormais l'utilisateur plier et déplier les réglages détaillés librement et sans interférence.
- **Diagnostics & Type-Check** :
  * Validation réussie sur l'ensemble de la suite de 161 tests unitaires et 0 erreur statique `svelte-check`.

## v2.7.11 — 2026-05-25

### 💾 Migration & Mise à Jour Automatique Transparente des Histoires (`index.ts` persistence & DB)

- **Migration automatique au démarrage (`db/index.ts`)** :
  * Lors de l'initialisation de la base de données (`initializeDB`), l'application parcourt désormais l'ensemble des histoires stockées dans IndexedDB, les normalise et met à jour de façon permanente en base de données les enregistrements obsolètes de manière 100% transparente.
- **Normalisation ultra-robuste du Setup (`persistence/index.ts`)** :
  * Amélioration de `normalizeSetup` pour y appliquer des valeurs par défaut cohérentes (ère impériale, faction indépendante, prémisse de détresse d'origine, etc.) et les nouveaux réglages de presets narratifs (style cinématique, ton héroïque, POV troisième personne, longueur moyenne) si ceux-ci étaient absents ou corrompus.
  * Garantit qu'aucune ancienne histoire ne peut corrompre ou faire planter l'interface ou les prompts du moteur de jeu.
- **Diagnostics & Type-Check** :
  * Validation complète avec 161 tests Vitest au vert et 0 erreur statique `svelte-check`.

## v2.7.10 — 2026-05-25

### 🔓 Libération complète de l'écriture en mode "Long" (`agentic.ts`)

- **Bypass des limites artificielles de tokens** :
  * Lorsque l'utilisateur sélectionne l'écriture en mode "Long" (`writingLength === 'long'`), le budget maximum de tokens de sortie (`maxTokens` / `max_tokens`) transmis à l'API OpenRouter est désormais défini à `undefined`.
  * Cela supprime tout plafond artificiel et permet aux modèles (en particulier les modèles à fort raisonnement comme DeepSeek V4 Pro) d'écrire sans brides de tokens.
  * S'applique aussi bien au pipeline agentique à 4 sous-agents (étapes `writer` et `brain`) qu'au mode structuré mono-agent (`generateStoryTurnStructured`).
- **Suppression de la troncature narrative** :
  * Rehaussement du plafond de désérialisation narrative et de nettoyage de texte brut de 5 500 à **24 000 caractères** pour l'étape `writer` en mode "Long", évitant toute troncature intempestive de la prose.
- **Diagnostics & Type-Check** :
  * Intégration validée sur l'ensemble de la suite de 161 tests unitaires et 0 erreur statique `svelte-check`.

## v2.7.9 — 2026-05-25

### 🎬 Refonte de la création d'histoires & Presets Narratifs (`SetupWizard.svelte`, `setupCatalog.ts`, `prompts.ts`)

- **Presets Narratifs en 1 Clic (`setupCatalog.ts`)** :
  * Introduction de `NARRATIVE_PRESETS` configurant instantanément les 5 axes d'écriture de l'IA (Style, Ton, POV, Longueur, Contenu) pour une prise en main intuitive.
  * Ajout des presets d'ambiance canoniques : *Cinématique héroïque*, *Saga sombre*, *Aventure pulp*, *Légende épique* et *Immersif — tu es le héros*.
  * Consolidation des valeurs par défaut de configuration d'une histoire via `withSetupDefaults()`.
- **Refonte Ergonomique du Wizard UI (`SetupWizard.svelte`)** :
  * Remplacement de la grille complexe de 5 sélecteurs d'axes d'écriture par une grille moderne de cartes élégantes avec icônes pour les presets narratifs.
  * Intégration d'un bouton dépliable avec micro-animations fluides pour dévoiler les **Options Avancées** (les 5 axes d'écriture individuels historiques) à tout moment.
  * Détection automatique de configuration personnalisée pour forcer le déploiement du panneau d'options avancées.
  * Ajout d'une charte graphique PWA immersive, moderne et parfaitement intégrée au design system.
- **Enrichissement Littéraire des Trames de Départ (`setupCatalog.ts`)** :
  * Réécriture intégrale des prémisses des `TRAMES` de départ pour en faire de véritables amorces de tension dramatique riches en vocabulaire Star Wars (sabotages, reliques mystérieuses, secrets sombres, dilemmes de la Force).
- **Parité Stylistique de l'Ouverture Narrative (`prompts.ts`)** :
  * Injection automatique de directives d'écriture hyper-spécifiques dans `buildStartPrompt` et `buildSystemPrompt` adaptées en temps réel au style et ton choisis.
  * La Force applique désormais rigoureusement le style et le ton littéraire, cinématique ou immersif dès le premier paragraphe du prologue et sur l'ensemble de la campagne.
- **Certification Stabilité** :
  * 161 tests unitaires 100% au vert.
  * `svelte-check` : 0 erreur, 0 avertissement.

## v2.7.8 — 2026-05-25

### ⚡ Fast-Fail Réseau & Pipeline Intelligent (`providers.ts`, `agentic.ts`)

- **Détection des pannes de connexion (`providers.ts`)** :
  * Nouvelle fonction `isConnectionLevelFault` : distingue les échecs de connexion purs (`Failed to fetch`, `ConnectionError` — endpoint injoignable, CORS, DNS down) des erreurs serveur transitoires (429, 5xx, timeouts).
  * Les erreurs de connexion ne sont plus retryées 3 fois : **1 seule tentative de rejeu** (au lieu de 3), puis abandon immédiat avec diagnostic dédié "Connexion réseau impossible après tentative".
  * Les erreurs serveur (rate-limit 429, indisponibilité 5xx) conservent leurs 3 tentatives avec backoff exponentiel.
- **Abandon rapide du pipeline agentic (`agentic.ts`)** :
  * Si l'agent scribe (étape 1/4) échoue avec une panne réseau (`Failed to fetch`), le pipeline s'arrête immédiatement et passe en fallback local d'urgence — sans appeler les 3 autres agents qui échoueraient de toute façon.
  * Gain : ~12 secondes et 9 appels API inutiles économisés par tour en cas d'indisponibilité réseau.
- **Diagnostics réseau plus précis (`agentic.ts`)** :
  * Les logs `"response_format json_object indisponible"` et `"structured json_object indisponible"` ne s'affichent plus quand l'erreur sous-jacente est une panne réseau (`Failed to fetch`). À la place, un message `"réseau indisponible, aucun appel au provider"` est loggé, supprimant la confusion entre erreur de format et panne de connexion.
- **Stabilité** :
  * 160 tests unitaires 100% au vert.
  * `tsc --noEmit` : 0 erreur.

## v2.7.7 — 2026-05-25

### 🧠 Migration vers le SDK OpenRouter Officiel (`@openrouter/sdk`)

- **Transport Standardisé (`providers.ts`)** :
  * Remplacement des appels `fetch()` bruts et de la sérialisation manuelle OpenRouter par le SDK officiel `@openrouter/sdk` v0.12.35 (`OpenRouterCore` + `chatSend`).
  * Client HTTP personnalisé avec capture du body brut pour conserver des diagnostics complets et rétrocompatibles.
  * Gestion des erreurs typées SDK : `OpenRouterError`, `RequestTimeoutError`, `RequestAbortedError`, `ConnectionError`.
  * Conservation de la boucle de retries avec backoff exponentiel sur les erreurs 429/5xx et réseau.
- **Mise à Jour des Tests** :
  * Tous les mocks `fetch` convertis pour produire de vraies `Response` HTTP compatibles avec le mécanisme de parsing du SDK.
  * Fixtures de contrat adaptées : les réponses d'erreur incluent désormais le `content-type: application/json` pour passer les validateurs internes du SDK.
  * Tests de replay et soak migrés vers le même pattern.
- **Correction Lint Svelte 5 (`+page.svelte`)** :
  * Remplacement des `new Set()` réactifs par `SvelteSet` dans la page des paramètres pour conformité Svelte 5.
- **Stabilité** :
  * 160 tests unitaires 100% au vert.
  * `svelte-check` : 0 erreur, 0 avertissement.
  * `eslint` : 0 warning.

## v2.7.6 — 2026-05-25

### 🔬 Transparence Totale des Diagnostics Narratifs (Logger)

- **Fin du Caviardage des Données Narratives (`logger.ts`)** :
  * Les clés `prompt`, `messages`, `systemPrompt`, `userPrompt`, `content`, `body`, `rawBody` et `rawResponse` ne sont plus masquées dans les logs de diagnostics exportés. Seules les clés d'authentification (`apiKey`, `authorization`, `token`, etc.) restent strictement caviardées.
  * Seuil de troncature des chaînes rehaussé de 220 à 8 000 caractères pour capturer intégralement les prompts système, les réponses IA et le contenu narratif généré.
  * Les chaînes non-sensibles sont désormais préservées en texte intégral (au lieu d'un aperçu de 180 caractères), permettant un debug complet de la qualité narrative.
- **Synchronisation de la Version de l'Application** :
  * La constante `APP_VERSION`, `package.json`, `package-lock.json`, `static/manifest.json` et `README.md` sont passés de `2.0.0` à `2.7.5`, puis `2.7.6`, pour refléter fidèlement la progression du projet dans les exports de logs.
- **Stabilité Post-Intégration** :
  * Type-safety absolue certifiée par `svelte-check` avec **0 erreur et 0 avertissement**.
  * Intégration validée sur la suite complète de **160 tests unitaires 100% au vert**.

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