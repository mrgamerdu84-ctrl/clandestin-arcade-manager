# Cosmic Coin — Salle d'arcade clandestine

Portage de ton jeu 3D « Néon & Jetons » dans l'app, enrichi d'une couche clandestine : une arrière-salle illégale cachée derrière la façade honnête de l'arcade.

## L'histoire

**Été 1988.** Ta grand-tante Rosa te lègue le *Cosmic Coin*, une arcade fermée depuis trois ans — et une dette. Les jetons honnêtes ne suffiront jamais à rembourser à temps. Derrière le mur du fond, Rosa avait laissé une porte : l'ancienne salle de jeu clandestine du quartier.

Tu rouvres l'arcade au grand jour, et la backroom à la nuit tombée. Chaque soir, deux économies tournent en parallèle : les jetons des gamins devant, les mises des habitués derrière. Plus la backroom rapporte, plus la rumeur monte — et le commissariat de la 9e écoute.

## Boucle de jeu

**Façade (jour)**
- Poser des bornes (arcade, flipper, pince, distributeur, billetterie), encaisser les jetons.
- Réputation, clients qui affluent, extension de la salle (petite salle → grande salle → complexe).

**Backroom (nuit)**
- Débloquer l'arrière-salle cachée : machines à sous, table de paris, roue.
- Gains bien supérieurs, mais chaque machine illégale augmente la **Suspicion**.
- Actions de couverture : guetteur à l'entrée, faux mur, blanchiment via la caisse à jetons, pot-de-vin à l'inspecteur.

**Descentes de police**
- La suspicion monte avec les gains illégaux et les rumeurs ; elle baisse avec le blanchiment et les nuits calmes.
- À intervalle aléatoire (plus fréquent si suspicion élevée), une descente : compte à rebours pendant lequel tu dois planquer les machines illégales et fermer la porte.
- Réussite : rien à signaler, suspicion réduite. Échec : amende, saisie de machines, réputation touchée. Trois échecs = fermeture (game over).

**Fin**
- Rembourser la dette de Rosa avant l'échéance, en choisissant ta voie : arcade blanchie et légale, ou empire clandestin.

## Interface

- Vue 3D isométrique de la salle, caméra orbitale, HUD néon (jetons, réputation, suspicion, jour).
- Barre de suspicion bien visible + alerte rouge pendant une descente.
- Panneau boutique/gestion (bornes légales / matériel clandestin), journal d'événements narratifs.
- Écran d'intro racontant l'histoire, écrans de victoire/défaite.
- Jouable au clavier/souris et au tactile (le layout mobile actuel est conservé).

## Détails techniques

- Nouvelle page d'accueil `src/routes/index.tsx` montant le jeu ; logique 3D isolée dans un module client (`ClientOnly` + import dynamique, three.js déjà utilisé dans ton HTML).
- Le code du fichier `neon-et-jetons-3d.html` est repris et découpé en modules : scène/rendu, constructeurs de meshes, état du jeu, HUD React.
- Modèles Kenney (mini-arcade, mini-characters, city kits) uploadés en GLB via les assets CDN et chargés au besoin ; **aucun modèle d'aide** (béquilles, cannes, lunettes médicales, masques, défibrillateurs) n'est chargé ni tiré au sort pour les personnages.
- Aucun backend : la partie est locale, sauvegarde dans le navigateur.
- Titre, description et métadonnées SEO propres au jeu.

Dis-moi si tu veux ajuster l'histoire ou la difficulté des descentes avant que je construise.
