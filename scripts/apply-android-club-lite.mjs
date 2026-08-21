import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/game/cosmicCoin.ts');
let src = fs.readFileSync(file, 'utf8');

if (src.includes('ANDROID_CLUB_LITE_V1')) {
  console.log('[android-club-lite] already applied');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const before = src;
  src = src.replace(search, replacement);
  if (src === before) throw new Error(`[android-club-lite] patch target not found: ${label}`);
}

replaceOnce(
  'export function startCosmicCoin(): () => void {',
  'export function startCosmicCoin(): () => void {\n/* ANDROID_CLUB_LITE_V1 — nouveautés club légères, sans toucher à la transition extérieur/intérieur */',
  'marker',
);

// Première tranche Android : seulement un coin repos léger dans la salle.
// Aucun projecteur, danseur, podium, rebuild de salle ni logique de transition n'est modifié.
replaceOnce(
  '  const ringR = Math.min(danceW, danceD)*CELL*0.46;\n',
  `  const ringR = Math.min(danceW, danceD)*CELL*0.46;\n\n  // Nouveauté Android légère : coin repos permanent.\n  const loungeRug = new THREE.Mesh(\n    new THREE.CircleGeometry(Math.max(1.0, Math.min(ringR*0.68, 2.2)), 20),\n    new THREE.MeshStandardMaterial({color:0x24182f,roughness:0.94,metalness:0.01})\n  );\n  loungeRug.rotation.x=-Math.PI/2;\n  loungeRug.position.set(danceCx,0.018,danceCz);\n  roomGroup.add(loungeRug);\n\n  [-1,1].forEach(side=>{\n    const seat=box(1.35,0.30,0.58, side<0?'#3d2048':'#302042');\n    seat.position.set(danceCx+side*Math.min(1.15,ringR*0.40),0.28,danceCz+0.58);\n    roomGroup.add(seat);\n  });\n\n  const loungeTable=cyl(0.34,0.34,0.07,'#21182b',14,{metalness:0.2,roughness:0.55});\n  loungeTable.position.set(danceCx,0.39,danceCz+0.14);\n  roomGroup.add(loungeTable);\n`,
  'light lounge corner',
);

fs.writeFileSync(file, src);
console.log('[android-club-lite] applied');
