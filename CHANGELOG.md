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
