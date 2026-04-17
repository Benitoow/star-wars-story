# Star Wars Story — v1.1.2

An open-source Star Wars story project whose playable deployment lives on the project's Cloudflare-hosted site. This repository now focuses on source, release notes, and archived legacy material.

- **Play the game:** the Cloudflare-hosted site used for the project
- **Release notes:** [`CHANGELOG.md`](./CHANGELOG.md)
- **Legacy archive:** [`archives/legacy-js/`](./archives/legacy-js/)

## English

### Status

- ✅ **Official release:** v1.1.2
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

### Hosting

The playable version is no longer served from GitHub Pages.

- The active build is hosted on the project's Cloudflare site.
- API secrets stay in the browser and are not committed.
- User data is stored locally in the browser.

The classic vanilla JS prototype has been physically moved under `archives/legacy-js/` for reference.
The root `index.html` is now a transition stub and no longer boots the legacy runtime.

### Development

Use the Cloudflare-hosted deployment to play the game.

The repository source remains useful for inspection and maintenance, but it is not the public play endpoint.

## Français

### Statut

- ✅ **Version officielle :** v1.1.2
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

### Hébergement

La version jouable n’est plus servie via GitHub Pages.

- La version active est hébergée sur le site Cloudflare du projet.
- Les secrets API restent côté navigateur et ne sont pas commis.
- Les données utilisateur sont stockées localement dans le navigateur.

Le prototype JavaScript classique a été déplacé physiquement dans `archives/legacy-js/` pour référence.
Le `index.html` racine est désormais une page de transition et ne lance plus le runtime legacy.

### Développement

Utiliser le déploiement Cloudflare pour jouer au projet.

Le dépôt reste utile pour la consultation et la maintenance, mais il n’est plus le point d’entrée public pour jouer.

