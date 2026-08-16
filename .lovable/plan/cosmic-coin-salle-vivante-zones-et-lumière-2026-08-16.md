# Cosmic Coin — salle vivante, zones et lumière

Trois chantiers : casser l'aspect « cube », découper l'intérieur en vraies zones, et rendre le jeu clairement visible avec un réglage de lumière.

## 1. Utiliser tes modèles Kenney (fini le tout-procédural)

Les packs que tu as fournis contiennent bien des modèles GLB (mini-arcade, mini-characters, city kits commercial / industrial / suburban / roads, car kit). On les extrait dans `public/models/` et on les charge dans la scène.

- Bornes, flipper, air hockey, basket, pince, caisse, distributeur : modèles `kenney_mini-arcade`.
- Clients et personnel : `kenney_mini-characters`, **avec exclusion stricte de tous les fichiers `aid-*`** (béquilles, cannes, défibrillateurs, masques) — ils ne sont même pas copiés dans le projet.
- Rue, immeubles, trottoirs, voitures : city kits + car kit.
- Chargement asynchrone avec écran de chargement existant ; repli sur les formes procédurales actuelles si un modèle manque.

## 2. Intérieur découpé en 3 zones

Le sol devient une salle en L (plus seulement un rectangle) avec trois espaces distincts, chacun avec son sol, sa lumière et son ambiance :

```text
┌───────────────┬──────────┐
│   ARCADE      │  PISTE   │
│  (bornes)     │  DE      │
│               │  DANSE   │
├───────┬───────┴──────────┤
│ ENTREE│  ..porte cachée..│
└───────┤  ARRIÈRE-SALLE   │
        └──────────────────┘
```

- **Zone jeu** : bornes d'arcade, moquette néon, clients qui font la queue.
- **Piste de danse** : sol à dalles lumineuses qui pulsent, boule à facettes, DJ, spots colorés mobiles ; les clients dansent (animation) et font monter la réputation.
- **Arrière-salle clandestine** : derrière le faux mur, éclairage rouge/ambre tamisé, tables de jeu et trafic ; c'est là que la suspicion monte et qu'on planque pendant une descente.

Chaque type de machine ne peut se poser que dans sa zone (indication visuelle au survol).

## 3. Moins « carré », dedans comme dehors

- Murs avec angles coupés et retrait sur la piste de danse, cloison courbe vers la backroom.
- Trottoirs et bordures arrondis, rue légèrement en biais, immeubles de hauteurs et rotations variées, quelques éléments placés hors grille.
- Coins adoucis (chanfreins) sur les meubles procéduraux restants.

## 4. Lumière et lisibilité

- Nouveau bouton **☀️ / 🌙 / Auto** dans le HUD : jour clair, nuit néon, ou cycle automatique.
- Un curseur **Luminosité** qui règle l'exposition du rendu, gardé en mémoire dans le navigateur.
- Mode jour : ciel clair, ambiance forte, brouillard quasi supprimé — on voit tout net.
- Mode nuit : ambiance relevée par rapport à aujourd'hui pour rester lisible, néons qui ressortent.

## Idées en plus (dis oui/non)

- **Videur** à l'entrée de la backroom : filtre les clients, réduit la suspicion.
- **Événement « soirée »** : la piste de danse remplie booste les gains de la backroom (foule = couverture).
- **Mini-jeu de planque** pendant une descente : cliquer chaque machine illégale avant la fin du chrono.
- Sauvegarde locale de la partie et bouton « nouvelle nuit ».

## Détails techniques

- Extraction des ZIP Kenney vers `public/models/<kit>/*.glb`, chargement par `GLTFLoader` + cache dans un nouveau `src/game/models.ts`.
- `buildRoom()` refactorisé en zones (`ZONES`) avec masques de cellules par zone ; validation de pose selon la zone dans le handler de clic.
- Nouveau module d'éclairage : exposition `renderer.toneMappingExposure`, presets jour/nuit, brouillard piloté par preset et par mode intérieur/extérieur.
- Piste de danse : shader/matériaux animés sur les dalles + `SpotLight` colorées dans la boucle `animate()`.
