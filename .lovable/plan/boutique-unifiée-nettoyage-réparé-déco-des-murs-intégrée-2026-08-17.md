# Boutique unifiée : nettoyage réparé, déco des murs intégrée

## Problèmes constatés

- **« Nettoyer un tas » ne réagit pas** : le panneau de remise en état est reconstruit à chaque rafraîchissement du jeu (environ toutes les secondes). Le bouton est détruit et recréé entre le moment où le doigt touche l'écran et le moment du clic, donc le clic se perd. Vérifié en test : l'élément se détache du DOM pendant l'appui.
- **Le bouton Boutique semble ne rien faire** : le panneau s'ouvre bien, mais il fait plus de 2 500 px de haut et s'ouvre sur la liste des machines. Le contenu utile (nettoyage, banque, murs) est très loin en bas, et sur grand écran le panneau étant déjà ouvert, le bouton le referme — d'où l'impression que « rien ne se passe ».
- **Personnalisation des murs séparée** : couleurs de murs, motifs et décos payantes vivent dans un panneau « Déco » distinct, alors que l'extérieur a sa boutique de quartier complète.

## Ce qui change

### 1. Bouton de nettoyage fiable
Le panneau de remise en état ne se reconstruit plus à chaque tick : le bouton reste le même élément et seul son texte se met à jour. Le tap fonctionne du premier coup, sur mobile comme sur PC.

### 2. Boutique en onglets
Le panneau Boutique reçoit une barre d'onglets fixe en haut, un seul contenu affiché à la fois :

```text
[ 🕹️ Machines ] [ 🧱 Salle & murs ] [ 🛋️ Déco ] [ 🏦 Banque ] [ ⚙️ Gestion ]
```

- **Machines** : machines, arrière-salle, personnel.
- **Salle & murs** : agrandir/rétrécir la salle (pavé mural existant), remise en état (nettoyage des gravats), extension.
- **Déco** : tout le contenu actuel du panneau Déco — couleur des murs, couleur des liserés, sol, motifs muraux payants (briques, panneaux, modèle), décos intérieures achetables, nom du club et enseigne.
- **Banque** : emprunt et remboursement.
- **Gestion** : mission en cours, journal, pause, fermeture du club, score.

Chaque onglet garde sa propre position de défilement et le panneau s'ouvre toujours sur le dernier onglet consulté.

### 3. Le bouton Boutique ouvre toujours quelque chose
Sur grand écran, appuyer sur Boutique n'entraîne plus une fermeture silencieuse : si le panneau est déjà visible, le bouton passe simplement à l'onglet suivant ou remonte en haut. La fermeture reste possible via la poignée du panneau.

### 4. Déco fusionnée dans la Boutique
Le bouton « Déco » du dock ouvre désormais la Boutique directement sur l'onglet Déco (plus de second panneau flottant qui se superpose). Le panneau Déco autonome est retiré pour éviter les conflits de clic déjà rencontrés.

## Détails techniques

- `src/game/cosmicCoin.ts` : `renderCleanPanel()` crée le bouton une seule fois (conservé dans une variable), puis met à jour le libellé et l'état ; même traitement pour le texte du coût.
- `src/routes/index.tsx` : ajout d'une barre `#shopTabs` dans `#sidebar` et regroupement des blocs existants (`itemList`, `decorList`, `backroomList`, `staffList`, `expandBox`, `cleanBox`, `bankBox`, `questBox`, `log`, `controlsRow`) dans cinq conteneurs `.shopTab`. Le contenu du `#stylePanel` est déplacé dans l'onglet Déco en gardant tous les identifiants existants pour ne rien casser côté logique.
- `src/game/cosmic-coin.css` : styles de la barre d'onglets (collante en haut du panneau, scrollable horizontalement sur mobile), suppression des règles du panneau Déco flottant.
- `initDock()` / `refreshDock()` : `dockShop` et `dockDeco` pointent vers le même panneau avec un onglet cible ; `styleOpen` est remplacé par l'onglet actif.
