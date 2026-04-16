# Star Wars Story

Une application web statique pour créer des histoires interactives Star Wars, directement compatible avec GitHub Pages.

## Flux de l'application

1. Choix du fournisseur IA.
2. Choix du modèle texte.
3. Choix du modèle d’image.
4. Accès au tableau de bord.
5. Création / ouverture / suppression d’histoires.
6. Configuration de l’histoire, puis lancement du récit.

## Fonctionnalités

- Tableau de bord simple après la configuration initiale.
- Gestion des histoires sauvegardées localement.
- Suppression d’histoires depuis le dashboard.
- Sélection des eras, factions, rôles et prémisses via les SVG du dossier `svg/`.
- Démarrage d’histoire avec génération IA.

## Déploiement GitHub Pages

Le dépôt est conçu pour être publié tel quel comme site statique.

- Le workflow GitHub Actions publie le contenu du dépôt sur Pages.
- Les secrets API restent côté navigateur et ne sont pas commis.
- Les données utilisateur sont stockées localement dans le navigateur.

## Développement

Ouvrir `index.html` dans un navigateur moderne pour tester la version statique.

## Notes

- Les histoires sont stockées localement dans `localStorage`.
- Le dashboard permet de revenir à la configuration d’une histoire ou d’en supprimer une.
