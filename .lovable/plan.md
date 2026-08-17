# Repartir de zéro : petit local + quartier à construire

Nouvelle partie = un tout petit local vide et une rue de base. Tout le reste (murs, déco, machines, quartier) s'achète et se construit avec l'argent gagné.

## Départ de partie

- Local minimal 4x4 : quatre murs, un sol, une porte. Pas de piste de danse, pas de platine, pas de boule disco, pas de machine.
- Un peu de crasse à nettoyer (moins qu'aujourd'hui) pour garder l'ambiance "local repris".
- Budget de départ réduit et adapté : de quoi poser une première machine et un ou deux murs, avec la banque toujours disponible pour emprunter.
- La cinématique de la lettre est conservée, réécrite pour coller au petit local repris.

## Quartier

- Au démarrage : seulement le sol, les trottoirs et la rue principale devant la boîte (avec ses raccords automatiques virages/carrefours déjà en place).
- Aucun immeuble, arbre, lampadaire ou piéton d'office : tout se pose depuis la boutique Quartier, aux prix déjà définis.
- Le bouton "Tout raser" reste disponible pour repartir d'une page blanche à tout moment.
- Les habitants et voitures apparaissent progressivement selon ce que tu construis (routes = voitures, maisons = piétons), pour que le quartier s'anime au fur et à mesure.

## Agrandissement de la boîte

- Le pad "Murs de la salle" reste le moyen d'agrandir, avec un coût qui augmente à chaque rangée ajoutée (les premières rangées restent bon marché, les grandes salles coûtent cher).
- Les paliers d'étape (stages) ne forcent plus une taille de salle : c'est ta construction qui définit la taille, l'étape ne débloque plus que les objets et l'ambiance.
- Indicateur clair de la taille actuelle et du prix de la prochaine rangée.

## Sauvegarde

- La taille de salle, la déco, le contenu intérieur et le quartier construit sont tous sauvegardés ensemble et rechargés à l'identique.
- Le bouton Reset relance ce nouveau départ (petit local + rue de base) et efface le quartier personnalisé.

## Détails techniques

- `src/game/cosmicCoin.ts` :
  - `STAGES[0]` passe à 4x4 ; `roomSize()` s'appuie sur une taille de base fixe + `extraCols/extraRows` au lieu de la taille du stage, pour que la progression d'étape ne redimensionne plus la salle.
  - `freshState()` : argent de départ ajusté, `grime` réduit, aucun élément intérieur pré-posé.
  - `WALL_COST` devient une fonction du nombre de rangées déjà achetées (coût progressif) ; `renderExpandBox()` affiche le prix suivant.
  - Génération extérieure : séparation entre "socle" (sol, trottoirs, route principale) toujours généré et "décor" (immeubles, arbres, lampadaires, piétons, voitures) déplacé derrière un drapeau d'état, désactivé en nouvelle partie.
  - Piétons/voitures instanciés en fonction des objets présents dans `streetOvr` plutôt qu'en dur.
  - `serializeSave()` / `applySave()` : ajout du drapeau de génération du quartier pour que les anciennes parties gardent leur ville existante.
- `src/routes/index.tsx` / `src/game/cosmic-coin.css` : affichage de la taille de salle et du coût de la prochaine rangée dans le pad de murs.
