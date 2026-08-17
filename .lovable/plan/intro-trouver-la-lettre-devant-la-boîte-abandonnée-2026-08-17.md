# Intro : trouver la lettre devant la boîte abandonnée

Aujourd'hui, quand on relance une partie, la cinématique d'intro se déclenche toute seule après la fenêtre d'histoire. On veut à la place que le joueur démarre dehors, face à la porte condamnée, et doive **cliquer sur la lettre** pour lancer la cinématique.

## Ce qui change

1. **Départ dehors, cadré sur la porte**
   - Nouvelle partie (et reset) : vue extérieure, caméra placée devant la façade condamnée, sans fenêtre d'histoire bloquante.
   - Un court message d'ambiance s'affiche dans le journal : « Une enveloppe dépasse sous la porte… ».

2. **La lettre devient cliquable**
   - L'enveloppe posée devant la porte pulse doucement (halo + petit mouvement) tant qu'elle n'a pas été lue.
   - Une étiquette flottante « ✉️ Lire la lettre » apparaît au-dessus, visible sur mobile et PC.
   - Un tap/clic dessus lance la cinématique d'intro (celle de Rosa, inchangée).
   - Après la cinématique, la lettre et l'étiquette disparaissent définitivement (sauvegardé).

3. **Plus de déclenchement automatique**
   - La cinématique « intro » ne se joue plus toute seule ; les autres chapitres (Momo, la porte, Vasseur, la Reine, final) continuent normalement.
   - Si le joueur ignore la lettre, il peut jouer, mais le rappel reste affiché tant qu'il ne l'a pas lue.

## Détails techniques

Fichier principal : `src/game/cosmicCoin.ts`.

- `buildExteriorBuilding` : garder le groupe `letter` dans une variable de module (`introLetter`), lui donner `userData.pickable='letter'`, et l'animer dans la boucle (bob + halo).
- Nouveau handler de clic extérieur : dans le `pointerdown`/tap existant, quand `exteriorMode && !hoodEdit`, faire un `raycaster.intersectObject(introLetter, true)` avant les autres tests ; si touché → `playCinematic(STORY.find(b=>b.id==='intro'))` et pousser `'intro'` dans `state.storyDone`, puis retirer le groupe.
- `maybeStory()` : ignorer le beat `intro` (il n'est plus déclenché que par la lettre).
- `resetBtn` et le boot sans sauvegarde : ne plus ouvrir `storyModal` automatiquement, appeler `setExteriorMode(true)` puis positionner l'orbite sur la façade (theta/phi/radius proches de `STORY.intro.cam`).
- Étiquette : sprite texte (même technique que les autres labels 3D) attaché à la lettre, masqué dès que `storyDone` contient `intro`.
