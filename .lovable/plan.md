# Version PC installable (Windows + macOS)

Objectif : pouvoir lancer Cosmic Coin directement depuis ton ordinateur, hors ligne, sans passer par un navigateur ni par un magasin d'applications. Usage perso uniquement.

## Ce que tu recevras

- **Windows** : un fichier `.zip`. Tu le dézippes où tu veux, tu double-cliques sur `Cosmic Coin.exe`, et le jeu s'ouvre en fenêtre plein écran avec l'écran de démarrage néon. Tu peux créer un raccourci sur le bureau.
- **macOS** : un fichier `.zip` contenant `Cosmic Coin.app`, à glisser dans le dossier Applications. Au premier lancement, macOS demandera de confirmer l'ouverture (application non signée) : clic droit > Ouvrir.

Les deux versions embarquent tout : jeu, modèles 3D, musique, sauvegardes locales. Aucune connexion internet requise.

## Ce qui est déjà en place

- `electron/main.cjs` (fenêtre de l'app), `electron/splash.html` (écran de démarrage), icônes `icon.ico` / `icon.png`
- Un script `electron:pack` dans le projet

## Travaux à réaliser

1. **Chemins d'assets** : vérifier/mettre `base: './'` dans la config de build — sans ça la fenêtre reste blanche en mode fichier local.
2. **Sauvegardes** : confirmer que la progression (localStorage) persiste bien entre deux lancements de l'app.
3. **Outil de packaging** : passer sur `@electron/packager` (fiable ici) au lieu de `electron-builder`, et corriger le script de packaging pour qu'il inclue bien les modèles 3D et l'audio.
4. **Génération des builds** : produire la version Windows (win32 x64) et la version macOS (darwin x64/arm64), avec l'icône et le nom de l'app synchronisés depuis `brand.config.json`.
5. **Archives téléchargeables** : déposer `CosmicCoin-win32-x64.zip` et `CosmicCoin-darwin.zip` dans les documents du projet, avec un court mode d'emploi.
6. **Vérification** : lancer la version Linux localement pour valider que la fenêtre s'ouvre, que la scène 3D se charge et que le jeu ne reste pas bloqué sur l'écran de chargement (les builds Windows/macOS ne peuvent pas s'exécuter dans cet environnement, mais partagent le même code).

## Détails techniques

- `@electron/packager` avec `--platform=win32,darwin --arch=x64` (+ arm64 pour Mac Apple Silicon), `--icon=electron/icon`.
- Les binaires ne seront pas signés numériquement : Windows SmartScreen affichera « Informations complémentaires > Exécuter quand même », macOS Gatekeeper demandera une confirmation. C'est normal pour un usage perso ; une signature nécessiterait des certificats payants.
- Pas d'installateur `.exe` / `.dmg` (nécessitent des outils indisponibles ici) : ce sera un dossier portable à dézipper, ce qui reste un double-clic pour lancer.
- Le dossier `electron-release/` et les archives seront exclus du dépôt de code.
