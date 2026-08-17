# Départ vraiment vide : local à l'abandon, façade nue

Objectif : au lancement d'une nouvelle partie, il ne reste que le bâti brut. Aucun néon, aucune enseigne, aucune déco — tout s'achète ensuite avec l'argent gagné.

## Intérieur — rien que les encombrants

- Retirer la barre néon + sa lumière au-dessus du mur nord (actuellement toujours affichée).
- Retirer les affiches murales et les colonnes d'angle du décor par défaut.
- Le sol reste un sol brut (moquette délavée sans couleur festive tant que rien n'est acheté).
- On garde uniquement : murs, porte, et les encombrants (cartons, planches, tentes, débris).
- Piste de danse, boule disco, platine : déjà conditionnés à l'achat, on vérifie qu'aucun élément lumineux ne subsiste.

## Extérieur — façade nue

- Supprimer par défaut : enseigne néon du toit + ses mâts, les 4 petites enseignes animées (OPEN / JEUX / 25c / TOKENS), les ampoules de marquise, la grande enseigne du nom, son halo et sa lumière, l'auvent rose de la porte.
- Vitrines : plus de bornes d'arcade allumées ni de tubes néon derrière la vitre — vitres sales/opaques d'un local fermé.
- Le mur isolé de la ruelle qui flotte à côté du bâtiment est supprimé.
- On garde : le volume du bâtiment, le socle, le toit et ses équipements techniques, les planches clouées sur la porte et la lettre du départ.

## Tout devient achetable

Chaque élément retiré devient un objet de boutique (rubrique « Façade » ou « Déco intérieure ») avec un prix, et n'apparaît dans la scène qu'une fois acheté :

| Élément | Où |
|---|---|
| Enseigne du nom (néon façade) | Boutique enseigne, déjà payante — devient non-possédée au départ |
| Enseigne de toit | Boutique extérieure |
| Petites enseignes OPEN / JEUX / 25c | Boutique extérieure |
| Ampoules de marquise + auvent | Boutique extérieure |
| Vitrines éclairées | Boutique extérieure |
| Affiches murales, colonnes, barre néon intérieure | Boutique déco intérieure |

## Détails techniques

- `src/game/cosmicCoin.ts` : conditionner ces blocs dans `buildRoom()` et `buildExteriorBuilding()` à un test de possession (`state.cosmetics` / `owns(id)`), supprimer `alleyWall`.
- Nouveau champ `cosmetics: []` dans l'état sauvegardé, avec migration : les parties existantes gardent ce qu'elles affichaient déjà.
- Ajout des entrées correspondantes dans les listes d'articles boutique (intérieur et extérieur) avec leurs prix, et reconstruction de la scène à l'achat.
