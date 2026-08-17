# Machines personnalisables + clients visibles quand ils jouent

## Ce qu'on ajoute

### 1. Couleur de chaque machine
Dans le menu qui s'ouvre quand on clique une machine : une rangée de pastilles de couleur (8 teintes néon). On choisit, la machine change de couleur tout de suite. La teinte est sauvegardée avec la partie.

### 2. Tarif réglable par machine
Toujours dans le même menu : un curseur de tarif de −50 % à +150 % du prix normal.
- Tarif bas : moins d'argent par partie, mais les clients viennent plus souvent et la réputation monte plus vite.
- Tarif élevé : plus d'argent par partie, mais moins de clients choisissent cette machine et la réputation baisse doucement.
Le menu affiche en direct le gain moyen estimé et l'effet sur l'affluence.

### 3. Mode « arnaque » (machine truquée)
Un bouton 🎲 « Truquer la machine » par machine :
- gains ×1,8 sur cette borne,
- mais chaque partie a une chance de « client mécontent » : perte de réputation, et la jauge de soupçon police monte (comme les activités clandestines).
- Un client mécontent le montre : bulle « ARNAQUE ! » au-dessus de sa tête, il part immédiatement.
- Plus il y a de machines truquées, plus le risque grimpe. Un videur/guetteur déjà embauché réduit le risque.
Le mode se coupe à tout moment (la réputation remonte ensuite normalement).

### 4. On voit les clients jouer
Aujourd'hui le client colle à la machine et se retrouve caché dedans. Correctifs :
- Le point où il se place est reculé et calé sur la face avant réelle de la machine (selon sa taille), donc il reste devant, visible.
- Pendant la partie : animation de jeu lisible (mains sur la borne, léger balancement, appuis de pieds), plus une petite icône 🎮 et une barre de progression flottante au-dessus de lui.
- Les machines à plusieurs places (air hockey, tables clandestines) placent le client sur le bon côté.
- Filet de sécurité : si un client se retrouve dans le volume d'une machine, il est repoussé devant.

## Détails techniques

Fichiers touchés : `src/game/cosmicCoin.ts`, `src/routes/index.tsx` (markup du menu machine), `src/game/cosmic-coin.css` (pastilles couleur, curseur, bouton arnaque).

- Chaque machine posée reçoit `tint`, `priceMult` (défaut 1) et `rigged` (défaut false), appliqués au matériau et au calcul de gain ; ces champs entrent dans `cc_save_v1` (sauvegarde immédiate à chaque changement) et sont relus par `applySave`.
- `standSpotFor()` calcule l'offset depuis la bounding box de la machine au lieu d'une constante 1,05, avec variante latérale pour les machines multi-joueurs.
- Le choix de machine par le client pondère `priceMult` (tarif haut = moins souvent choisie).
- Le calcul de gain applique `priceMult`, puis `rigged` (×1,8 + tirage de mécontentement qui touche réputation et soupçon).
- Progression de jeu affichée via le système de textes flottants existant.
