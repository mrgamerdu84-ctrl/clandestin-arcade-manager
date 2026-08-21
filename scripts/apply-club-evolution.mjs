import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/game/cosmicCoin.ts');
let src = fs.readFileSync(file, 'utf8');

if (src.includes('CLUB_EVOLUTION_PATCH_V1')) {
  console.log('[club-evolution] already applied');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const before = src;
  src = typeof search === 'string' ? src.replace(search, replacement) : src.replace(search, replacement);
  if (src === before) throw new Error(`[club-evolution] patch target not found: ${label}`);
}

// Mark the generated source so repeated builds stay idempotent.
replaceOnce(
  'export function startCosmicCoin(): () => void {',
  'export function startCosmicCoin(): () => void {\n/* CLUB_EVOLUTION_PATCH_V1 — salle arcade -> club progressif, PC + Android */',
  'patch marker',
);

// Player-placed floor blocks must carry their own animation phase.
if (!src.includes('tile.userData.phase = g.userData.tilePhase;')) {
  const tilePhasePatterns = [
    /g\.userData\.tilePhase\s*=\s*Math\.random\(\)\*6\.3;\s*return g;/,
    /g\.userData\.tilePhase\s*=\s*Math\.random\(\)\s*\*\s*6\.3;\s*return g;/,
  ];
  let patched = false;
  for (const pattern of tilePhasePatterns) {
    const before = src;
    src = src.replace(pattern, (match) => match.replace('return g;', 'tile.userData.phase = g.userData.tilePhase;\n    return g;'));
    if (src !== before) { patched = true; break; }
  }
  if (!patched) throw new Error('[club-evolution] patch target not found: floor tile phase');
}

// Add a lightweight show podium. On mobile this replaces the heavier PC-style show area.
if (!src.includes("'podium': ()=>{")) {
  const podiumBuilder = `  'podium': ()=>{\n    const g = group();\n    const base = cyl(0.7,0.78,0.18,'#20152c',24,{metalness:0.25,roughness:0.5});\n    base.position.y=0.09; g.add(base);\n    const top = cyl(0.64,0.64,0.08,'#5b285f',24,{emissive:0xff2e88,emissiveIntensity:0.45,metalness:0.35,roughness:0.38});\n    top.position.y=0.22; g.add(top);\n    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66,0.035,8,28),\n      new THREE.MeshStandardMaterial({color:0x20e6d0,emissive:0x20e6d0,emissiveIntensity:1.1,roughness:0.35}));\n    ring.rotation.x=Math.PI/2; ring.position.y=0.27; g.add(ring);\n    g.userData.showPodium = true;\n    return g;\n  },\n`;
  const builderEnd = /\n\s*}\);\s*\n\s*\/\* ---------- écrans allumés ----------/;
  const match = src.match(builderEnd);
  if (!match || match.index == null) throw new Error('[club-evolution] patch target not found: podium builder');
  src = src.slice(0, match.index) + '\n' + podiumBuilder + src.slice(match.index);
}

// Make the old all-in-one dance floor a controller only; the actual floor is built tile by tile.
replaceOnce(
  "{id:'dancefloor', cat:'piste', name:'Piste de danse lumineuse'",
  "{id:'dancefloor', cat:'piste', name:'Console de piste lumineuse'",
  'dancefloor rename',
);

replaceOnce(
  "  {id:'veloperope', name:'Cordon VIP doré', color:'#e8b64a', price:80, repBoost:0.7, repReq:8, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'vip'},\n",
  "  {id:'veloperope', name:'Cordon VIP doré', color:'#e8b64a', price:80, repBoost:0.7, repReq:8, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'vip'},\n  {id:'podium', name:'Podium spectacle', color:'#ff2e88', price:120, repBoost:0.9, repReq:5, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'spectacle'},\n",
  'podium shop item',
);

