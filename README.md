# Star Wars Story — v1.0.0

An open-source, static web app for creating interactive Star Wars stories. The public repository is ready for GitHub Pages and can be tested here:

- **Live demo:** https://star-wars-story.pages.dev/
- **Release notes:** [`CHANGELOG.md`](./CHANGELOG.md)

## English

### Status

- ✅ **Official release:** v1.0.0
- 🗓️ **Release date:** 2026-04-17
- 🌍 **Open source:** the repository is public, so the project is fully open for inspection and contribution.

### App flow

1. Choose the AI provider.
2. Choose the text model.
3. Choose the image model.
4. Open the dashboard.
5. Create, open, or delete stories.
6. Configure the story, then launch the narrative.

### Features

- Simple dashboard after the initial setup.
- Local storage for saved stories.
- Story deletion directly from the dashboard.
- Correct story resume from the dashboard with restored session state.
- Era, faction, role, and premise selection via the SVG assets in `svg/`.
- AI-powered story generation.

### GitHub Pages deployment

This repository is designed to be deployed as-is as a static site.

- GitHub Actions publishes the repository content to Pages.
- API secrets stay in the browser and are not committed.
- User data is stored locally in the browser.

### Development

Open `index.html` in a modern browser to test the static version locally.

## Français

### Statut

- ✅ **Version officielle :** v1.0.0
- 🗓️ **Date de release :** 2026-04-17
- 🌍 **Open source :** le dépôt est public, donc le projet est librement consultable et partageable.

### Parcours de l’application

1. Choix du fournisseur IA.
2. Choix du modèle texte.
3. Choix du modèle d’image.
4. Accès au tableau de bord.
5. Création, ouverture ou suppression d’histoires.
6. Configuration de l’histoire, puis lancement du récit.

### Fonctionnalités

- Tableau de bord simple après la configuration initiale.
- Gestion des histoires sauvegardées localement.
- Suppression d’histoires depuis le dashboard.
- Reprise d’une histoire au bon état depuis le dashboard (session restaurée).
- Sélection des eras, factions, rôles et prémisses via les SVG du dossier `svg/`.
- Démarrage d’histoire avec génération IA.

### Déploiement GitHub Pages

Le dépôt est conçu pour être publié tel quel comme site statique.

- Le workflow GitHub Actions publie le contenu du dépôt sur Pages.
- Les secrets API restent côté navigateur et ne sont pas commis.
- Les données utilisateur sont stockées localement dans le navigateur.

### Développement

Ouvrir `index.html` dans un navigateur moderne pour tester la version statique en local.

