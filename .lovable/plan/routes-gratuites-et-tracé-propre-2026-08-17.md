# Routes gratuites et tracé propre

## Ce qui change pour toi

1. **Les routes deviennent gratuites** dans la boutique du quartier : route auto, route droite, passage piéton, virage, carrefour et trottoir passent à 0¢ (affichés « Gratuit »). Tu peux tracer ton quartier sans vider la caisse. Les maisons, immeubles et décos gardent leurs prix.

2. **Tracé au doigt / à la souris** : en sélectionnant une route, tu peux maintenir et glisser pour poser une ligne complète de dalles d'un coup, au lieu de cliquer case par case.

3. **Raccordement automatique fiable** :
   - une dalle isolée ou en bout de ligne s'affiche comme une route droite bien orientée (plus de bout coupé bizarre) ;
   - deux voisins alignés = ligne droite, deux voisins perpendiculaires = virage, trois = carrefour en T, quatre = croisement ;
   - poser ou retirer une dalle recalcule aussi les dalles voisines, donc le réseau reste raccordé en permanence.

4. **Plus de dalles empilées** : cliquer sur une case déjà occupée par une route la remplace au lieu d'en superposer une deuxième (source des routes qui « clignotent » ou qui paraissent tordues).

5. **Suppression propre** : effacer une dalle rebranche immédiatement les voisines (un virage redevient droite, un carrefour redevient T, etc.).

## Détails techniques (src/game/cosmicCoin.ts)

- `HOOD_COST` : mettre `roadauto/road/roadcross/roadbend/roadinter/sidewalk` à 0 ; `hoodCost` renvoie 0 et `payFor` est court-circuité pour un coût nul ; l'UI de la palette affiche « Gratuit » au lieu de « 0¢ ». `hoodRefund` renvoie 0 pour ces ids.
- `autoRoadPiece` : corriger la table `ROAD_SHAPES` / le mapping de rotation — cas `n===1` renvoyer `ROAD_STRAIGHT` aligné sur le voisin (au lieu de `ROAD_END`), cas `n===0` garder droite ; vérifier les ouvertures `open` de `ROAD_BEND` et `ROAD_TEE` contre les modèles Kenney et l'inversion de sens de rotation (`(d - r + 4) % 4`).
- Placement (`canvas` click handler, ~ligne 3396) : avant `hoodData.push`, si une entrée route existe déjà sur la même cellule (`roadCellKey`), la remplacer.
- Effacement (~ligne 3372) : appeler `rebuildHood()` après le filtre quand l'entrée retirée est une route, pour recalculer les voisines.
- Tracé continu : sur `pointerdown` + `pointermove` en mode édition avec une route sélectionnée, poser une dalle par cellule traversée (dédupliquée par `roadCellKey`), en désactivant la rotation caméra pendant le glissement, puis un seul `rebuildHood()` + `writeHood()` au `pointerup`.
