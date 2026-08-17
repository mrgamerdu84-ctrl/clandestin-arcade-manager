# Correctifs : PNJ à l'envers, nettoyage perdu, entrée de la salle

Trois problèmes constatés dans le code du jeu.

## 1. Les PNJ marchent à reculons

L'aide d'orientation utilisée par les clients, les visiteurs de la porte et les danseurs applique une rotation de 180° après `lookAt`. Dans Three.js, `lookAt` oriente déjà l'avant de l'objet (axe +Z, celui où sont placés les pieds du personnage) vers la cible : le demi-tour supplémentaire les fait donc avancer dos en avant. Les piétons de la rue, qui n'utilisent pas cette fonction, marchent correctement — d'où l'incohérence visible.

Correction : supprimer le demi-tour, puis vérifier en jeu les trois cas (client vers une machine, client qui ressort, visiteur à la porte) et aligner les piétons/danseurs sur la même convention si un cas reste inversé.

## 2. Le nettoyage n'est pas sauvegardé

Le nombre de tas restants entre bien dans la sauvegarde, mais celle-ci n'est écrite que toutes les 5 secondes (ou à la fermeture de l'onglet). Test réalisé : après 3 nettoyages puis 6 secondes d'attente, le rechargement conserve bien 9 tas — mais un rechargement immédiat perd le progrès.

Correction : écrire la sauvegarde immédiatement après chaque action importante — nettoyage d'un tas, achat/vente de machine ou de décor, agrandissement de la salle, emprunt ou remboursement.

## 3. Entrée : mur manquant et clients qui traversent

Les clients apparaissent à un mètre à l'extérieur du mur ouest et se dirigent en ligne droite vers leur machine : ils traversent la façade au lieu de passer par la porte. Les jambages de porte existent bien, mais l'ouverture n'est pas reliée au trajet des clients, ce qui donne l'impression d'un trou dans le mur.

Correction :
- Faire apparaître les clients devant le seuil, puis leur imposer un point de passage au centre de la porte avant de rejoindre la machine ; même trajet inversé pour la sortie.
- Compléter la maçonnerie autour de la porte : linteau au-dessus de l'ouverture et jambages ajustés à la largeur exacte de l'encadrement, pour qu'aucun vide ne subsiste entre le mur et la porte, vue de l'intérieur comme de l'extérieur.

## Détails techniques

- `src/game/cosmicCoin.ts` — `faceTowards()` : retirer `mesh.rotation.y += Math.PI`.
- `src/game/cosmicCoin.ts` — `cleanOne()` et les fonctions d'achat/vente/agrandissement/banque : appel à `writeSave()` en fin d'action.
- `src/game/cosmicCoin.ts` — `spawnCustomer()` / `updateCustomers()` : ajout d'une phase `door` avec un waypoint calculé depuis `doorRow`, plus point d'apparition ramené au seuil.
- `src/game/cosmicCoin.ts` — `buildRoom()` : linteau au-dessus de l'ouverture ouest et jambages calés sur la largeur du `buildDoorway`.

## Vérification

Contrôle en navigateur : capture de l'entrée depuis l'intérieur (aucun trou), observation d'un client qui entre par la porte face en avant, et nettoyage suivi d'un rechargement immédiat pour confirmer la sauvegarde.
