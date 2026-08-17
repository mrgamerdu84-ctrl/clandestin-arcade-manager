# Retirer la cloison noire et ses néons roses de l'intérieur

## Ce qui est visé

À l'intérieur de la boîte, une cloison courbe sépare l'arrière-salle : trois panneaux sombres surmontés chacun d'une barre néon rose. Elle est construite d'office, même dans une salle vide en début de partie.

## Ce qui change

- La cloison et ses néons roses disparaissent complètement du départ : la salle est nue.
- Ils deviennent un objet achetable dans la boutique déco intérieure : **« 🧱 Cloison arrière-salle » — 60¢**.
- Une fois acheté, la cloison réapparaît exactement comme aujourd'hui (courbure, passage caché au centre, barres néon roses).
- L'achat est sauvegardé comme les autres décos payantes, donc conservé au rechargement et remis à zéro lors d'une nouvelle partie.

## Détails techniques

- `src/game/cosmicCoin.ts` : entourer le bloc de construction de la cloison (lignes ~1444-1463) d'un test `hasCos('partition')`.
- Ajouter l'entrée `{id:'partition', label:'🧱 Cloison arrière-salle', price:60, zone:'in'}` à la liste `COSMETICS` (~ligne 1097) — l'UI de la boutique déco et la persistance existantes prennent le reste en charge automatiquement.
- Aucune modification du système d'arrière-salle lui-même : les machines clandestines et la logique de planque restent inchangées.