// Club progression: no more automatic full dance floor. Four placed floor tiles activate the club area.
replaceOnce(
  "  const hasFloor = owns('dancefloor');\n  const hasBall  = owns('discoball');\n  const hasDeck  = owns('djdeck');\n  const clubAlive = hasFloor && (state.grime|0) <= 0;",
  "  const floorBlocks = (state && state.machines ? state.machines : []).filter(m=>m.def && m.def.id==='floortile');\n  const podiums = (state && state.machines ? state.machines : []).filter(m=>m.def && m.def.id==='podium');\n  const hasFloor = floorBlocks.length >= 4;\n  const hasBall  = owns('discoball');\n  const hasDeck  = owns('djdeck');\n  const clubAlive = hasFloor && (state.grime|0) <= 0;\n  danceTiles = floorBlocks.map(m=>m.mesh && m.mesh.userData && m.mesh.userData.floorTile).filter(Boolean);",
  'club activation',
);

// Disable the legacy room-filling floor. The player now draws the floor with blocks.
replaceOnce(
  "  if(hasFloor){\n    for(let x=0;x<danceW;x++){",
  "  if(false && hasFloor){\n    for(let x=0;x<danceW;x++){",
  'disable auto dance floor',
);

// The former dance zone starts as a rest/lounge corner. Club equipment is added progressively by the player.
replaceOnce(
  "  const ringR = Math.min(danceW, danceD)*CELL*0.46;\n",
  `  const ringR = Math.min(danceW, danceD)*CELL*0.46;\n\n  // Coin repos permanent à la place de l'ancienne piste imposée.\n  const loungeRug = new THREE.Mesh(\n    new THREE.CircleGeometry(Math.max(1.1, Math.min(ringR*0.72, 2.4)), 28),\n    new THREE.MeshStandardMaterial({color:0x24182f,roughness:0.92,metalness:0.02})\n  );\n  loungeRug.rotation.x=-Math.PI/2; loungeRug.position.set(danceCx,0.018,danceCz); loungeRug.receiveShadow=true;\n  roomGroup.add(loungeRug);\n  [-1,1].forEach(side=>{\n    const seat=box(1.55,0.32,0.64, side<0?'#41204c':'#35204b');\n    seat.position.set(danceCx+side*Math.min(1.25,ringR*0.42),0.3,danceCz+0.62); roomGroup.add(seat);\n    const back=box(1.55,0.58,0.14, side<0?'#55275e':'#48255a');\n    back.position.set(seat.position.x,0.68,danceCz+0.34); roomGroup.add(back);\n  });\n  const loungeTable=cyl(0.38,0.38,0.08,'#21182b',18,{metalness:0.35,roughness:0.42});\n  loungeTable.position.set(danceCx,0.43,danceCz+0.15); roomGroup.add(loungeTable);\n  const loungeGlow = new THREE.PointLight(0xffb877, isMobile?0.45:0.75, 5, 2);\n  loungeGlow.position.set(danceCx,1.5,danceCz+0.2); roomGroup.add(loungeGlow);\n\n`,
  'lounge corner',
);

// Mobile show podium performers are clothed club dancers and are tied to placed podiums.
replaceOnce(
  "\n\n  // arrière-salle clandestine (sud-est) : moquette rouge sombre + lumière tamisée",
  `\n\n  // Podiums de spectacle : version légère et non sexualisée sur mobile.\n  if(clubAlive && podiums.length){\n    const maxShows = isMobile ? Math.min(2,podiums.length) : Math.min(3,podiums.length);\n    for(let i=0;i<maxShows;i++){\n      const pm = podiums[i];\n      const ch = buildCharacter(['#ff4fa3','#20e6d0','#9b5cff'][i%3]);\n      ch.position.set(pm.mesh.position.x,0.28,pm.mesh.position.z);\n      ch.rotation.y = (pm.mesh.rotation.y||0) + Math.PI;\n      roomGroup.add(ch);\n      dancers.push({wrap:ch,base:0.28,phase:Math.random()*6.3,style:i%2?'sway':'spin',x:ch.position.x,z:ch.position.z,podium:true});\n    }\n  }\n\n  // arrière-salle clandestine (sud-est) : moquette rouge sombre + lumière tamisée`,
  'podium dancers',
);

// Rebuild club visuals when modular club pieces are placed or sold.
replaceOnce(
  "if(['dancefloor','discoball','djdeck'].includes(def.id)) rebuildRoomKeepMachines();",
  "if(['dancefloor','discoball','djdeck','floortile','podium','movinglight','banquette','lowtable','loungelamp'].includes(def.id)) rebuildRoomKeepMachines();",
  'placement rebuild list',
);
replaceOnce(
  "if(['dancefloor','discoball','djdeck'].includes(m.def.id)) rebuildRoomKeepMachines();",
  "if(['dancefloor','discoball','djdeck','floortile','podium','movinglight','banquette','lowtable','loungelamp'].includes(m.def.id)) rebuildRoomKeepMachines();",
  'sale rebuild list',
);

// Group decorations in the shop by category, while the existing reputation lock remains the level gate.
replaceOnce(
  "  const decorList = document.getElementById('decorList');\n  decorList.innerHTML='';\n  DECOR.forEach(d=>renderItemInto(decorList,d));",
  `  const decorList = document.getElementById('decorList');\n  decorList.innerHTML='';\n  const clubCats = [\n    ['arcade','🕹️ Arcade'], ['repos','🛋️ Repos / lounge'], ['piste','🪩 Piste par blocs'],\n    ['lumieres','💡 Lumières'], ['son','🔊 Son / DJ'], ['spectacle','🎭 Spectacle'], ['vip','⭐ VIP']\n  ];\n  clubCats.forEach(([cat,label])=>{\n    const items = DECOR.filter(d=>(d.cat||'arcade')===cat);\n    if(!items.length) return;\n    const h=document.createElement('div'); h.className='hoodHead'; h.innerText=label; decorList.appendChild(h);\n    items.forEach(d=>renderItemInto(decorList,d));\n  });`,
  'shop categories',
);

// Animate player-placed moving lights and generate small club tips from podium shows.
replaceOnce(
  "    zoneLights.forEach((l,i)=>{",
  `    const placedMovingLights = state.machines.filter(m=>m.def && m.def.id==='movinglight');\n    placedMovingLights.forEach((m,i)=>{\n      const h = m.mesh && m.mesh.userData && m.mesh.userData.sweepHead;\n      if(!h) return;\n      const ph = (m.mesh.userData.sweepPhase||i*1.7);\n      h.rotation.y = Math.sin(t*0.9 + ph)*1.15;\n      h.rotation.x = -0.28 + Math.sin(t*0.65 + ph)*0.2;\n      const beam=m.mesh.userData.sweepBeam;\n      if(beam && beam.material) beam.material.opacity=(isMobile?0.10:0.18)+(0.07*Math.abs(Math.sin(t*2+ph)));\n      const lamp=m.mesh.userData.sweepLight;\n      if(lamp) lamp.intensity=0.7+Math.abs(Math.sin(t*2.4+ph))*1.2;\n    });\n\n    if(!state.paused && !state.closed && clubAlive){\n      state.showTipTimer = (state.showTipTimer||0) + dt;\n      if(state.showTipTimer >= 12000){\n        state.showTipTimer = 0;\n        const shows = state.machines.filter(m=>m.def && m.def.id==='podium').slice(0,isMobile?2:3);\n        if(shows.length){\n          const tip = earnMoney(2 + shows.length*2 + Math.floor(Math.random()*4), 'play');\n          const pm = shows[Math.floor(Math.random()*shows.length)];\n          if(tip>0){ spawnFloatText(pm.mesh.position, 'TIP +'+tip+'¢'); log('🎭 Le coin spectacle reçoit '+tip+'¢ de pourboires.'); }\n        }\n      }\n    }\n\n    zoneLights.forEach((l,i)=>{`,
  'moving lights and tips',
);

fs.writeFileSync(file, src);
console.log('[club-evolution] applied to src/game/cosmicCoin.ts');
