// @ts-nocheck
/* Cosmic Coin — salle d'arcade clandestine (moteur 3D, procédural, sans modèle externe) */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createDiscoAudio } from "./discoAudio";

export function startCosmicCoin(): () => void {
/* ============================================================
   THREE.JS SETUP
   ============================================================ */
// detect mobile / lower-power devices (Android phones especially) so we can
// scale rendering cost down for a smooth frame rate instead of a fixed-quality
// setup that chokes on weaker GPUs
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

const canvas = document.getElementById('three');
const _winL = [];
function addWin(t,f,o){ window.addEventListener(t,f,o); _winL.push([t,f,o]); }
let _raf = 0; let _disposed = false;
THREE.ColorManagement.enabled = false;
const renderer = new THREE.WebGLRenderer({canvas, antialias:!isMobile, powerPreference:'high-performance'});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile?1.5:2));
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
/* ---------- réglages de lumière du joueur ---------- */
let lightMode = 'auto';            // 'day' | 'night' | 'auto'
let brightness = 1.25;
// mode de rendu "léger" : aucun GLB n'est chargé, la scène est bâtie
// uniquement avec des placeholders procéduraux (démarrage instantané)
let lightRender = false;
try {
  lightMode = localStorage.getItem('cc_lightmode') || 'auto';
  brightness = parseFloat(localStorage.getItem('cc_brightness') || '1.25');
  if(!isFinite(brightness)) brightness = 1.25;
  lightRender = localStorage.getItem('cc_lightrender') === '1';
} catch(e) {}
renderer.toneMappingExposure = brightness;


function makeTextTexture(text, color){
  const cvs = document.createElement('canvas'); cvs.width=512; cvs.height=128;
  const c = cvs.getContext('2d');
  c.font='bold 76px monospace'; c.fillStyle=color; c.textAlign='center'; c.textBaseline='middle';
  c.shadowColor = color; c.shadowBlur = 24;
  c.fillText(text,256,68);
  return new THREE.CanvasTexture(cvs);
}
function makeSprite(text, color){
  const tex = makeTextTexture(text, color);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}));
  sp.scale.set(1.6,0.6,1);
  return sp;
}
// panneau plat (ne traverse pas les murs comme un sprite billboard)
function makeSignPanel(text, color, width, height){
  const tex = makeTextTexture(text, color);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide, depthWrite:false})
  );
  return m;
}
// halos néon qui s'estompent en plein jour
const nightHalos = [];
function registerNightHalo(sp, maxOpacity){
  sp.userData.maxOpacity = maxOpacity ?? 1;
  nightHalos.push(sp);
  return sp;
}
// lampes qui ne s'allument qu'à la tombée du jour (lampadaires, néons de façade)
const nightLamps = [];
// cônes de lumière volumétriques sous les lampadaires
const lightCones = [];
function registerNightLamp(light, maxIntensity){
  light.userData.maxIntensity = maxIntensity ?? light.intensity;
  light.intensity = 0;
  nightLamps.push(light);
  return light;
}




// "fake bloom": a soft radial-gradient sprite with additive blending, placed
// behind/around a light source. Real post-processing (UnrealBloomPass) needs
// extra Three.js addon scripts that aren't reliably loadable in this sandboxed
// environment (same issue we hit with GLTFLoader), so this gives the neon
// glow look with zero extra dependencies.
const glowTexCache = {};
function getGlowTexture(color){
  if(glowTexCache[color]) return glowTexCache[color];
  const size = 128;
  const cvs = document.createElement('canvas'); cvs.width=size; cvs.height=size;
  const c = cvs.getContext('2d');
  const grad = c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  grad.addColorStop(0, color+'ff');
  grad.addColorStop(0.4, color+'99');
  grad.addColorStop(1, color+'00');
  c.fillStyle = grad;
  c.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(cvs);
  glowTexCache[color] = tex;
  return tex;
}
function makeGlowSprite(hexColor, size){
  const tex = getGlowTexture(hexColor);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map:tex, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
  }));
  sp.scale.set(size,size,1);
  sp.userData.baseSize = size;
  return sp;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0618);
scene.fog = new THREE.Fog(0x0d0618, isMobile?28:34, isMobile?85:110);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

// ambient + directional light
const ambientLight = new THREE.AmbientLight(0xb9a8dd, 1.15);
// clair de lune : éclaire le quartier quand on est dehors
const streetMoon = new THREE.DirectionalLight(0xaebbff, 1.1);
streetMoon.position.set(-25, 30, 12);
streetMoon.visible = false;
scene.add(streetMoon);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.0);
sun.position.set(10, 16, 8);
sun.castShadow = true;
const shadowRes = isMobile ? 512 : 1024;
sun.shadow.mapSize.set(shadowRes,shadowRes);
sun.shadow.camera.left=-16; sun.shadow.camera.right=16;
sun.shadow.camera.top=16; sun.shadow.camera.bottom=-16;
scene.add(sun);
const fillLight = new THREE.PointLight(0xff2e88, 0.6, 30);
fillLight.position.set(-6,6,-6);
scene.add(fillLight);
const fillLight2 = new THREE.PointLight(0x20e6d0, 0.6, 30);
fillLight2.position.set(6,6,6);
scene.add(fillLight2);

/* ---------- sky dome (gradient shader, pure Three.js core — no extra libs needed) ---------- */
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(110, 24, 16),
  new THREE.ShaderMaterial({
    uniforms:{
      topColor:{value:new THREE.Color(0x05030f)},
      bottomColor:{value:new THREE.Color(0x150826)},
      offset:{value:14}, exponent:{value:0.7}
    },
    vertexShader:`varying vec3 vWorldPosition;
      void main(){
        vec4 worldPosition = modelMatrix * vec4(position,1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader:`uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;
      varying vec3 vWorldPosition;
      void main(){
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0), exponent), 0.0)), 1.0);
      }`,
    side: THREE.BackSide, fog:false, depthWrite:false
  })
);
scene.add(skyDome);

// sun + moon, arcing across the sky dome, far enough away to feel fixed in the sky
const SKY_R = 90;
const sunSprite = makeGlowSprite('#fff2c0', 9);
scene.add(sunSprite);
const moonCanvas = document.createElement('canvas'); moonCanvas.width=64; moonCanvas.height=64;
(function drawMoon(){
  const c = moonCanvas.getContext('2d');
  c.fillStyle='#e8ecff'; c.beginPath(); c.arc(32,32,28,0,Math.PI*2); c.fill();
  c.fillStyle='#c7cdea';
  [[22,20,6],[42,26,4],[26,42,5],[40,44,3]].forEach(([x,y,r])=>{ c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); });
})();
const moonTex = new THREE.CanvasTexture(moonCanvas);
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:moonTex, transparent:true}));
moonSprite.scale.set(5.5,5.5,1);
scene.add(moonSprite);
const moonHalo = makeGlowSprite('#c9d4ff', 9);
scene.add(moonHalo);

/* ---------- projecteurs de nuit : deux faisceaux qui balaient le quartier ---------- */
const searchlights = [];
let nightAmount = 0;   // 0 = plein jour, 1 = nuit noire (piloté par updateDayNight)

if(!isMobile){
  const beamDefs = [
    { x:-26, z:-20, color:0xff2e88, speed:0.32, phase:0 },
    { x: 24, z: 22, color:0x20e6d0, speed:-0.24, phase:1.9 },
  ];
  for(const d of beamDefs){
    const grp = new THREE.Group();
    grp.position.set(d.x, 0.2, d.z);
    const spot = new THREE.SpotLight(d.color, 0, 46, 0.22, 0.6, 1.2);
    spot.position.set(0, 0.6, 0);
    spot.target.position.set(0, 16, 0);
    grp.add(spot); grp.add(spot.target);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 2.0, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({color:d.color, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide})
    );
    beam.position.set(0, 17, 0);
    grp.add(beam);
    scene.add(grp);
    searchlights.push({ grp, spot, beam, speed:d.speed, phase:d.phase });
  }
}



// starfield, fades in at night
let starField = null;
if(!isMobile){
  const starCount = 240;
  const starPos = new Float32Array(starCount*3);
  for(let i=0;i<starCount;i++){
    const th = Math.random()*Math.PI*2, ph = Math.random()*Math.PI*0.5;
    const r = 95;
    starPos[i*3] = Math.cos(th)*Math.cos(ph)*r;
    starPos[i*3+1] = Math.sin(ph)*r + 5;
    starPos[i*3+2] = Math.sin(th)*Math.cos(ph)*r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
  const starMat = new THREE.PointsMaterial({color:0xffffff, size:0.6, transparent:true, opacity:0, depthWrite:false});
  starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);
}

function resize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
addWin('resize', resize);

/* ---------- custom orbit camera ---------- */
const orbit = {theta: Math.PI*0.25, phi: 1.0, radius: 16, target: new THREE.Vector3(0,0,0)};
function updateCamera(){
  const p = orbit.phi, t = orbit.theta, r = orbit.radius;
  camera.position.set(
    orbit.target.x + r*Math.sin(p)*Math.sin(t),
    orbit.target.y + r*Math.cos(p),
    orbit.target.z + r*Math.sin(p)*Math.cos(t)
  );
  camera.lookAt(orbit.target);
}
/* déplacement latéral de la caméra (pan) : on garde l'objet en main et on va voir ailleurs */
const PAN_LIMIT = 70;
function panCamera(dx, dy){
  const k = orbit.radius * 0.0016;
  const t = orbit.theta;
  // droite écran et "avant" projetés sur le sol
  const rx = Math.cos(t), rz = -Math.sin(t);
  const fx = Math.sin(t), fz = Math.cos(t);
  orbit.target.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, orbit.target.x - dx*k*rx + dy*k*fx));
  orbit.target.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, orbit.target.z - dx*k*rz + dy*k*fz));
  updateCamera();
}
function resetCameraTarget(){ orbit.target.set(0,0,0); updateCamera(); }

/* pad écran : bouger la vue gauche/droite et haut/bas, maintien = défilement continu */
function initCamPad(){
  const pad = document.getElementById('camPad');
  if(!pad) return;
  const dirs = [
    ['camLeft', -1, 0], ['camRight', 1, 0],
    ['camUp', 0, -1], ['camDown', 0, 1],
  ];
  for(const [id, sx, sy] of dirs){
    const b = document.getElementById(id);
    if(!b) continue;
    let raf = 0;
    const step = ()=>{ panCamera(sx*14, sy*14); raf = requestAnimationFrame(step); };
    const start = (e)=>{ e.preventDefault(); if(raf) return; step(); };
    const stop = ()=>{ if(raf){ cancelAnimationFrame(raf); raf = 0; } };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('contextmenu', (e)=>e.preventDefault());
  }
  const c = document.getElementById('camCenter');
  if(c) c.onclick = ()=> resetCameraTarget();
}

// unified mouse + touch handling via Pointer Events (1 doigt = pivoter, 2 doigts = zoom + déplacer)
const pointers = new Map(); // pointerId -> {x,y}
let dragging=false, dragMoved=false, panning=false;
let pinchStartDist=0, pinchStartRadius=0, pinchMid=null;
let tapStart=null;

/* --- mode « tap pour placer » : tolère le glissement du doigt et bloque la caméra --- */
const isCoarse = (typeof matchMedia==='function') && matchMedia('(pointer: coarse)').matches;
let tapPlace = (localStorage.getItem('cc_tapPlace') ?? (isCoarse?'1':'0')) === '1';
function placingActive(){
  try{
    if(exteriorMode) return !!(hoodEdit && (hoodSel || hoodCarry || hoodMove || hoodErase));
    return !!(!state.paused && (movingMachine || state.selected));
  }catch(err){ return false; }
}
function tapLock(e){ return tapPlace && e.pointerType!=='mouse' && placingActive(); }
function syncTapPlaceBtn(){
  const b = document.getElementById('tapPlaceBtn');
  if(b){ b.classList.toggle('on', tapPlace); b.title = tapPlace ? 'Tap pour placer : activé' : 'Tap pour placer : désactivé'; }
}
function initTapPlace(){
  const b = document.getElementById('tapPlaceBtn');
  if(!b) return;
  b.onclick = ()=>{
    tapPlace = !tapPlace;
    localStorage.setItem('cc_tapPlace', tapPlace?'1':'0');
    syncTapPlaceBtn();
    log(tapPlace ? 'Tap pour placer activé : glisse le doigt puis relâche pour poser (caméra bloquée pendant le placement).' : 'Tap pour placer désactivé.');
  };
  syncTapPlaceBtn();
}

function pointerDist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function pointerMid(a,b){ return {x:(a.x+b.x)/2, y:(a.y+b.y)/2}; }

canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('pointerdown', e=>{
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  dragMoved=false;
  if(pointers.size===1){
    tapStart = {x:e.clientX, y:e.clientY, t:performance.now(), locked:tapLock(e)};
    dragging = !tapStart.locked;   // en mode tap : pas de rotation caméra
    panning = (e.button===1 || e.button===2 || e.shiftKey);
  } else if(pointers.size===2){
    dragging=false; panning=false; tapStart=null;
    const pts=[...pointers.values()];
    pinchStartDist = pointerDist(pts[0],pts[1]);
    pinchStartRadius = orbit.radius;
    pinchMid = pointerMid(pts[0],pts[1]);
  }
});
addWin('pointermove', e=>{
  if(!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});

  if(pointers.size===2){
    const pts=[...pointers.values()];
    const d = pointerDist(pts[0],pts[1]);
    if(pinchStartDist>0){
      orbit.radius = Math.min(60, Math.max(7, pinchStartRadius * (pinchStartDist/d)));
      updateCamera();
    }
    const mid = pointerMid(pts[0],pts[1]);
    if(pinchMid) panCamera(mid.x - pinchMid.x, mid.y - pinchMid.y);
    pinchMid = mid;
    dragMoved=true;
    return;
  }
  if(pointers.size===1 && tapStart && tapStart.locked){
    // le doigt peut glisser librement : on ne bouge pas la caméra, le tap reste valide
    return;
  }
  if(dragging && pointers.size===1){
    if(panning) panCamera(dx, dy);
    else {
      orbit.theta -= dx*0.006;
      orbit.phi = Math.min(1.45, Math.max(0.35, orbit.phi - dy*0.006));
      updateCamera();
    }
    if(Math.abs(dx)+Math.abs(dy) > 3) dragMoved = true;
  }
});

function releasePointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size===0){ dragging=false; panning=false; pinchStartDist=0; pinchMid=null; tapStart=null; }
  else if(pointers.size===1){
    dragging=true;
    const [id,pt]=[...pointers.entries()][0];
    pointers.set(id,pt);
    pinchStartDist=0; pinchMid=null;
  }
}
addWin('pointerup', releasePointer);
addWin('pointercancel', releasePointer);
// clavier : ZQSD / WASD pour se déplacer, R pour recentrer
addWin('keydown', e=>{
  if(e.target && /input|textarea/i.test(e.target.tagName||'')) return;
  const k = e.key.toLowerCase();
  const step = 28;
  if(k==='z'||k==='w') panCamera(0, step);
  else if(k==='s') panCamera(0, -step);
  else if(k==='q'||k==='a') panCamera(step, 0);
  else if(k==='d') panCamera(-step, 0);
  else if(k==='r') resetCameraTarget();
});

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  orbit.radius = Math.min(60, Math.max(7, orbit.radius + e.deltaY*0.01));
  updateCamera();
},{passive:false});

/* ============================================================
   PRIMITIVE HELPERS
   ============================================================ */
function mat(color, opts={}){ return new THREE.MeshStandardMaterial({color, roughness:.55, metalness:.15, ...opts}); }
function box(w,h,d,color,opts){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color,opts));
  m.castShadow=true; m.receiveShadow=true; return m;
}
function cyl(rt,rb,h,color,seg=16,opts){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(color,opts));
  m.castShadow=true; m.receiveShadow=true; return m;
}
function sphere(r,color,opts){
  const m = new THREE.Mesh(new THREE.SphereGeometry(r,16,12), mat(color,{...opts}));
  m.castShadow=true; return m;
}
function group(){ return new THREE.Group(); }

/* ============================================================
   PALETTE (from Kenney mini-arcade look)
   ============================================================ */
const PAL = {
  wallDark:'#2b2438', wallPurple:'#6b4e9e', wallOrange:'#f4a13c',
  floorA:'#8a86a8', floorB:'#6f6a90',
  casinoWallDark:'#2a1420', casinoRed:'#7a1030', casinoGold:'#e8b64a',
  purple:'#7a5cc7', purpleDark:'#5a3f9c', pink:'#ef5fa7', teal:'#2fd1c5',
  orange:'#f4a13c', red:'#e0483f', green:'#3fbf6c', blue:'#3f8ef4',
  yellow:'#ffd23f', chrome:'#c9c9d6', black:'#221b30'
};

/* ============================================================
   MACHINE BUILDERS (procedural, low-poly, styled to match pack)
   ============================================================ */
const BUILDERS = {
  'arcade': ()=>{
    const g = group();
    const body = box(0.8,1.5,0.7, PAL.teal); body.position.y=0.75; g.add(body);
    const screen = box(0.6,0.5,0.05, PAL.black); screen.position.set(0,1.05,0.36); g.add(screen);
    const marquee = box(0.85,0.25,0.75, PAL.pink); marquee.position.y=1.62; g.add(marquee);
    const base = box(0.85,0.15,0.75, PAL.purpleDark); base.position.y=0.07; g.add(base);
    const stick = cyl(0.03,0.03,0.25, PAL.chrome); stick.position.set(-0.15,0.75,0.4); g.add(stick);
    return g;
  },
  'pinball': ()=>{
    const g = group();
    const table = box(0.9,0.15,1.6, PAL.purple); table.position.y=0.85; table.rotation.x=-0.12; g.add(table);
    const back = box(0.85,1.0,0.1, PAL.pink); back.position.set(0,1.55,-0.75); back.rotation.x=-0.12; g.add(back);
    const leg1=box(0.1,0.85,0.1,PAL.black); leg1.position.set(-0.35,0.42,-0.6); g.add(leg1);
    const leg2=leg1.clone(); leg2.position.x=0.35; g.add(leg2);
    const leg3=box(0.1,0.6,0.1,PAL.black); leg3.position.set(-0.35,0.3,0.65); g.add(leg3);
    const leg4=leg3.clone(); leg4.position.x=0.35; g.add(leg4);
    return g;
  },
  'claw': ()=>{
    const g = group();
    const base = box(0.9,0.9,0.9, PAL.orange); base.position.y=0.45; g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,12,0,Math.PI*2,0,Math.PI*0.55),
      new THREE.MeshStandardMaterial({color:0xbfe9ff, transparent:true, opacity:0.35, roughness:0.1}));
    dome.position.y=0.95; g.add(dome);
    const claw = cyl(0.03,0.03,0.4, PAL.chrome); claw.position.y=1.3; g.add(claw);
    for(let i=0;i<4;i++){
      const prize = box(0.12,0.12,0.12, [PAL.pink,PAL.teal,PAL.yellow,PAL.blue][i]);
      prize.position.set((i%2?0.15:-0.15),0.55,(i<2?0.15:-0.15)); g.add(prize);
    }
    return g;
  },
  'airhockey': ()=>{
    const g = group();
    const table = box(1.0,0.75,1.9, PAL.blue); table.position.y=0.4; g.add(table);
    const top = box(1.02,0.05,1.92, '#eaf6ff'); top.position.y=0.78; g.add(top);
    const goal1 = box(0.3,0.1,0.05, PAL.red); goal1.position.set(0,0.8,-0.95); g.add(goal1);
    const goal2 = goal1.clone(); goal2.position.z=0.95; g.add(goal2);
    return g;
  },
  'basket': ()=>{
    const g = group();
    const base = box(0.6,0.2,1.4, PAL.orange); base.position.y=0.1; g.add(base);
    const pole = box(0.12,2.2,0.12, PAL.purpleDark); pole.position.set(0,1.2,-0.6); g.add(pole);
    const board = box(0.6,0.5,0.05, '#f4f4f4'); board.position.set(0,2.1,-0.55); g.add(board);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.02,8,16), mat(PAL.red));
    rim.position.set(0,1.9,-0.4); rim.rotation.x=Math.PI/2; g.add(rim);
    return g;
  },
  'dance': ()=>{
    const g = group();
    const pad = box(1.2,0.15,1.2, PAL.black); pad.position.y=0.08; g.add(pad);
    for(let i=0;i<4;i++){
      const arrow = box(0.3,0.03,0.3, [PAL.pink,PAL.teal,PAL.yellow,PAL.blue][i]);
      arrow.position.set((i%2?0.3:-0.3),0.17,(i<2?0.3:-0.3)); g.add(arrow);
    }
    const board = box(1.0,1.3,0.08, PAL.purple); board.position.set(0,1.1,-0.6); g.add(board);
    const screen = box(0.7,0.5,0.05, PAL.black); screen.position.set(0,1.35,-0.55); g.add(screen);
    return g;
  },
  'gambling': ()=>{
    const g = group();
    const body = box(0.7,1.3,0.65, PAL.red); body.position.y=0.65; g.add(body);
    for(let i=0;i<3;i++){
      const reel = cyl(0.12,0.12,0.15, PAL.yellow,12); reel.rotation.z=Math.PI/2;
      reel.position.set(-0.2+i*0.2,0.85,0.34); g.add(reel);
    }
    const lever = cyl(0.03,0.03,0.4, PAL.chrome); lever.position.set(0.4,1.0,0.2); lever.rotation.z=0.4; g.add(lever);
    return g;
  },
  'wheel': ()=>{
    const g = group();
    const post = box(0.15,1.0,0.15, PAL.purpleDark); post.position.y=0.5; g.add(post);
    const wheel = cyl(0.55,0.55,0.1, PAL.yellow,16); wheel.rotation.x=Math.PI/2; wheel.position.y=1.25; g.add(wheel);
    for(let i=0;i<8;i++){
      const seg = box(0.5,0.02,0.08, i%2===0?PAL.pink:PAL.teal);
      seg.position.y=1.25;
      seg.rotation.z = (i/8)*Math.PI*2;
      seg.position.x = Math.cos((i/8)*Math.PI*2)*0.25;
      seg.position.z = Math.sin((i/8)*Math.PI*2)*0.25 - 0.55 + 0.55;
      g.add(seg);
    }
    return g;
  },
  'vending': ()=>{
    const g = group();
    const body = box(0.7,1.7,0.6, PAL.red); body.position.y=0.85; g.add(body);
    const glass = box(0.5,1.1,0.05, '#bfe9ff'); glass.position.set(0,1.0,0.32); g.add(glass);
    const label = box(0.72,0.25,0.02, '#f4f4f4'); label.position.set(0,1.65,0.31); g.add(label);
    return g;
  },
  'ticket': ()=>{
    const g = group();
    const body = box(0.6,1.1,0.5, PAL.purple); body.position.y=0.55; g.add(body);
    const slot = box(0.3,0.08,0.05, PAL.black); slot.position.set(0,0.7,0.26); g.add(slot);
    const top = box(0.65,0.1,0.55, PAL.yellow); top.position.y=1.15; g.add(top);
    return g;
  },
  'roulette': ()=>{
    const g = group();
    const tableTop = cyl(0.75,0.75,0.1, PAL.green,24); tableTop.position.y=0.75; g.add(tableTop);
    const rim = cyl(0.8,0.8,0.06, '#3a2a15',24); rim.position.y=0.82; g.add(rim);
    const wheel = cyl(0.4,0.4,0.06, PAL.black,24); wheel.position.y=0.86; g.add(wheel);
    for(let i=0;i<12;i++){
      const seg = box(0.1,0.02,0.04, i%2===0?'#c0392b':'#1b1b1b');
      const ang = (i/12)*Math.PI*2;
      seg.position.set(Math.cos(ang)*0.32,0.9,Math.sin(ang)*0.32);
      seg.rotation.y=-ang;
      g.add(seg);
    }
    const leg = cyl(0.08,0.12,0.7, PAL.purpleDark); leg.position.y=0.35; g.add(leg);
    return g;
  },
  'poker': ()=>{
    const g = group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,0.12,24), mat(PAL.green));
    top.scale.set(1,1,0.6); top.position.y=0.75; top.castShadow=true; g.add(top);
    const rim = top.clone(); rim.scale.set(1.05,1,0.63); rim.material=mat('#3a2a15'); rim.position.y=0.7; g.add(rim);
    for(let i=0;i<3;i++){
      const card = box(0.14,0.01,0.2, '#f4f4f4'); card.position.set(-0.2+i*0.2,0.82,0);
      card.rotation.x=-0.1; g.add(card);
    }
    const leg = cyl(0.1,0.14,0.7, PAL.purpleDark); leg.position.y=0.35; g.add(leg);
    return g;
  },
  'blackjack': ()=>{
    const g = group();
    const top = box(1.3,0.1,0.8, PAL.green); top.position.y=0.75; g.add(top);
    const rim = box(1.36,0.06,0.86, '#3a2a15'); rim.position.y=0.69; g.add(rim);
    const card1 = box(0.14,0.01,0.2,'#f4f4f4'); card1.position.set(-0.3,0.81,0.1); g.add(card1);
    const card2 = box(0.14,0.01,0.2,'#f4f4f4'); card2.position.set(-0.14,0.81,0.1); card2.rotation.y=0.3; g.add(card2);
    const leg = cyl(0.1,0.14,0.7, PAL.purpleDark); leg.position.y=0.35; g.add(leg);
    return g;
  },
  'trash': ()=>{
    const g = group();
    const body = cyl(0.22,0.18,0.55, PAL.chrome,12); body.position.y=0.3; g.add(body);
    const lid = cyl(0.24,0.24,0.06, '#8f8fa0',12); lid.position.y=0.6; g.add(lid);
    return g;
  },
  'poster': ()=>{
    const g = group();
    const base = box(0.5,0.06,0.28, PAL.black); base.position.y=0.03; g.add(base);
    const pole = box(0.05,1.2,0.05, PAL.chrome); pole.position.y=0.65; g.add(pole);
    const panel = box(0.7,0.9,0.05, PAL.pink); panel.position.y=1.25; g.add(panel);
    const stripe1 = box(0.7,0.15,0.06, PAL.yellow); stripe1.position.set(0,1.5,0.01); g.add(stripe1);
    const stripe2 = box(0.7,0.12,0.06, PAL.teal); stripe2.position.set(0,1.0,0.01); g.add(stripe2);
    return g;
  },
  'plant': ()=>{
    const g = group();
    const pot = cyl(0.28,0.22,0.4, '#8a5a3c',12); pot.position.y=0.2; g.add(pot);
    const c1 = sphere(0.32, PAL.green); c1.position.y=0.65; g.add(c1);
    const c2 = sphere(0.24, '#3fa25c'); c2.position.set(0.18,0.9,0.05); g.add(c2);
    const c3 = sphere(0.22, '#4bb567'); c3.position.set(-0.16,0.85,-0.1); g.add(c3);
    return g;
  },
  'bench': ()=>{
    const g = group();
    const seat = box(1.3,0.1,0.45, PAL.orange); seat.position.y=0.45; g.add(seat);
    const back = box(1.3,0.4,0.08, PAL.orange); back.position.set(0,0.7,-0.18); g.add(back);
    [[-0.55,-0.15],[0.55,-0.15],[-0.55,0.15],[0.55,0.15]].forEach(([x,z])=>{
      const leg = box(0.08,0.42,0.08, PAL.purpleDark); leg.position.set(x,0.2,z); g.add(leg);
    });
    return g;
  },
  'toilets': ()=>{
    const g = group();
    // cabine avec porte + cuvette : petit coin toilettes de l'arcade
    const wall1 = box(1.4,2.0,0.1, '#cfd6e6'); wall1.position.set(0,1.0,-0.6); g.add(wall1);
    const wall2 = box(0.1,2.0,1.2, '#cfd6e6'); wall2.position.set(-0.65,1.0,0); g.add(wall2);
    const door = box(1.2,1.7,0.08, '#5ba3d0'); door.position.set(0.1,0.9,0.55); g.add(door);
    const sign = box(0.28,0.28,0.04, PAL.yellow); sign.position.set(0.1,1.75,0.6); g.add(sign);
    const bowl = cyl(0.2,0.18,0.4,'#f2f5fa',12); bowl.position.set(-0.2,0.2,-0.15); g.add(bowl);
    const tank = box(0.36,0.4,0.16,'#f2f5fa'); tank.position.set(-0.2,0.55,-0.35); g.add(tank);
    const sink = cyl(0.16,0.12,0.14,'#e8eef7',12); sink.position.set(0.35,0.75,-0.4); g.add(sink);
    return g;
  },
  'tables': ()=>{
    const g = group();
    // table ronde + 3 chaises pour que les clients s'assoient
    const top = cyl(0.5,0.5,0.07,'#3a2350',20); top.position.y=0.72; g.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5,0.03,8,28), mat(PAL.pink));
    rim.rotation.x = Math.PI/2; rim.position.y = 0.76; g.add(rim);
    const foot = cyl(0.09,0.12,0.7, PAL.chrome,12); foot.position.y=0.35; g.add(foot);
    const base = cyl(0.32,0.32,0.05,'#1a1226',16); base.position.y=0.03; g.add(base);
    for(let i=0;i<3;i++){
      const a = i*Math.PI*2/3 + 0.4;
      const ch = group();
      const seat = cyl(0.2,0.2,0.08,'#20e6d0',14); seat.position.y=0.44; ch.add(seat);
      const backr = box(0.36,0.42,0.06,'#17b3a2'); backr.position.set(0,0.66,-0.18); ch.add(backr);
      const stem = cyl(0.05,0.06,0.42, PAL.chrome,10); stem.position.y=0.21; ch.add(stem);
      ch.position.set(Math.cos(a)*0.85, 0, Math.sin(a)*0.85);
      ch.rotation.y = -a + Math.PI/2;
      g.add(ch);
    }
    return g;
  },
  'djdeck': ()=>{
    const g = group();
    // platine du DJ : caisson, deux platines vinyle, mixette et enceintes
    const deck = box(1.5,0.85,0.6,'#241338'); deck.position.y=0.43; g.add(deck);
    const front = box(1.52,0.24,0.62, PAL.pink); front.position.y=0.7; g.add(front);
    for(let i=0;i<2;i++){
      const plate = cyl(0.2,0.2,0.05,'#0e0a16',18); plate.position.set(-0.4+i*0.8,0.88,0); g.add(plate);
      const vinyl = cyl(0.05,0.05,0.055, PAL.teal,12); vinyl.position.set(-0.4+i*0.8,0.91,0); g.add(vinyl);
    }
    const mixer = box(0.28,0.06,0.4,'#1c1430'); mixer.position.set(0,0.88,0); g.add(mixer);
    for(let i=0;i<3;i++){
      const knob = cyl(0.03,0.03,0.05, PAL.yellow,8); knob.position.set(-0.08+i*0.08,0.93,0.1); g.add(knob);
    }
    [-1,1].forEach(s=>{
      const spk = box(0.34,0.7,0.34,'#141024'); spk.position.set(s*1.0,0.35,0); g.add(spk);
      const cone = cyl(0.12,0.12,0.04, PAL.purple,14); cone.rotation.x=Math.PI/2; cone.position.set(s*1.0,0.45,0.18); g.add(cone);
    });
    return g;
  },
  'neon': ()=>{
    const g = group();
    const base = cyl(0.16,0.18,0.15, PAL.black,10); base.position.y=0.08; g.add(base);
    const pole = box(0.08,1.8,0.08, PAL.black); pole.position.y=1.0; g.add(pole);
    const sign = makeSprite('★', '#20e6d0');
    sign.position.set(0,2.0,0); sign.scale.set(0.8,0.8,1); g.add(sign);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32,0.03,8,20), mat(PAL.pink,{emissive:0xff2e88,emissiveIntensity:0.6}));
    ring.position.y=1.95; g.add(ring);
    return g;
  },
  'statue': ()=>{
    const g = group();
    const gold = PAL.casinoGold || '#e8b64a';
    const pedestal = cyl(0.4,0.45,0.5, '#241238',12); pedestal.position.y=0.25; g.add(pedestal);
    const legs = cyl(0.16,0.18,0.5, gold,10); legs.position.y=0.75; g.add(legs);
    const body = cyl(0.2,0.24,0.55, gold,10); body.position.y=1.25; g.add(body);
    const head = sphere(0.17, gold); head.position.y=1.65; g.add(head);
    const armL = box(0.1,0.5,0.1, gold); armL.position.set(-0.28,1.3,0); armL.rotation.z=0.5; g.add(armL);
    const armR = armL.clone(); armR.position.x=0.28; armR.rotation.z=-0.5; g.add(armR);
    return g;
  },
};

/* ============================================================
   PROCEDURAL LOW-POLY MODELS
   All machines, buildings, houses, cars and characters below are built
   entirely from Three.js primitives (no external model files). This keeps
   the game fully self-contained and guarantees nothing ever fails to load —
   which matters here, since the sandboxed artifact environment only allows
   scripts from cdnjs.cloudflare.com, and a real .glb model loader isn't
   available from there.
   ============================================================ */
const MODEL_TEMPLATES = {}; // rempli par preloadModels() avec les GLB Kenney
const CUSTOMER_TEMPLATES = [];
// fichiers Kenney livrés dans public/models (aucun modèle d'aide médicale n'est embarqué)
const GLB_FILES = {
  ARCADE:'mini-arcade/arcade-machine.glb',
  PINBALL:'mini-arcade/pinball.glb',
  CLAW:'mini-arcade/claw-machine.glb',
  VENDING:'mini-arcade/vending-machine.glb',
  TICKET:'mini-arcade/ticket-machine.glb',
  AIRHOCKEY:'mini-arcade/air-hockey.glb',
  BASKET:'mini-arcade/basketball-game.glb',
  DANCE:'mini-arcade/dance-machine.glb',
  GAMBLING:'mini-arcade/gambling-machine.glb',
  WHEEL:'mini-arcade/prize-wheel.glb',
  PRIZES:'mini-arcade/prizes.glb',
  CASHREGISTER:'mini-arcade/cash-register.glb',
  COLUMN:'mini-arcade/column.glb',
  EMPLOYEE:'mini-arcade/character-employee.glb',
  GAMER:'mini-arcade/character-gamer.glb',
};
const CUSTOMER_FILES = ['a','b','c','d','e','f'].flatMap(s=>[
  `mini-characters/character-female-${s}.glb`,
  `mini-characters/character-male-${s}.glb`,
]);
const CITY_FILES = {
  CITY_A:'city/building-a.glb', CITY_B:'city/building-c.glb', CITY_C:'city/building-f.glb',
  CITY_D:'city/building-j.glb', CITY_E:'city/building-m.glb',
  CITY_F:'city/building-b.glb', CITY_G:'city/building-h.glb',
  CITY_SKY_A:'city/building-skyscraper-b.glb', CITY_SKY_B:'city/building-skyscraper-d.glb',
  CITY_SKY_C:'city/building-skyscraper-a.glb', CITY_SKY_D:'city/building-skyscraper-e.glb',

  CAR_SEDAN:'city/sedan.glb', CAR_TAXI:'city/taxi.glb', CAR_VAN:'city/van.glb',
  CAR_SUV:'city/suv.glb', CAR_POLICE_M:'city/police.glb',
  CAR_HATCH:'city/hatchback-sports.glb', CAR_SPORT:'city/sedan-sports.glb',
  CAR_DELIVERY:'city/delivery.glb', CAR_GARBAGE:'city/garbage-truck.glb',
  AWNING:'city/detail-awning.glb', PARASOL:'city/detail-parasol-a.glb', CONE:'city/cone.glb',
  // city-kit-roads 2 — real asphalt tiles, sidewalks and lamps
  ROAD_STRAIGHT:'roads/road-straight.glb', ROAD_CROSS:'roads/road-crossing.glb',
  ROAD_BEND:'roads/road-bend.glb', ROAD_SIDE:'roads/road-side.glb',
  ROAD_INTERSECTION:'roads/road-intersection-line.glb',
  ROAD_TEE:'roads/road-intersection.glb', ROAD_CROSSROAD:'roads/road-crossroad.glb',
  ROAD_END:'roads/road-end.glb',
  STREETLIGHT:'roads/light-curved.glb',
  BARRIER:'roads/construction-barrier.glb', CONE_WORK:'roads/construction-cone.glb',
};
const GLB_KEY_MAP = {
  arcade:'ARCADE', pinball:'PINBALL', claw:'CLAW', vending:'VENDING', ticket:'TICKET',
  airhockey:'AIRHOCKEY', basket:'BASKET', dance:'DANCE', gambling:'GAMBLING', wheel:'WHEEL',
  prizes:'PRIZES', cashregister:'CASHREGISTER',
  // arrière-salle & déco : on réutilise les vrais modèles Kenney plutôt que des
  // formes procédurales, avec une teinte propre à chaque usage
  roulette:'WHEEL', poker:'AIRHOCKEY', blackjack:'AIRHOCKEY', vip:'AIRHOCKEY',
  statue:'COLUMN', neon:'PRIZES',
};
// teinte appliquée au modèle réutilisé pour distinguer les usages
const MODEL_TINT = {
  roulette:'#2fbf6a', poker:'#1f7a4a', blackjack:'#12603a', vip:'#e8b64a',
  statue:'#e8b64a',
};
// per-machine target proportions, tuned by hand to look right instead of a
// one-size-fits-all footprint fit (a pinball table is low & long, a vending
// machine is tall & narrow, a basketball hoop is very tall, etc.)
const MACHINE_FIT = {
  arcade:   {mode:'height', target:1.65},
  pinball:  {mode:'height', target:1.05},
  claw:     {mode:'height', target:1.55},
  vending:  {mode:'height', target:1.75},
  ticket:   {mode:'height', target:1.35},
  airhockey:{mode:'footprint', target:1.85},
  basket:   {mode:'height', target:2.3},
  dance:    {mode:'height', target:1.6},
  gambling: {mode:'height', target:1.45},
  wheel:    {mode:'height', target:1.75},
  prizes:   {mode:'height', target:1.35},
  cashregister:{mode:'height', target:0.75},
  roulette: {mode:'height', target:1.7},
  poker:    {mode:'footprint', target:1.8},
  blackjack:{mode:'footprint', target:1.75},
  vip:      {mode:'footprint', target:1.85},
  statue:   {mode:'height', target:1.9},
  neon:     {mode:'height', target:1.2},
};


function fitFootprint(obj, targetSize){
  let box = new THREE.Box3().setFromObject(obj);
  let size = new THREE.Vector3(); box.getSize(size);
  const footprint = Math.max(size.x, size.z, 0.001);
  const scale = targetSize/footprint;
  obj.scale.setScalar(scale);
  box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3(); box.getCenter(center);
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y;
}
function fitHeight(obj, targetHeight){
  let box = new THREE.Box3().setFromObject(obj);
  let size = new THREE.Vector3(); box.getSize(size);
  const h = Math.max(size.y, 0.001);
  const scale = targetHeight/h;
  obj.scale.setScalar(scale);
  box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3(); box.getCenter(center);
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y;
}
// fits an object using its per-type spec, then clamps the resulting
// footprint so nothing spills into a neighbouring grid cell
function fitSmart(obj, spec){
  if(spec.mode==='footprint') fitFootprint(obj, spec.target);
  else fitHeight(obj, spec.target);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const footprint = Math.max(size.x, size.z);
  const maxAllowed = 2*0.92; // CELL*0.92, CELL is defined further below but is always 2
  if(footprint > maxAllowed){
    const extraScale = maxAllowed/footprint;
    obj.scale.multiplyScalar(extraScale);
    const box2 = new THREE.Box3().setFromObject(obj);
    const c2 = new THREE.Vector3(); box2.getCenter(c2);
    obj.position.x -= c2.x; obj.position.z -= c2.z; obj.position.y -= box2.min.y;
  }
}

const missingModels = [];   // clés dont le GLB n'a pas pu être chargé
function preloadModels(onDone){
  const loadText = document.getElementById('loadText');
  if(lightRender){
    // rendu léger : on saute complètement les GLB, tout sera en placeholders
    if(loadText) loadText.innerText = 'Mode léger — placeholders…';
    onDone();
    return;
  }
  const loader = new GLTFLoader();
  const entries = [
    ...Object.entries(GLB_FILES),
    ...Object.entries(CITY_FILES),
    ...CUSTOMER_FILES.map((f,i)=>['__CUST'+i, f]),
  ];
  let done = 0;
  let started = false;
  const total = entries.length;
  const go = ()=>{ if(started) return; started = true; onDone(); };
  // filet de sécurité : si un modèle ne répond pas, on démarre quand même
  const safety = window.setTimeout(go, 9000);
  const finish = ()=>{
    done++;
    if(loadText) loadText.innerText = `On rallume les néons… ${Math.round(done/total*100)}%`;
    if(done>=total){ window.clearTimeout(safety); go(); }
  };
  entries.forEach(([key, file])=>{
    loader.load('/models/'+file, (gltf)=>{
      const root = gltf.scene;
      root.traverse(o=>{
        if(o.isMesh){
          o.castShadow = true; o.receiveShadow = true;
          // les matériaux Kenney sont un peu sombres dans notre ambiance néon
          if(o.material && o.material.color) o.material = o.material.clone();
        }
      });
      if(key.startsWith('__CUST')) CUSTOMER_TEMPLATES.push(root);
      else MODEL_TEMPLATES[key] = root;
      finish();
    }, undefined, ()=>{ if(!key.startsWith('__CUST')) missingModels.push(key); finish(); });
  });
  if(total===0){ window.clearTimeout(safety); go(); }
}



/* --- objets débloqués par l'histoire --- */
Object.assign(BUILDERS, {
  'jukebox': ()=>{
    const g = group();
    const body = box(0.9,1.3,0.6, PAL.purple); body.position.y=0.65; g.add(body);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.55,16,1,false,0,Math.PI),
      new THREE.MeshStandardMaterial({color:0xff2e88, emissive:0xff2e88, emissiveIntensity:0.7}));
    dome.rotation.z = Math.PI/2; dome.rotation.y = Math.PI/2; dome.position.y=1.3; g.add(dome);
    const glass = box(0.6,0.4,0.05, PAL.black); glass.position.set(0,0.95,0.32); g.add(glass);
    const base = box(0.95,0.12,0.65, PAL.purpleDark); base.position.y=0.06; g.add(base);
    return g;
  },
  'safe': ()=>{
    const g = group();
    const body = box(0.75,0.8,0.7, PAL.chrome); body.position.y=0.4; g.add(body);
    const door = box(0.62,0.62,0.06, '#2b2b3a'); door.position.set(0,0.42,0.36); g.add(door);
    const dial = cyl(0.12,0.12,0.08, PAL.yellow,12); dial.rotation.x=Math.PI/2; dial.position.set(0,0.42,0.42); g.add(dial);
    return g;
  },
  'falsewall': ()=>{
    const g = group();
    const panel = box(1.5,2.0,0.18, PAL.purpleDark); panel.position.y=1.0; g.add(panel);
    const seam = box(0.05,1.9,0.2, PAL.pink); seam.position.set(0.3,1.0,0.01); g.add(seam);
    const led = cyl(0.06,0.06,0.06, PAL.teal,10); led.rotation.x=Math.PI/2; led.position.set(-0.5,1.7,0.12); g.add(led);
    return g;
  },
  'bar': ()=>{
    const g = group();
    const counter = box(1.9,1.0,0.6,'#3b2350'); counter.position.y=0.5; g.add(counter);
    const top = box(2.0,0.09,0.7,'#e8b64a',{metalness:0.5,roughness:0.3}); top.position.y=1.03; g.add(top);
    const rail = box(2.0,0.06,0.08,'#ff2e88',{emissive:0xff2e88,emissiveIntensity:1.1}); rail.position.set(0,0.72,0.33); g.add(rail);
    for(let i=0;i<5;i++){ const b=cyl(0.05,0.05,0.28,i%2?'#2fd4c8':'#ffd23f',8); b.position.set(-0.7+i*0.35,1.2,-0.15); g.add(b); }
    const shelf = box(1.6,0.06,0.25,'#2a1c3a'); shelf.position.set(0,1.45,-0.28); g.add(shelf);
    return g;
  },
  'sofa': ()=>{
    const g = group();
    const seat = box(1.5,0.35,0.7,'#8f1f2e'); seat.position.y=0.3; g.add(seat);
    const back = box(1.5,0.55,0.18,'#8f1f2e'); back.position.set(0,0.65,-0.28); g.add(back);
    [-0.72,0.72].forEach(x=>{ const a=box(0.16,0.5,0.7,'#6e1724'); a.position.set(x,0.45,0); g.add(a); });
    const table = box(0.7,0.06,0.5,'#e8b64a'); table.position.set(0,0.42,0.75); g.add(table);
    return g;
  },
  'dancefloor': ()=>{
    const g = group();
    const cab = box(0.5,0.5,0.4,'#1b1030'); cab.position.y=0.25; g.add(cab);
    const face = box(0.42,0.12,0.03,'#20e6d0',{emissive:0x20e6d0,emissiveIntensity:1.2}); face.position.set(0,0.34,0.21); g.add(face);
    const knob = cyl(0.05,0.05,0.04,'#ff2e88',12); knob.rotation.x=Math.PI/2; knob.position.set(0,0.16,0.21); g.add(knob);
    return g;
  },
  'discoball': ()=>{

    const g = group();
    const pole = cyl(0.03,0.03,0.9,'#3a3a44'); pole.position.y=2.05; g.add(pole);
    const ball = sphere(0.32,'#cfd6e6',{metalness:0.9,roughness:0.15,emissive:0x8899bb,emissiveIntensity:0.5});
    ball.position.y=1.45; g.add(ball);
    const halo = makeGlowSprite('#9ffff5', 1.6); halo.position.y=1.45; g.add(halo);
    g.userData.spin = ball;
    return g;
  },
  'speaker': ()=>{
    const g = group();
    const stack = box(0.6,1.6,0.55,'#141024'); stack.position.y=0.8; g.add(stack);
    [0.45,1.05,1.45].forEach((y,i)=>{ const c=cyl(i?0.16:0.22,i?0.16:0.22,0.06,'#2a2340',14); c.rotation.x=Math.PI/2; c.position.set(0,y,0.29); g.add(c); });
    const led = box(0.5,0.05,0.03,'#2fd4c8',{emissive:0x2fd4c8,emissiveIntensity:1.3}); led.position.set(0,1.66,0.28); g.add(led);
    return g;
  },
  'wallart': ()=>{
    const g = group();
    const panel = box(1.2,1.5,0.08,'#150a1e'); panel.position.y=1.3; g.add(panel);
    const art = box(1.0,1.3,0.05,'#8b5cf6',{emissive:0x8b5cf6,emissiveIntensity:0.7}); art.position.set(0,1.3,0.06); g.add(art);
    const tube = box(1.1,0.07,0.07,'#ff2e88',{emissive:0xff2e88,emissiveIntensity:1.4}); tube.position.set(0,2.1,0.06); g.add(tube);
    return g;
  },
  'vip': ()=>{
    const g = group();
    const table = cyl(0.85,0.85,0.16, '#1f5b3a', 20); table.position.y=0.78; g.add(table);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86,0.06,10,26),
      new THREE.MeshStandardMaterial({color:0xe8b64a, emissive:0xe8b64a, emissiveIntensity:0.45, metalness:0.6, roughness:0.3}));
    rim.rotation.x = Math.PI/2; rim.position.y=0.86; g.add(rim);
    const foot = cyl(0.18,0.3,0.75, '#3a2a1a', 12); foot.position.y=0.37; g.add(foot);
    for(let i=0;i<4;i++){
      const a = i*Math.PI/2 + 0.4;
      const chair = box(0.35,0.5,0.35, '#5b1f2e');
      chair.position.set(Math.cos(a)*1.25, 0.25, Math.sin(a)*1.25); g.add(chair);
    }
    return g;
  },
  /* ---------- transformation club : piste modulaire, lounge, lumières ---------- */
  'floortile': ()=>{
    const g = group();
    const mat = new THREE.MeshStandardMaterial({
      color:0x120a20, emissive:new THREE.Color(0xff2e88), emissiveIntensity:0.4,
      roughness:0.32, metalness:0.35
    });
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 1.42), mat);
    tile.position.y = 0.035; tile.receiveShadow = true; g.add(tile);
    const edge = box(1.5,0.03,1.5,'#20e6d0',{emissive:0x20e6d0, emissiveIntensity:0.9});
    edge.position.y = 0.012; g.add(edge);
    g.userData.floorTile = tile;
    g.userData.tilePhase = Math.random()*6.3;
    return g;
  },
  'banquette': ()=>{
    const g = group();
    const seat = box(1.7,0.34,0.78,'#3b1c46'); seat.position.y=0.32; g.add(seat);
    const back = box(1.7,0.7,0.16,'#4a2357'); back.position.set(0,0.72,-0.31); g.add(back);
    for(let i=0;i<3;i++){
      const cush = box(0.5,0.12,0.62,'#5d2c6b'); cush.position.set(-0.55+i*0.55,0.52,0.02); g.add(cush);
    }
    [-0.83,0.83].forEach(x=>{ const a=box(0.14,0.55,0.78,'#301539'); a.position.set(x,0.45,0); g.add(a); });
    const trim = box(1.72,0.05,0.06,'#e8b64a',{emissive:0xe8b64a, emissiveIntensity:0.5});
    trim.position.set(0,1.06,-0.31); g.add(trim);
    return g;
  },
  'lowtable': ()=>{
    const g = group();
    const top = cyl(0.42,0.42,0.06,'#1e1430',20); top.position.y=0.46; g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42,0.03,8,24),
      new THREE.MeshStandardMaterial({color:0xe8b64a, emissive:0xe8b64a, emissiveIntensity:0.5, metalness:0.6, roughness:0.35}));
    ring.rotation.x = Math.PI/2; ring.position.y=0.49; g.add(ring);
    const foot = cyl(0.09,0.2,0.44,'#2a2038',12); foot.position.y=0.22; g.add(foot);
    const candle = cyl(0.05,0.05,0.12,'#ffd9a0',10); candle.position.y=0.55; g.add(candle);
    const flame = sphere(0.05,'#ffb14f',{emissive:0xffb14f, emissiveIntensity:1.6}); flame.position.y=0.64; g.add(flame);
    return g;
  },
  'loungelamp': ()=>{
    const g = group();
    const base = cyl(0.2,0.24,0.06,'#241a33',14); base.position.y=0.03; g.add(base);
    const pole = cyl(0.035,0.035,1.35,'#3a3a48',10); pole.position.y=0.7; g.add(pole);
    const shade = cyl(0.3,0.18,0.34,'#ffcf9a',14);
    shade.position.y=1.5; g.add(shade);
    if(shade.material){ shade.material.emissive = new THREE.Color(0xffb877); shade.material.emissiveIntensity = 0.9; }
    const warm = new THREE.PointLight(0xffb877, isMobile?0.8:1.2, 5.5, 2);
    warm.position.y = 1.45; g.add(warm);
    const halo = makeGlowSprite('#ffcf9a', 0.9); halo.position.y=1.5; g.add(halo);
    return g;
  },
  'movinglight': ()=>{
    const g = group();
    const foot = cyl(0.22,0.26,0.08,'#1b1626',12); foot.position.y=0.04; g.add(foot);
    const mast = cyl(0.05,0.05,1.9,'#33303f',10); mast.position.y=0.95; g.add(mast);
    const head = group(); head.position.y = 1.9; g.add(head);
    const body = box(0.3,0.26,0.36,'#191428'); head.add(body);
    const lens = cyl(0.13,0.13,0.05,'#20e6d0',12,{emissive:0x20e6d0, emissiveIntensity:1.6});
    lens.rotation.x = Math.PI/2; lens.position.z = 0.2; head.add(lens);
    // faisceau conique : version émissive légère (aucune lumière réelle sur mobile)
    const beamMat = new THREE.MeshBasicMaterial({color:0x20e6d0, transparent:true, opacity:isMobile?0.16:0.22,
      depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending});
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, isMobile?10:16, 1, true), beamMat);
    beam.rotation.x = -Math.PI/2; beam.position.z = 1.6; head.add(beam);
    g.userData.sweepHead = head;
    g.userData.sweepLens = lens;
    g.userData.sweepBeam = beam;
    g.userData.sweepPhase = Math.random()*6.3;
    if(!isMobile){
      const sp = new THREE.PointLight(0x20e6d0, 1.1, 7, 2);
      sp.position.set(0,-0.1,1.4); head.add(sp);
      g.userData.sweepLight = sp;
    }
    return g;
  },
  'veloperope': ()=>{
    const g = group();
    [-0.6,0.6].forEach(x=>{
      const post = cyl(0.07,0.09,0.9,'#e8b64a',12,{metalness:0.7, roughness:0.3});
      post.position.set(x,0.45,0); g.add(post);
      const cap = sphere(0.09,'#ffd23f',{metalness:0.7, roughness:0.25}); cap.position.set(x,0.93,0); g.add(cap);
      const base = cyl(0.18,0.2,0.05,'#2a2038',12); base.position.set(x,0.03,0); g.add(base);
    });
    for(let i=0;i<7;i++){
      const t = i/6;
      const link = sphere(0.055,'#8f1f2e');
      link.position.set(-0.6 + t*1.2, 0.8 - Math.sin(t*Math.PI)*0.16, 0);
      g.add(link);
    }
    return g;
  },
});


/* ---------- écrans allumés ----------
   les modèles Kenney ont une dalle d'écran noire : sans lumière frontale elle
   reste éteinte. On colle un panneau émissif juste devant la face avant pour
   que chaque jeu ait un écran visible, de jour comme de nuit. */
const screenMats = [];
const SCREEN_COLORS = {
  arcade:'#38e0ff', pinball:'#ff5fa8', claw:'#ffd23f', vending:'#7dff9a',
  ticket:'#ffb14f', airhockey:'#38e0ff', basket:'#ff7a3f', dance:'#c46bff',
  gambling:'#ffd23f', wheel:'#ff4f8b', prizes:'#7ef1ff', cashregister:'#9dffcf',
  roulette:'#4fe07a', poker:'#4fe07a', blackjack:'#4fe07a', vip:'#ffd23f',
};
// machines sans écran frontal : pas de panneau
const NO_SCREEN = new Set(['statue','neon','prizes','basket','airhockey','poker','blackjack','vip']);
function addScreenGlow(wrapper, clone, defId){
  // panneaux émissifs retirés : ils flottaient devant les bornes et rendaient mal
  return;
  // eslint-disable-next-line no-unreachable
  if(NO_SCREEN.has(defId)) return;

  const bb = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3(); bb.getSize(size);
  const center = new THREE.Vector3(); bb.getCenter(center);
  if(size.y < 0.5) return;
  const col = SCREEN_COLORS[defId] || '#38e0ff';
  const w = Math.max(0.25, size.x * 0.58);
  const h = Math.max(0.2, Math.min(size.y * 0.34, w * 0.85));
  const scr = box(w, h, 0.03, col, {emissive:new THREE.Color(col).getHex(), emissiveIntensity:1.5, roughness:0.35});
  scr.position.set(center.x, bb.min.y + size.y * 0.68, bb.max.z + 0.02);
  scr.castShadow = false;
  wrapper.add(scr);
  // liseré du fronton pour que la borne ressorte dans le noir
  const marq = box(w * 1.05, 0.07, 0.03, col, {emissive:new THREE.Color(col).getHex(), emissiveIntensity:1.8});
  marq.position.set(center.x, bb.min.y + size.y * 0.93, bb.max.z + 0.02);
  wrapper.add(marq);
  scr.userData.flick = Math.random() * Math.PI * 2;
  screenMats.push(scr);
}

function buildMachineMesh(defId){
  const glbKey = GLB_KEY_MAP[defId];
  if(glbKey && MODEL_TEMPLATES[glbKey]){
    const wrapper = group();
    const clone = MODEL_TEMPLATES[glbKey].clone(true);
    clone.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    wrapper.add(clone);
    const spec = MACHINE_FIT[defId] || {mode:'footprint', target:1.5};
    fitSmart(clone, spec);
    // tiny per-instance scale variance so a row of the same machine doesn't look copy-pasted
    const variance = 0.94 + Math.random()*0.12;
    clone.scale.multiplyScalar(variance);
    if(MODEL_TINT[defId]){
      clone.traverse(o=>{
        if(o.isMesh && o.material && o.material.color){
          o.material = o.material.clone();
          o.material.color.lerp(new THREE.Color(MODEL_TINT[defId]), 0.65);
        }
      });
    }
    addScreenGlow(wrapper, clone, defId);
    return wrapper;

  }
  const fn = BUILDERS[defId] || BUILDERS['arcade'];
  return fn();
}

/* ---------- personnalisation des machines : teinte, tarif, arnaque ---------- */
const MACHINE_TINTS = [
  {id:'none',   label:'Origine', hex:null},
  {id:'teal',   label:'Turquoise', hex:'#20e6d0'},
  {id:'pink',   label:'Rose',      hex:'#ff4fa3'},
  {id:'purple', label:'Violet',    hex:'#9b5cff'},
  {id:'gold',   label:'Or',        hex:'#ffd23f'},
  {id:'red',    label:'Rouge',     hex:'#ff4f4f'},
  {id:'blue',   label:'Bleu',      hex:'#4f9bff'},
  {id:'green',  label:'Vert',      hex:'#4fe07a'},
  {id:'black',  label:'Noir',      hex:'#2a2038'},
];
/* applique (ou retire) une teinte sur toutes les surfaces d'une machine */
function applyMachineTint(mesh, hex){
  if(!mesh) return;
  mesh.traverse(o=>{
    if(!o.isMesh || !o.material || !o.material.color) return;
    if(!o.userData.__baseCol){
      o.material = o.material.clone();
      o.userData.__baseCol = o.material.color.clone();
    }
    o.material.color.copy(o.userData.__baseCol);
    if(hex) o.material.color.lerp(new THREE.Color(hex), 0.7);
  });
}
/* multiplicateur de gain / d'attractivité selon le tarif choisi */
function machinePriceMult(m){ const v = m && m.priceMult; return (typeof v === 'number' && isFinite(v)) ? Math.min(2.5, Math.max(0.5, v)) : 1; }
/* un tarif élevé fait fuir les clients, un tarif bas les attire */
function machineAppeal(m){
  const mult = machinePriceMult(m);
  return Math.max(0.12, 1.6 - mult); // 0.5 → 1.1 ; 1 → 0.6 ; 2.5 → 0.12
}
function riggedCount(){ return state.machines.filter(m=>m.rigged).length; }

/* ---------- character (procédural : plus de modèles importés) ---------- */
function buildCharacter(shirtColor){

  const g = group();
  // hanches : deux jambes articulées + deux bras, pour la marche et la danse
  const hips = group(); hips.position.y = 0.52; g.add(hips);
  const mkLimb = (x, color, len, thick)=>{
    const pivot = group(); pivot.position.set(x, 0, 0);
    const limb = cyl(thick, thick*0.9, len, color, 8);
    limb.position.y = -len/2; pivot.add(limb);
    const foot = box(thick*2.1, 0.07, thick*3.0, '#1b1b26');
    foot.position.set(0, -len-0.03, 0.04); pivot.add(foot);
    return pivot;
  };
  const legL = mkLimb(-0.1, PAL.black, 0.5, 0.085); hips.add(legL);
  const legR = mkLimb( 0.1, PAL.black, 0.5, 0.085); hips.add(legR);
  const body = cyl(0.2,0.24,0.55, shirtColor,10); body.position.y=0.8; g.add(body);
  const shoulders = group(); shoulders.position.y = 1.0; g.add(shoulders);
  const mkArm = (x)=>{
    const pivot = group(); pivot.position.set(x,0,0);
    const arm = cyl(0.055,0.05,0.42, shirtColor, 8); arm.position.y=-0.21; pivot.add(arm);
    const hand = sphere(0.06,'#f2c9a0'); hand.position.y=-0.44; pivot.add(hand);
    return pivot;
  };
  const armL = mkArm(-0.24); shoulders.add(armL);
  const armR = mkArm( 0.24); shoulders.add(armR);
  const head = sphere(0.17, '#f2c9a0'); head.position.y=1.2; g.add(head);
  const hair = sphere(0.18, '#3b2a20'); hair.position.y=1.27; hair.scale.set(1,0.7,1); g.add(hair);
  g.userData.bodyMesh = body;
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

/* oriente un personnage vers un point (le modèle regarde +Z) */
function faceTowards(mesh, x, z){
  if(!mesh) return;
  // yaw calculé dans le repère du parent : pas de bascule X/Z parasite,
  // et le résultat reste valable quel que soit le groupe qui porte le PNJ
  const dx = x - mesh.position.x, dz = z - mesh.position.z;
  if(dx*dx + dz*dz < 1e-8) return;
  mesh.rotation.set(0, Math.atan2(dx, dz), 0);
}

/* pose neutre de marche : membres remis à plat dans le repère local */
function resetLimbPose(mesh){
  const u = mesh && mesh.userData;
  if(!u || !u.legL) return;
  [u.armL, u.armR, u.legL, u.legR].forEach(p=>{ if(p) p.rotation.set(0,0,0); });
}

/* pose de jeu : les deux bras devant le torse, légèrement pliés vers le panneau.
   Tout est exprimé en local (rotation X du pivot d'épaule), donc la pose suit
   automatiquement l'orientation du personnage vers la machine. */
function playPose(mesh, t){
  const u = mesh && mesh.userData;
  if(!u || !u.armL) return;
  if(u.legL){ u.legL.rotation.set(0,0,0); u.legR.rotation.set(0,0,0); }
  u.armL.rotation.set(-1.15 + Math.sin(t/110)*0.18, 0, 0.16);
  u.armR.rotation.set(-1.15 + Math.sin(t/110 + 1.6)*0.18, 0, -0.16);
}


/* un joueur actif reste visible grâce à son bon placement, sans traverser la borne */
function setPlayingCharacterVisible(mesh, playing){
  if(!mesh) return;
  mesh.visible = true;
  mesh.renderOrder = 0;
  mesh.scale.setScalar(1);
  mesh.rotation.x = 0;
  mesh.rotation.z = 0;
  mesh.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(mat=>{
      mat.depthTest = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    });
    o.renderOrder = 0;
  });
}

/* pas de marche : balancement jambes/bras (amount = amplitude, 0 = repos) */
function stepCharacter(mesh, t, amount = 1){
  const u = mesh && mesh.userData;
  if(!u || !u.legL) return;
  const s = Math.sin(t)*amount;
  u.legL.rotation.x =  s*0.85;
  u.legR.rotation.x = -s*0.85;
  if(u.armL){ u.armL.rotation.x = -s*0.6; u.armR.rotation.x = s*0.6; }
}

/* retrouve le corps articulé à l'intérieur d'un wrap posé dans la rue */
function charBody(wrap){
  if(!wrap) return null;
  if(wrap.userData && wrap.userData.legL) return wrap;
  let found = null;
  wrap.traverse(o=>{ if(!found && o.userData && o.userData.legL) found = o; });
  return found;
}

/* pas de danse sur la piste : genoux qui rebondissent + bras en l'air */
function danceCharacter(mesh, t, style){
  const u = mesh && mesh.userData;
  if(!u || !u.legL) return;
  const s = Math.sin(t);
  if(style==='jump'){
    u.legL.rotation.x = -Math.abs(s)*0.5; u.legR.rotation.x = -Math.abs(s)*0.5;
    if(u.armL){ u.armL.rotation.x = -2.2 - s*0.3; u.armR.rotation.x = -2.2 + s*0.3; }
  } else if(style==='spin'){
    u.legL.rotation.x = s*0.5; u.legR.rotation.x = -s*0.5;
    if(u.armL){ u.armL.rotation.z = 1.1; u.armR.rotation.z = -1.1; }
  } else if(style==='dj'){
    if(u.armL){ u.armL.rotation.x = -1.1 + s*0.35; u.armR.rotation.x = -1.1 - s*0.35; }
  } else {
    u.legL.rotation.x = s*0.65; u.legR.rotation.x = -s*0.65;
    if(u.armL){ u.armL.rotation.x = -0.5 + s*0.5; u.armR.rotation.x = -0.5 - s*0.5; }
  }
}


/* ============================================================
   STYLE PERSONNALISÉ — murs, détails, sol (sauvegardé)
   ============================================================ */
/* ---------- identité de la boîte : nom + enseigne (achetables) ---------- */
const BRAND_KEY = 'cc_brand_v1';
const SIGN_STYLES = [
  {id:'neonpink', label:'Néon rose',   color:'#ff2e88', price:0},
  {id:'ice',      label:'Bleu glace',  color:'#00f3ff', price:70},
  {id:'gold',     label:'Or casino',   color:'#ffd23f', price:110},
  {id:'emerald',  label:'Vert émeraude', color:'#2fd4c8', price:90},
  {id:'violet',   label:'Violet UV',   color:'#8b5cf6', price:120},
];
const RENAME_COST = 30;
const BRAND_DEFAULT = {name:'COSMIC COIN', sign:'neonpink', owned:['neonpink'], named:false};
let clubBrand = {...BRAND_DEFAULT};
try{
  const raw = localStorage.getItem(BRAND_KEY);
  if(raw){
    const b = JSON.parse(raw);
    clubBrand = {...BRAND_DEFAULT, ...b};
    clubBrand.owned = Array.isArray(clubBrand.owned) ? clubBrand.owned : ['neonpink'];
    if(!clubBrand.owned.includes('neonpink')) clubBrand.owned.push('neonpink');
  }
}catch(e){}
Object.defineProperty(clubBrand, 'color', {
  get(){ return (SIGN_STYLES.find(s=>s.id===clubBrand.sign) || SIGN_STYLES[0]).color; },
});
// le tout premier baptême de la boîte est gratuit (sinon on est bloqué en début de partie)
function renameCost(){ return clubBrand.named ? RENAME_COST : 0; }
function writeBrand(){ try{ localStorage.setItem(BRAND_KEY, JSON.stringify({name:clubBrand.name, sign:clubBrand.sign, owned:clubBrand.owned, named:!!clubBrand.named})); }catch(e){} }


/* ---------- décorations achetables (rien n'est offert au départ) ---------- */
const COSMETICS = [
  {id:'posters',    label:'🖼️ Affiches murales',   price:35,  zone:'in'},
  {id:'columns',    label:'🏛️ Colonnes d\u2019angle', price:60, zone:'in'},
  {id:'innerneon',  label:'💡 Barre néon intérieure', price:55, zone:'in'},
  {id:'partition',  label:'🧱 Cloison arrière-salle', price:60, zone:'in'},
  {id:'facadesign', label:'🪧 Enseigne du nom',    price:120, zone:'out'},
  {id:'roofneon',   label:'📛 Néon de toit',       price:90,  zone:'out'},
  {id:'entryneons', label:'🈺 Enseignes d\u2019entrée', price:75, zone:'out'},
  {id:'marquee',    label:'✨ Marquise & auvent',  price:65,  zone:'out'},
  {id:'showcase',   label:'🪟 Vitrines éclairées', price:80,  zone:'out'},
  {id:'floodlights',label:'🔦 Projecteurs de façade', price:70, zone:'out'},
];
function hasCos(id){ return !!(state && Array.isArray(state.cosmetics) && state.cosmetics.includes(id)); }



const STYLE_KEY = 'cc_style_v1';
const STYLE_DEFAULT = {wall:'#2b2438', trim:'#f4a13c', trim2:'#6b4e9e', floor:'#ffffff', detail:'stripes'};
const WALL_DETAILS = [
  {id:'stripes', label:'Bandes néon'},
  {id:'bricks',  label:'Briques'},
  {id:'panels',  label:'Panneaux'},
  {id:'plain',   label:'Mur nu'},
  {id:'model',   label:'Mur d\'origine'},
];
/* coûts de personnalisation : on dépense les jetons gagnés pour décorer */
const PAINT_COST = 25;
const DETAIL_COST = {stripes:0, bricks:90, panels:140, plain:0, model:60};
let roomStyle = {...STYLE_DEFAULT, owned:['stripes','plain']};
/* petit portefeuille commun à toutes les personnalisations */
function payFor(cost, label){
  if(!cost || cost<=0) return true;
  if(state.money < cost){ log(`Pas assez de jetons : ${label} coûte ${cost}¢ (tu as ${Math.round(state.money)}¢).`); return false; }
  spendMoney(cost, 'buy');
  if(typeof updateHUD === 'function') updateHUD();
  return true;
}

function readStyle(){
  try{
    const raw = localStorage.getItem(STYLE_KEY);
    if(raw){
      const s = {...STYLE_DEFAULT, ...JSON.parse(raw)};
      s.owned = Array.isArray(s.owned) ? s.owned : ['stripes','plain'];
      if(!s.owned.includes('stripes')) s.owned.push('stripes');
      if(!s.owned.includes('plain')) s.owned.push('plain');
      return s;
    }
  }catch(e){}
  return {...STYLE_DEFAULT, owned:['stripes','plain']};
}

function writeStyle(){
  try{ localStorage.setItem(STYLE_KEY, JSON.stringify(roomStyle)); }catch(e){}
}
roomStyle = readStyle();

/* ============================================================
   ROOM / STAGE CONSTRUCTION
   ============================================================ */
const CELL = 2;
const BASE_COLS = 4, BASE_ROWS = 4;   // local de départ : on construit tout soi-même
const STAGES = [
  {name:"SALLE D'ARCADE", cols:4, rows:4, unlockRep:0, cost:0, theme:'arcade'},
  {name:"GRANDE SALLE D'ARCADE", cols:9, rows:7, unlockRep:9, cost:500, theme:'arcade'},
  {name:"COSMIC CASINO", cols:12, rows:9, unlockRep:20, cost:1300, theme:'casino'},
];

const roomGroup = group(); scene.add(roomGroup);
const machinesGroup = group(); scene.add(machinesGroup);
const customersGroup = group(); scene.add(customersGroup);

function cellToWorld(x,z,cols,rows){
  return new THREE.Vector3((x-cols/2+0.5)*CELL, 0, (z-rows/2+0.5)*CELL);
}

function tintObject(obj, tintHex){
  obj.traverse(o=>{
    if(o.isMesh && o.material){
      o.material = o.material.clone();
      o.material.color.multiply(new THREE.Color(tintHex));
    }
  });
}

function makeCarpetTexture(casino){
  const size = 256;
  const cvs = document.createElement('canvas'); cvs.width=size; cvs.height=size;
  const c = cvs.getContext('2d');
  const base1 = casino ? '#6b2038' : '#463069';
  const base2 = casino ? '#83294a' : '#573c82';
  const accent = casino ? '#f0cd7c' : '#b39ae8';
  c.fillStyle = base1; c.fillRect(0,0,size,size);
  c.fillStyle = base2;
  const step = size/4;
  for(let y=-step; y<size+step; y+=step){
    for(let x=-step; x<size+step; x+=step){
      c.save();
      c.translate(x+step/2, y+step/2);
      c.rotate(Math.PI/4);
      c.fillRect(-step*0.32, -step*0.32, step*0.64, step*0.64);
      c.restore();
    }
  }
  c.strokeStyle = accent; c.globalAlpha = 0.4; c.lineWidth = 2;
  for(let i=0;i<=4;i++){
    c.beginPath(); c.moveTo(i*step,0); c.lineTo(i*step,size); c.stroke();
    c.beginPath(); c.moveTo(0,i*step); c.lineTo(size,i*step); c.stroke();
  }
  c.globalAlpha = 0.18;
  c.fillStyle = accent;
  for(let y=0;y<4;y++) for(let x=0;x<4;x++){
    c.beginPath(); c.arc(x*step+step/2, y*step+step/2, step*0.1, 0, Math.PI*2); c.fill();
  }
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePosterTexture(kind, casino){
  const w=140, h=190;
  const cvs = document.createElement('canvas'); cvs.width=w; cvs.height=h;
  const c = cvs.getContext('2d');
  c.fillStyle = '#160b22'; c.fillRect(0,0,w,h);
  c.fillStyle = casino ? '#3a1220' : '#2c1548';
  c.fillRect(7,7,w-14,h-14);
  const accent = casino ? '#ffd23f' : '#ff2e88';
  const accent2 = casino ? '#e0483f' : '#20e6d0';
  if(kind==='logo'){
    c.fillStyle = accent;
    c.font = 'bold 22px monospace'; c.textAlign='center';
    c.fillText('COSMIC', w/2, h/2-8);
    c.fillStyle = accent2;
    c.fillText(casino?'CASINO':'COIN', w/2, h/2+20);
    c.strokeStyle = accent; c.lineWidth=2;
    c.strokeRect(20, h/2-40, w-40, 76);
  } else if(kind==='score'){
    c.strokeStyle = accent2; c.lineWidth=3;
    c.beginPath();
    for(let i=0;i<8;i++){
      const ang = i/8*Math.PI*2, r = i%2===0 ? w*0.36 : w*0.16;
      const px = w/2+Math.cos(ang)*r, py = h/2-10+Math.sin(ang)*r*1.15;
      i===0 ? c.moveTo(px,py) : c.lineTo(px,py);
    }
    c.closePath(); c.stroke();
    c.fillStyle = '#fff'; c.font='bold 13px monospace'; c.textAlign='center';
    c.fillText(casino?'JACKPOT':'HI-SCORE', w/2, h/2-4);
  } else {
    c.fillStyle = accent2;
    c.beginPath(); c.arc(w/2, h/2-24, 26, 0, Math.PI*2); c.fill();
    c.fillStyle = '#160b22'; c.font='bold 30px monospace'; c.textAlign='center';
    c.fillText(casino?'♠':'●', w/2, h/2-15);
    c.fillStyle = '#fff'; c.font='bold 12px monospace';
    c.fillText(casino?'VIP LOUNGE':'PLAYER 1', w/2, h/2+40);
  }
  const tex = new THREE.CanvasTexture(cvs);
  return tex;
}

function buildDoorway(casino, height){
  const g = group();
  const frameCol = '#1a1024';
  const glassCol = casino ? '#3a2018' : '#152436';
  const trimCol = casino ? PAL.casinoGold : PAL.teal;
  const jambL = box(0.08, height, 0.12, frameCol); jambL.position.set(-0.42, height/2, 0); g.add(jambL);
  const jambR = box(0.08, height, 0.12, frameCol); jambR.position.set(0.42, height/2, 0); g.add(jambR);
  const lintel = box(0.92, 0.1, 0.14, frameCol); lintel.position.set(0, height-0.05, 0); g.add(lintel);
  const threshold = box(0.92, 0.05, 0.16, '#2a2038'); threshold.position.set(0, 0.025, 0); g.add(threshold);
  const panelL = box(0.34, height-0.25, 0.04, glassCol, {transparent:true, opacity:0.6, roughness:0.15, metalness:0.35});
  panelL.position.set(-0.2, (height-0.25)/2+0.05, 0); g.add(panelL);
  const panelR = box(0.34, height-0.25, 0.04, glassCol, {transparent:true, opacity:0.6, roughness:0.15, metalness:0.35});
  panelR.position.set(0.2, (height-0.25)/2+0.05, 0); g.add(panelR);
  const handleL = cyl(0.014,0.014,0.32,'#d8d8e0',8); handleL.position.set(-0.06, height*0.42, 0.05); g.add(handleL);
  const handleR = cyl(0.014,0.014,0.32,'#d8d8e0',8); handleR.position.set(0.06, height*0.42, 0.05); g.add(handleR);
  const canopy = box(1.15, 0.08, 0.4, trimCol); canopy.position.set(0, height+0.08, 0.16); g.add(canopy);
  const canopyGlow = new THREE.PointLight(casino?0xffd23f:0x20e6d0, 0.5, 3, 2);
  canopyGlow.position.set(0, height+0.02, 0.2); g.add(canopyGlow);
  return g;
}

/* ---------- zones : arcade / piste de danse / arrière-salle ---------- */
let danceTiles = [];
let dancers = [];
let zoneLights = [];
let discoBall = null;
function zoneSplit(cols, rows){
  return { splitX: Math.max(2, Math.round(cols*0.58)), splitZ: Math.max(2, Math.round(rows*0.5)) };
}
function zoneAt(x, z){
  if(!state || !state.dims) return 'arcade';
  const {cols, rows} = state.dims;
  const {splitX, splitZ} = zoneSplit(cols, rows);
  if(x < splitX) return 'arcade';
  return z < splitZ ? 'dance' : 'back';
}
const ZONE_LABEL = {arcade:"zone arcade", dance:"piste de danse", back:"arrière-salle"};
function zoneAllows(def, zone){
  if(def.decor) return true;
  if(def.illegal) return zone === 'back';
  if(def.id === 'dance') return zone === 'dance';
  return zone !== 'back';
}

function roomSize(stageIdx){
  // la taille ne dépend plus de l'étape : c'est le joueur qui pousse ses murs
  const ex = (typeof state !== 'undefined' && state) ? state : null;
  return {
    cols: Math.max(4, Math.min(20, BASE_COLS + (ex?.extraCols || 0))),
    rows: Math.max(4, Math.min(18, BASE_ROWS + (ex?.extraRows || 0))),
  };
}
function buildRoom(stageIdx){
  while(roomGroup.children.length) roomGroup.remove(roomGroup.children[0]);
  const st = STAGES[stageIdx];
  const {cols, rows} = roomSize(stageIdx);

  const casino = st.theme==='casino';
  const floorA = casino ? '#4a1830' : PAL.floorA;
  const floorB = casino ? '#3a1226' : PAL.floorB;
  // couleurs choisies par le joueur (panneau 🎨), sinon couleurs du thème
  const wallCol = roomStyle.wall || (casino ? PAL.casinoWallDark : PAL.wallDark);
  const stripeCol = roomStyle.trim || (casino ? PAL.casinoGold : PAL.wallOrange);
  const stripeCol2 = roomStyle.trim2 || (casino ? PAL.casinoRed : PAL.wallPurple);
  const wallTint = roomStyle.wall || (casino ? '#ffb27a' : '#ffffff');

  // carpet floor — a single woven-pattern plane instead of flat tiles, for a
  // proper casino/arcade carpet look instead of bare colored squares
  const carpetTex = makeCarpetTexture(casino);
  carpetTex.repeat.set(cols, rows);
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(cols*CELL, rows*CELL),
    new THREE.MeshStandardMaterial({map:carpetTex, roughness:0.88, metalness:0.05,
      color:new THREE.Color(roomStyle.floor || '#ffffff')})
  );
  floorPlane.rotation.x = -Math.PI/2;
  floorPlane.receiveShadow = true;
  roomGroup.add(floorPlane);

  /* ---------- découpage en 3 espaces ---------- */
  danceTiles = []; zoneLights = []; discoBall = null; dancers = [];
  const {splitX, splitZ} = zoneSplit(cols, rows);
  const halfW = cols*CELL/2, halfD = rows*CELL/2;
  const danceX0 = -halfW + splitX*CELL, danceZ1 = -halfD + splitZ*CELL;

  // ---- équipements de club : seulement si le joueur les a achetés ----
  const owns = (id)=> !!(state && state.machines && state.machines.some(m=>m.def && m.def.id===id));
  const hasFloor = owns('dancefloor');
  const hasBall  = owns('discoball');
  const hasDeck  = owns('djdeck');
  const clubAlive = hasFloor && (state.grime|0) <= 0;

  // piste de danse : dalles lumineuses (nord-est)
  const danceW = cols-splitX, danceD = splitZ;
  const danceCx = danceX0 + danceW*CELL/2, danceCz = -halfD + danceD*CELL/2;
  const ringR = Math.min(danceW, danceD)*CELL*0.46;
  if(hasFloor){
    for(let x=0;x<danceW;x++){
      for(let z=0;z<danceD;z++){
        const tileMat = new THREE.MeshStandardMaterial({
          color:0x120a20, emissive:new THREE.Color(0xff2e88), emissiveIntensity:0.25, roughness:0.35, metalness:0.3
        });
        const tile = new THREE.Mesh(new THREE.BoxGeometry(CELL*0.94, 0.06, CELL*0.94), tileMat);
        tile.position.set(danceX0 + (x+0.5)*CELL, 0.03, -halfD + (z+0.5)*CELL);
        tile.receiveShadow = true;
        tile.userData.phase = (x+z)*0.7 + Math.random();
        roomGroup.add(tile);
        danceTiles.push(tile);
      }
    }
    // anneau néon arrondi autour de la piste
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, 0.06, 8, 64),
      new THREE.MeshStandardMaterial({color:0x20e6d0, emissive:new THREE.Color(0x20e6d0), emissiveIntensity:1.4, roughness:0.4})
    );
    ring.rotation.x = -Math.PI/2; ring.position.set(danceCx, 0.075, danceCz);
    roomGroup.add(ring);
    for(let a=0;a<2;a++){
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(ringR*0.9, 0.03, 6, 48, Math.PI),
        new THREE.MeshStandardMaterial({color:0xff2e88, emissive:new THREE.Color(0xff2e88), emissiveIntensity:0.9, roughness:0.4})
      );
      arch.position.set(danceCx, 0.05, danceCz);
      arch.rotation.y = a*Math.PI/2 + 0.4;
      arch.scale.y = Math.min(0.75, 1.9/(ringR*0.9));
      roomGroup.add(arch);
    }
    [[0xff2e88, -1], [0x20e6d0, 1]].forEach(([col, side], i)=>{
      const spot = new THREE.PointLight(col, 1.6, 11, 2);
      spot.position.set(danceCx + side*CELL*0.9, 2.3, danceCz + side*CELL*0.6);
      spot.userData.kind = 'dance'; spot.userData.seed = i*2.1;
      spot.userData.base = new THREE.Vector3().copy(spot.position);
      roomGroup.add(spot); zoneLights.push(spot);
    });
  }
  // boule à facettes : uniquement si achetée
  if(hasBall){
    discoBall = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 1),
      new THREE.MeshStandardMaterial({color:0xd8dcff, metalness:1, roughness:0.15, emissive:0x334466, emissiveIntensity:0.4})
    );
    discoBall.position.set(danceCx, 2.15, danceCz);
    roomGroup.add(discoBall);
    const ballGlow = makeGlowSprite('#bcd0ff', 0.7);
    ballGlow.position.copy(discoBall.position); roomGroup.add(ballGlow);
  }
  // DJ : seulement si la platine est installée
  if(hasDeck && clubAlive){
    const djChar = buildCharacter('#20e6d0');
    djChar.position.set(danceCx + (danceW*CELL/2) - 1.1, 0, -halfD + 1.6);
    djChar.rotation.y = Math.PI;
    roomGroup.add(djChar);
    dancers.push({wrap:djChar, base:0, phase:0, style:'dj', x:djChar.position.x, z:djChar.position.z});
  }

  // foule qui danse : seulement quand la piste existe et que la salle est nettoyée
  if(clubAlive){
    const dancerCount = Math.min(8, Math.max(4, Math.round(danceW*danceD*0.55)));
    const dCols = ['#ff2e88','#20e6d0','#ffe600','#9b5cff','#ff8a3c'];
    for(let i=0;i<dancerCount;i++){
      const ang = (i/dancerCount)*Math.PI*2 + Math.random()*0.4;
      const rad = ringR*(0.25 + Math.random()*0.6);
      const ch = buildCharacter(dCols[i%dCols.length]);
      const px = danceCx + Math.cos(ang)*rad, pz = danceCz + Math.sin(ang)*rad;
      ch.position.set(px, 0, pz);
      ch.rotation.y = Math.atan2(danceCx-px, danceCz-pz);
      roomGroup.add(ch);
      dancers.push({wrap:ch, base:0, phase:Math.random()*6.3, style: i%3===0?'jump':(i%3===1?'sway':'spin'), x:px, z:pz});
    }
  }


  // arrière-salle clandestine (sud-est) : moquette rouge sombre + lumière tamisée
  const backW = cols-splitX, backD = rows-splitZ;
  const backCx = danceX0 + backW*CELL/2, backCz = danceZ1 + backD*CELL/2;
  const backFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(backW*CELL, backD*CELL),
    new THREE.MeshStandardMaterial({color:0x2a0a14, roughness:0.95})
  );
  backFloor.rotation.x = -Math.PI/2; backFloor.position.set(backCx, 0.02, backCz);
  backFloor.receiveShadow = true; roomGroup.add(backFloor);
  const backLight = new THREE.PointLight(0xff5533, 1.5, 12, 2);
  backLight.position.set(backCx, 2.1, backCz);
  backLight.userData.kind = 'back';
  roomGroup.add(backLight); zoneLights.push(backLight);
  const backHalo = makeGlowSprite('#ff6a3c', 1.0);
  backHalo.material.opacity = 0.45;
  backHalo.position.set(backCx, 2.0, backCz); roomGroup.add(backHalo);


  // cloison courbe qui sépare l'arrière-salle (décor payant)
  if(hasCos('partition')){
    const partition = group();
    const segCount = Math.max(3, backW*2);
    for(let i=0;i<segCount;i++){
      const t = i/(segCount-1);
      const px = danceX0 + t*backW*CELL;
      const bulge = Math.sin(t*Math.PI)*0.45; // courbure => moins carré
      const segH = 1.45; // assez bas pour voir la piste par-dessus
      const seg = box(backW*CELL/segCount + 0.12, segH, 0.22, casino?'#2a1420':'#221630');
      seg.position.set(px + (backW*CELL/segCount)/2, segH/2, danceZ1 + bulge);
      seg.rotation.y = Math.cos(t*Math.PI)*0.18;
      if(i === Math.floor(segCount/2)) continue; // passage
      partition.add(seg);
      const strip = box(backW*CELL/segCount + 0.1, 0.08, 0.24, '#ff2e88');
      strip.material.emissive = new THREE.Color(0xff2e88); strip.material.emissiveIntensity = 0.8;
      strip.position.set(seg.position.x, 1.4, seg.position.z);
      strip.rotation.y = seg.rotation.y;
      partition.add(strip);
    }
    roomGroup.add(partition);
  }




  // outer walls (skip a gap on west wall middle for the door)
  const wallH = 2.4;
  const doorRow = Math.floor(rows/2);
  const DOOR_W = 0.98, DOOR_H = wallH*0.82; // = largeur de l'encadrement buildDoorway
  function wallSeg(px,pz,rotY,len){
    const detail = roomStyle.detail || 'stripes';
    if(detail === 'model' && MODEL_TEMPLATES.WALL){
      const obj = MODEL_TEMPLATES.WALL.clone(true);
      obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
      fitHeight(obj, wallH);
      tintObject(obj, wallTint);
      const wrap = group(); wrap.add(obj);
      wrap.position.set(px,0,pz); wrap.rotation.y=rotY;
      roomGroup.add(wrap);
      return;
    }
    const g = group();
    const base = box(len,wallH,0.25, wallCol); base.position.y=wallH/2; g.add(base);
    if(detail === 'stripes'){
      const stripe = box(len,0.5,0.27, stripeCol); stripe.position.y=wallH*0.32; g.add(stripe);
      const stripe2 = box(len,0.3,0.28, stripeCol2); stripe2.position.y=wallH*0.15; g.add(stripe2);
    } else if(detail === 'bricks'){
      // appareillage de briques en quinconce
      const rowsB = 6, bw = len/4;
      for(let r=0;r<rowsB;r++){
        const off = (r%2) ? bw/2 : 0;
        for(let c=0;c<4;c++){
          const bx = -len/2 + off + bw/2 + c*bw;
          if(bx > len/2 - 0.05) continue;
          const brick = box(bw*0.9, wallH/rowsB*0.8, 0.27, r%2 ? stripeCol2 : stripeCol);
          brick.position.set(bx, (r+0.5)*wallH/rowsB, 0);
          g.add(brick);
        }
      }
    } else if(detail === 'panels'){
      for(let c=0;c<3;c++){
        const panel = box(len/3*0.8, wallH*0.6, 0.27, stripeCol);
        panel.position.set(-len/3 + c*len/3, wallH*0.5, 0); g.add(panel);
      }
      const cornice = box(len, 0.12, 0.3, stripeCol2); cornice.position.y = wallH*0.86; g.add(cornice);
    }
    g.position.set(px,0,pz); g.rotation.y=rotY;
    roomGroup.add(g);
  }
  // north & south walls (légèrement rallongés pour recouvrir les angles)
  for(let x=0;x<cols;x++){
    const pN = cellToWorld(x,0,cols,rows);
    wallSeg(pN.x, pN.z-CELL/2, 0, CELL+0.02);
    const pS = cellToWorld(x,rows-1,cols,rows);
    wallSeg(pS.x, pS.z+CELL/2, Math.PI, CELL+0.02);
  }
  // east & west walls (porte étroite sur la façade ouest)
  for(let z=0;z<rows;z++){
    const pE = cellToWorld(cols-1,z,cols,rows);
    wallSeg(pE.x+CELL/2, pE.z, Math.PI/2, CELL+0.02);
    const pW = cellToWorld(0,z,cols,rows);
    if(z!==doorRow){
      wallSeg(pW.x-CELL/2, pW.z, -Math.PI/2, CELL+0.02);
    } else {
      // on ne laisse que la largeur de l'encadrement : deux jambages ferment le reste
      const side = Math.max(0.1, (CELL-DOOR_W)/2);
      wallSeg(pW.x-CELL/2, pW.z - (CELL-side)/2, -Math.PI/2, side);
      wallSeg(pW.x-CELL/2, pW.z + (CELL-side)/2, -Math.PI/2, side);
      // linteau au-dessus de l'ouverture : plus aucun trou vu de l'intérieur
      const lintelH = wallH - DOOR_H;
      if(lintelH > 0.05){
        const lintel = box(0.25, lintelH, DOOR_W + 0.04, wallCol);
        lintel.position.set(pW.x-CELL/2, DOOR_H + lintelH/2, pW.z);
        roomGroup.add(lintel);
      }
    }
  }
  // poteaux d'angle : suppriment les trous aux jonctions de murs
  [[0,0],[cols-1,0],[0,rows-1],[cols-1,rows-1]].forEach(([cx,cz])=>{
    const p = cellToWorld(cx,cz,cols,rows);
    const px = p.x + (cx===0 ? -CELL/2 : CELL/2);
    const pz = p.z + (cz===0 ? -CELL/2 : CELL/2);
    const post = box(0.3, wallH, 0.3, wallCol);
    post.position.set(px, wallH/2, pz);
    roomGroup.add(post);
  });
  // posters along the north wall — décor payant
  if(hasCos('posters')){
    const posterKinds = ['logo','score','pad'];
    const northZ = cellToWorld(0,0,cols,rows).z - CELL/2;
    let pk = 0;
    for(let x=0.7; x<cols-0.5; x+=1.7){
      const worldX = -(cols*CELL/2) + x*CELL;
      const tex = makePosterTexture(posterKinds[pk % posterKinds.length], casino);
      pk++;
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.75,1.0), new THREE.MeshStandardMaterial({map:tex, roughness:0.6}));
      poster.position.set(worldX, 1.35, northZ+0.06);
      roomGroup.add(poster);
    }
  }
  // colonnes d'angle — décor payant
  if(hasCos('columns')){
    const corners = [[0,0],[cols-1,0],[0,rows-1],[cols-1,rows-1]];
    corners.forEach(([cx,cz])=>{
      const p = cellToWorld(cx,cz,cols,rows);
      if(MODEL_TEMPLATES.COLUMN){
        const obj = MODEL_TEMPLATES.COLUMN.clone(true);
        obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
        fitHeight(obj, 2.6);
        if(casino) tintObject(obj, '#ffe6a8');
        const wrap = group(); wrap.add(obj); wrap.position.set(p.x,0,p.z);
        roomGroup.add(wrap);
      } else {
        const col = cyl(0.25,0.25,2.6, casino?PAL.casinoGold:PAL.purple,12);
        col.position.set(p.x,1.3,p.z);
        roomGroup.add(col);
      }
    });
  }
  // barre néon intérieure — achetable
  if(hasCos('innerneon')){
    const northMid = cellToWorld(cols/2-0.5,0,cols,rows);
    const signBar = new THREE.Mesh(
      new THREE.BoxGeometry(CELL*2.2, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: casino?0xffd23f:0xff2e88,
        emissive: casino?0xffd23f:0xff2e88, emissiveIntensity:1.4, roughness:0.4
      })
    );
    signBar.position.set(northMid.x, wallH*0.9, northMid.z-CELL/2+0.08);
    roomGroup.add(signBar);
    const signGlow = new THREE.PointLight(casino?0xffd23f:0xff2e88, 0.8, 7, 2);
    signGlow.position.set(northMid.x, wallH*0.8, northMid.z-CELL/2+0.6);
    roomGroup.add(signGlow);
    roomGroup.userData.signHalo = signBar;
  } else {
    roomGroup.userData.signHalo = null;
  }



  // door — a proper detailed doorway (frame, glass panels, handles, canopy)
  const doorP = cellToWorld(0,doorRow,cols,rows);
  const doorway = buildDoorway(casino, DOOR_H);
  doorway.position.set(doorP.x-CELL/2, 0, doorP.z);
  doorway.rotation.y = -Math.PI/2;
  roomGroup.add(doorway);

  scene.fog.color.set(casino?0x1a0812:0x0d0618);
  scene.background.set(casino?0x1a0812:0x0d0618);

  orbit.target.set(0,0.5,0);
  const portrait = window.innerHeight > window.innerWidth;
  orbit.radius = (12 + Math.max(cols,rows)*1.25) * (portrait ? 1.45 : 1);
  orbit.phi = portrait ? 1.05 : 0.95;

  updateCamera();

  // la reconstruction vide roomGroup : on remet les gravats restants
  if(typeof spawnGrime === 'function' && state && (state.grime|0) > 0) spawnGrime();

  return {cols,rows,doorRow};
}

/* ============================================================
   EXTERIOR VIEW — street, houses, building shell
   (uses the city-kit-roads / city-kit-suburban / mini-characters
   packs, with the same graceful procedural fallback pattern as
   the interior scene)
   ============================================================ */
const exteriorGroup = group(); exteriorGroup.visible = false; scene.add(exteriorGroup);
const exteriorStreetGroup = group(); exteriorGroup.add(exteriorStreetGroup);
const exteriorBuildingGroup = group(); exteriorGroup.add(exteriorBuildingGroup);
// enveloppe de Rosa posée devant la porte condamnée (déclenche la cinématique d'intro au clic)
let introLetter = null;
function makeTagSprite(text, color){
  const cvs = document.createElement('canvas');
  cvs.width = 512; cvs.height = 128;
  const c = cvs.getContext('2d');
  c.fillStyle = 'rgba(10,6,20,0.82)';
  c.strokeStyle = color; c.lineWidth = 6;
  const r = 26;
  c.beginPath();
  c.moveTo(r,4); c.lineTo(508-r,4); c.quadraticCurveTo(508,4,508,4+r);
  c.lineTo(508,124-r); c.quadraticCurveTo(508,124,508-r,124);
  c.lineTo(r,124); c.quadraticCurveTo(4,124,4,124-r);
  c.lineTo(4,4+r); c.quadraticCurveTo(4,4,r,4);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = color;
  c.font = 'bold 58px "Courier New", monospace';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cvs);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  sp.scale.set(2.6, 0.65, 1);
  sp.renderOrder = 999;
  return sp;
}
// quartier personnalisé par le joueur (éditeur)
const hoodGroup = group(); exteriorGroup.add(hoodGroup);
const hoodLifeGroup = group(); exteriorGroup.add(hoodLifeGroup); // habitants/voitures nés des constructions
const pedestrians = [];
const cars = [];
const extMovers = [];   // pigeons, chat de ruelle, badauds qui piétinent
const extFlickers = []; // néons des commerces qui clignotent
let patrolCar = null;   // voiture de police qui rôde quand la suspicion grimpe

function buildHouse(wallColor, roofColor, wallH){
  const g = group();
  const base = box(1.6, wallH, 1.6, wallColor); base.position.y = wallH/2; g.add(base);
  const roof = cyl(0, 1.2, 0.7, roofColor, 4); roof.position.y = wallH+0.35; roof.rotation.y = Math.PI/4; g.add(roof);
  // chimney
  const chimney = box(0.16, 0.5, 0.16, '#5a4038');
  chimney.position.set(0.45, wallH+0.55, -0.3);
  g.add(chimney);
  // door
  const doorFrame = box(0.34, 0.62, 0.05, '#2a1e18');
  doorFrame.position.set(0, 0.31, 0.81);
  g.add(doorFrame);
  const doorPanel = box(0.26, 0.54, 0.03, '#7a4a30');
  doorPanel.position.set(0, 0.29, 0.835);
  g.add(doorPanel);
  // two glowing windows either side of the door
  [-0.55, 0.55].forEach(x=>{
    const win = box(0.32, 0.32, 0.04, '#ffdf9a', {emissive:0xffdf9a, emissiveIntensity:0.5});
    win.position.set(x, wallH*0.62, 0.81);
    g.add(win);
    const winFrame = box(0.4, 0.4, 0.02, '#2a1e18');
    winFrame.position.set(x, wallH*0.62, 0.79);
    g.add(winFrame);
  });
  return g;
}

function buildCar(color, length, bodyH, tall){
  const g = group();
  const body = box(0.95, bodyH, length, color);
  body.position.y = bodyH/2 + 0.14;
  g.add(body);
  const cabin = box(0.8, bodyH*0.7, length*0.5, '#1a2230', {transparent:true, opacity:0.75, roughness:0.2});
  cabin.position.set(0, bodyH+0.14+bodyH*0.35*0.5, -length*0.05);
  g.add(cabin);
  const wheelPositions = [
    [-0.46, length*0.32],[0.46, length*0.32],
    [-0.46, -length*0.32],[0.46, -length*0.32]
  ];
  wheelPositions.forEach(([x,z])=>{
    const wheel = cyl(0.16,0.16,0.14,'#1a1a1a',12);
    wheel.rotation.z = Math.PI/2;
    wheel.position.set(x, 0.16, z);
    g.add(wheel);
  });
  const lightL = box(0.12,0.08,0.03,'#fff6d8',{emissive:0xfff6d8,emissiveIntensity:0.6});
  lightL.position.set(-0.32, bodyH*0.5+0.14, length/2-0.02); g.add(lightL);
  const lightR = box(0.12,0.08,0.03,'#fff6d8',{emissive:0xfff6d8,emissiveIntensity:0.6});
  lightR.position.set(0.32, bodyH*0.5+0.14, length/2-0.02); g.add(lightR);
  const tailL = box(0.12,0.08,0.03,'#c92a2a',{emissive:0xc92a2a,emissiveIntensity:0.4});
  tailL.position.set(-0.32, bodyH*0.5+0.14, -length/2+0.02); g.add(tailL);
  const tailR = box(0.12,0.08,0.03,'#c92a2a',{emissive:0xc92a2a,emissiveIntensity:0.4});
  tailR.position.set(0.32, bodyH*0.5+0.14, -length/2+0.02); g.add(tailR);
  return g;
}

const EXT_BUILDERS = {
  ROAD_STRAIGHT: ()=> box(2.3,0.05,2.3,'#3a3a44'),
  ROAD_CROSS: ()=> box(2.3,0.05,2.3,'#3a3a44'),
  ROAD_BEND: ()=> box(2.3,0.05,2.3,'#3a3a44'),
  ROAD_TEE: ()=> box(2.3,0.05,2.3,'#3a3a44'),
  ROAD_CROSSROAD: ()=> box(2.3,0.05,2.3,'#3a3a44'),
  ROAD_END: ()=> box(2.3,0.05,2.3,'#3a3a44'),
  STREETLIGHT: ()=>{ const g=group(); const pole=cyl(0.04,0.04,2.2,'#333333'); pole.position.y=1.1; g.add(pole); const lamp=sphere(0.13,'#ffe9a8',{emissive:0xffdd88,emissiveIntensity:0.9}); lamp.position.y=2.15; g.add(lamp); return g; },
  HOUSE_A: ()=> buildHouse('#8a6a52','#4a7a5a',1.5),
  HOUSE_E: ()=> buildHouse('#7a8a6a','#3a3a44',1.7),
  HOUSE_J: ()=> buildHouse('#6a7a8a','#5a4a6a',1.4),
  TREE_LARGE: ()=>{ const g=group(); const trunk=cyl(0.08,0.1,0.6,'#6b4a2f'); trunk.position.y=0.3; g.add(trunk); const top=sphere(0.5,'#3fa25c'); top.position.y=0.95; g.add(top); return g; },
  TREE_SMALL: ()=>{ const g=group(); const trunk=cyl(0.06,0.08,0.4,'#6b4a2f'); trunk.position.y=0.2; g.add(trunk); const top=sphere(0.35,'#4bb567'); top.position.y=0.6; g.add(top); return g; },
  FENCE: ()=> box(1.2,0.5,0.08,'#a97c50'),
  PLANTER: ()=>{ const g=group(); const pot=cyl(0.3,0.25,0.3,'#8a5a3c'); pot.position.y=0.15; g.add(pot); const bush=sphere(0.28,'#3fa25c'); bush.position.y=0.42; g.add(bush); return g; },
  PED_MALE: ()=> buildCharacter(0x3f6fae),
  PED_FEMALE: ()=> buildCharacter(0xe5989b),
  PED_MALE2: ()=> buildCharacter(0x6d8a4f),
  PED_FEMALE2: ()=> buildCharacter(0xc98a4f),
  CAR_SEDAN: ()=> buildCar('#3f6fae', 1.9, 0.4, false),
  CAR_TAXI: ()=> buildCar('#ffd23f', 1.9, 0.4, false),
  CAR_HATCH: ()=> buildCar('#3fa25c', 1.7, 0.4, false),
  CAR_SUV: ()=> buildCar('#5a5a68', 2.0, 0.55, true),
  CAR_POLICE: ()=>{
    const g = buildCar('#1d2436', 1.95, 0.42, false);
    const bar = box(0.5,0.09,0.16,'#101010'); bar.position.set(0,0.98,-0.1); g.add(bar);
    const bl = box(0.2,0.09,0.14,'#3f6fae',{emissive:0x2f6fff,emissiveIntensity:1.4}); bl.position.set(-0.14,0.98,-0.1); g.add(bl);
    const br = box(0.2,0.09,0.14,'#c92a2a',{emissive:0xff2020,emissiveIntensity:1.4}); br.position.set(0.14,0.98,-0.1); g.add(br);
    g.userData.beacons = [bl, br];
    return g;
  },
  DUMPSTER: ()=>{
    const g = group();
    const body = box(1.1,0.7,0.7,'#2f6b4a'); body.position.y=0.42; g.add(body);
    const lid = box(1.16,0.08,0.76,'#24523a'); lid.position.set(0,0.82,-0.04); lid.rotation.x=-0.14; g.add(lid);
    [-0.45,0.45].forEach(x=>{ const w=cyl(0.09,0.09,0.07,'#141414',10); w.rotation.z=Math.PI/2; w.position.set(x,0.09,0.26); g.add(w); });
    return g;
  },
  TRASHBAG: ()=>{ const g=group(); const b=sphere(0.22,'#22202a'); b.scale.set(1,0.85,1); b.position.y=0.19; g.add(b); const k=cyl(0.05,0.09,0.12,'#22202a',8); k.position.y=0.4; g.add(k); return g; },
  CRATE: ()=>{ const g=group(); const c=box(0.5,0.45,0.5,'#8a5f38'); c.position.y=0.23; g.add(c); const t=box(0.52,0.05,0.52,'#6d4a2a'); t.position.y=0.47; g.add(t); return g; },
  BARREL: ()=>{ const g=group(); const b=cyl(0.24,0.24,0.7,'#b5462f',14); b.position.y=0.35; g.add(b); const r=cyl(0.25,0.25,0.06,'#2a2a30',14); r.position.y=0.5; g.add(r); return g; },
  HYDRANT: ()=>{ const g=group(); const b=cyl(0.09,0.11,0.42,'#c92a2a',10); b.position.y=0.21; g.add(b); const cap=sphere(0.1,'#c92a2a'); cap.position.y=0.44; g.add(cap); [-0.13,0.13].forEach(x=>{ const n=cyl(0.04,0.04,0.1,'#8f1f1f',8); n.rotation.z=Math.PI/2; n.position.set(x,0.28,0); g.add(n); }); return g; },
  /* --- décos de façade / rue achetables dans la boutique extérieure --- */
  WALL_NEON: ()=>{
    const g = group();
    const back = box(0.12,0.7,1.6,'#150a1e'); back.position.set(0,1.7,0); g.add(back);
    const tube = box(0.08,0.12,1.4,'#ff2e88',{emissive:0xff2e88,emissiveIntensity:1.5}); tube.position.set(-0.08,1.9,0); g.add(tube);
    const tube2 = box(0.08,0.12,1.0,'#00f3ff',{emissive:0x00f3ff,emissiveIntensity:1.5}); tube2.position.set(-0.08,1.55,0); g.add(tube2);
    const halo = registerNightHalo(makeGlowSprite('#ff2e88', 1.6), 0.6); halo.position.set(-0.3,1.75,0); g.add(halo);
    return g;
  },
  NEON_ARROW: ()=>{
    const g = group();
    const pole = cyl(0.05,0.05,2.0,'#3a3a44'); pole.position.y=1.0; g.add(pole);
    const panel = box(0.1,0.5,1.1,'#ffd23f',{emissive:0xffd23f,emissiveIntensity:1.3}); panel.position.set(0,2.1,0.3); g.add(panel);
    const tip = box(0.1,0.35,0.35,'#ffd23f',{emissive:0xffd23f,emissiveIntensity:1.3}); tip.position.set(0,2.1,0.95); tip.rotation.x=Math.PI/4; g.add(tip);
    return g;
  },
  GRAFFITI: ()=>{
    const g = group();
    const wall = box(0.1,1.6,2.2,'#2a2340'); wall.position.set(0,0.8,0); g.add(wall);
    const cols = ['#ff2e88','#2fd4c8','#ffd23f','#8b5cf6'];
    for(let i=0;i<7;i++){
      const s = box(0.04,0.18+Math.random()*0.5,0.18+Math.random()*0.4, cols[i%4],{emissive:new THREE.Color(cols[i%4]).getHex(),emissiveIntensity:0.35});
      s.position.set(-0.07, 0.4+Math.random()*0.9, -0.9+i*0.3); s.rotation.x=(Math.random()-0.5)*0.6; g.add(s);
    }
    return g;
  },
  BULB_STRING: ()=>{
    const g = group();
    [-1.1,1.1].forEach(z=>{ const p=cyl(0.04,0.04,2.4,'#3a3a44'); p.position.set(0,1.2,z); g.add(p); });
    for(let i=0;i<9;i++){
      const t = i/8, sag = Math.sin(t*Math.PI)*0.3;
      const b = sphere(0.07,'#fff0c0',{emissive:0xffcc66,emissiveIntensity:1.3});
      b.position.set(0, 2.3-sag, -1.1+t*2.2); g.add(b);
    }
    return g;
  },
  POSTER_WALL: ()=>{
    const g = group();
    const frame = box(0.1,1.3,0.95,'#150a1e'); frame.position.set(0,1.2,0); g.add(frame);
    const art = box(0.05,1.1,0.78,'#8b5cf6',{emissive:0x8b5cf6,emissiveIntensity:0.5}); art.position.set(-0.06,1.2,0); g.add(art);
    const band = box(0.06,0.18,0.78,'#ffd23f',{emissive:0xffd23f,emissiveIntensity:0.7}); band.position.set(-0.07,0.85,0); g.add(band);
    return g;
  },
  AWNING: ()=>{
    const g = group();
    for(let i=0;i<6;i++){
      const s = box(0.9,0.08,0.34, i%2 ? '#ff2e88' : '#f6f1ff');
      s.position.set(0.3,1.95-0.12,-0.9+i*0.34); s.rotation.z=-0.35; g.add(s);
    }
    const bar = box(0.06,0.06,2.1,'#3a3a44'); bar.position.set(0,2.05,0); g.add(bar);
    [-1.0,1.0].forEach(z=>{ const p=cyl(0.03,0.03,0.6,'#3a3a44'); p.position.set(0.55,1.7,z); p.rotation.x=0.2; g.add(p); });
    return g;
  },
  VELVET_ROPE: ()=>{
    const g = group();
    [-0.8,0.8].forEach(z=>{
      const p = cyl(0.06,0.08,0.9,'#e8b64a',12); p.position.set(0,0.45,z); g.add(p);
      const k = sphere(0.09,'#e8b64a'); k.position.set(0,0.94,z); g.add(k);
    });
    const rope = cyl(0.045,0.045,1.5,'#8f1f2e',10); rope.rotation.x=Math.PI/2; rope.position.set(0,0.78,0); g.add(rope);
    return g;
  },
  PALM_NEON: ()=>{
    const g = group();
    const trunk = cyl(0.09,0.13,2.2,'#5b4326',10); trunk.position.y=1.1; g.add(trunk);
    for(let i=0;i<6;i++){
      const a = i*Math.PI/3;
      const leaf = box(0.9,0.05,0.28,'#2fd4c8',{emissive:0x2fd4c8,emissiveIntensity:0.8});
      leaf.position.set(Math.cos(a)*0.45,2.2,Math.sin(a)*0.45); leaf.rotation.y=-a; leaf.rotation.z=-0.3; g.add(leaf);
    }
    return g;
  },
  MARQUEE_SIGN: ()=>{
    const g = group();
    const pole = cyl(0.08,0.08,1.6,'#3a3a44'); pole.position.y=0.8; g.add(pole);
    const panel = makeSignPanel(clubBrand.name.slice(0,12).toUpperCase() || 'CLUB', clubBrand.color, 2.2, 0.7);
    panel.position.set(0,2.0,0); g.add(panel);
    const back = box(0.08,0.8,2.3,'#150a1e'); back.position.set(0.06,2.0,0); g.add(back);
    const halo = registerNightHalo(makeGlowSprite(clubBrand.color, 2.0), 0.7); halo.position.set(-0.3,2.0,0); g.add(halo);
    return g;
  },
  BENCH_EXT: ()=>{
    const g = group();
    const seat = box(1.2,0.07,0.38,'#8a5f38'); seat.position.y=0.42; g.add(seat);
    const back = box(1.2,0.32,0.06,'#8a5f38'); back.position.set(0,0.62,-0.16); g.add(back);
    [-0.5,0.5].forEach(x=>{ const l=box(0.07,0.42,0.34,'#3a3a44'); l.position.set(x,0.21,0); g.add(l); });
    return g;
  },
  PHONE_BOOTH: ()=>{
    const g = group();
    const shell = box(0.7,1.9,0.7,'#c92a2a'); shell.position.y=0.95; g.add(shell);
    const glass = box(0.58,1.2,0.72,'#9fd4e8',{transparent:true,opacity:0.35,emissive:0x66aacc,emissiveIntensity:0.35});
    glass.position.y=1.15; g.add(glass);
    const roof = box(0.8,0.12,0.8,'#8f1f1f'); roof.position.y=1.96; g.add(roof);
    const lamp = box(0.5,0.06,0.5,'#ffe9a8',{emissive:0xffdd88,emissiveIntensity:0.9}); lamp.position.y=1.82; g.add(lamp);
    return g;
  },
  MAILBOX: ()=>{ const g=group(); const p=cyl(0.05,0.05,0.5,'#3a3a44'); p.position.y=0.25; g.add(p); const b=box(0.34,0.4,0.28,'#3f6fae'); b.position.y=0.7; g.add(b); return g; },
  BUS_STOP: ()=>{
    const g = group();
    const roof = box(2.4,0.08,1.0,'#2a2a34'); roof.position.y=1.95; g.add(roof);
    [-1.1,1.1].forEach(x=>{ const p=cyl(0.05,0.05,1.95,'#3a3a44'); p.position.set(x,0.97,0.4); g.add(p); });
    const back = box(2.4,1.5,0.06,'#9fd4e8',{transparent:true,opacity:0.28}); back.position.set(0,0.95,-0.45); g.add(back);
    const bench = box(2.0,0.08,0.34,'#8a5f38'); bench.position.set(0,0.42,-0.25); g.add(bench);
    const panel = box(0.55,0.9,0.05,'#f4a13c',{emissive:0xf4a13c,emissiveIntensity:0.55}); panel.position.set(1.0,1.1,-0.42); g.add(panel);
    return g;
  },
  HOTDOG_STAND: ()=>{
    const g = group();
    const cart = box(1.1,0.6,0.7,'#e8e2d0'); cart.position.y=0.55; g.add(cart);
    const stripe = box(1.12,0.14,0.72,'#c92a2a'); stripe.position.y=0.72; g.add(stripe);
    const umbrella = cyl(0.02,1.0,0.28,'#c92a2a',10); umbrella.position.y=1.55; g.add(umbrella);
    const pole = cyl(0.03,0.03,0.9,'#8a8a94'); pole.position.y=1.05; g.add(pole);
    [-0.45,0.45].forEach(x=>{ const w=cyl(0.13,0.13,0.06,'#1a1a1a',10); w.rotation.z=Math.PI/2; w.position.set(x,0.13,0.24); g.add(w); });
    const warm = box(0.5,0.05,0.4,'#ffcf7a',{emissive:0xffb95c,emissiveIntensity:0.8}); warm.position.y=0.86; g.add(warm);
    return g;
  },
  SHOPFRONT: ()=>{
    const g = group();
    const body = box(2.6,2.6,1.6,'#3a3348'); body.position.y=1.3; g.add(body);
    const awning = box(2.7,0.1,0.7,'#c92a2a'); awning.position.set(0,1.5,0.95); awning.rotation.x=0.18; g.add(awning);
    const glass = box(2.1,1.1,0.06,'#152436',{transparent:true,opacity:0.7,emissive:0x2f6fae,emissiveIntensity:0.5});
    glass.position.set(0,0.85,0.82); g.add(glass);
    const door = box(0.5,1.1,0.06,'#1a1024'); door.position.set(0.9,0.55,0.83); g.add(door);
    return g;
  },
  BIKE: ()=>{
    const g = group();
    [-0.32,0.32].forEach(z=>{ const w=new THREE.Mesh(new THREE.TorusGeometry(0.19,0.025,6,14), mat('#1a1a1a')); w.position.set(0,0.19,z); w.rotation.y=Math.PI/2; g.add(w); });
    const frame = box(0.04,0.04,0.62,'#3fa25c'); frame.position.set(0,0.34,0); g.add(frame);
    const seat = box(0.08,0.05,0.16,'#22202a'); seat.position.set(0,0.5,-0.2); g.add(seat);
    const bar = box(0.3,0.03,0.03,'#8a8a94'); bar.position.set(0,0.52,0.28); g.add(bar);
    return g;
  },
  PIGEON: ()=>{ const g=group(); const b=sphere(0.07,'#7a7f8c'); b.scale.set(1.4,1,1); g.add(b); const h=sphere(0.045,'#5f6673'); h.position.set(0.09,0.05,0); g.add(h); const t=box(0.09,0.015,0.05,'#5f6673'); t.position.set(-0.11,0.01,0); g.add(t); return g; },
  CAT: ()=>{ const g=group(); const b=sphere(0.09,'#2a2630'); b.scale.set(1.6,0.9,0.9); g.add(b); const h=sphere(0.06,'#2a2630'); h.position.set(0.13,0.05,0); g.add(h); const t=cyl(0.015,0.02,0.2,'#2a2630',6); t.rotation.z=Math.PI/2.6; t.position.set(-0.16,0.08,0); g.add(t); return g; },
  BILLBOARD: ()=>{
    const g = group();
    [-0.7,0.7].forEach(x=>{ const p=cyl(0.06,0.06,2.2,'#3a3a44'); p.position.set(x,1.1,0); g.add(p); });
    const panel = box(2.2,1.2,0.1,'#1a1024'); panel.position.y=2.7; g.add(panel);
    const artwork = box(2.0,1.0,0.04,'#ff2e88',{emissive:0xff2e88,emissiveIntensity:0.7}); artwork.position.set(0,2.7,0.08); g.add(artwork);
    return g;
  },
  NEON_TUBE: ()=> box(1.6,0.12,0.08,'#2fd4c8',{emissive:0x2fd4c8,emissiveIntensity:1.2}),
  BANK_BUILDING: ()=>{
    const g = group();
    // corps en pierre claire
    const body = box(3.6,3.0,2.8,'#cfc7b4'); body.position.y=1.5; g.add(body);
    const base = box(3.9,0.3,3.1,'#a79f8d'); base.position.y=0.15; g.add(base);
    // fronton triangulaire
    const ped = new THREE.Mesh(new THREE.ConeGeometry(2.35,0.9,3), mat('#e3dbc6'));
    ped.rotation.y = Math.PI/2; ped.position.set(0,3.4,0.05); ped.scale.set(1,1,0.62); g.add(ped);
    const roof = box(3.9,0.22,2.95,'#e3dbc6'); roof.position.y=3.05; g.add(roof);
    // colonnes en façade
    [-1.3,-0.44,0.44,1.3].forEach(x=>{
      const c = cyl(0.17,0.17,2.7,'#efe8d6',12); c.position.set(x,1.35,1.5); g.add(c);
      const cap = box(0.42,0.14,0.42,'#e3dbc6'); cap.position.set(x,2.76,1.5); g.add(cap);
    });
    // grande porte + marches
    const door = box(1.0,1.6,0.1,'#3a2a18'); door.position.set(0,0.8,1.42); g.add(door);
    const hand = cyl(0.05,0.05,0.16,'#e8b64a',8); hand.rotation.x=Math.PI/2; hand.position.set(0.3,0.9,1.5); g.add(hand);
    [0,1,2].forEach(i=>{ const s=box(1.6-i*0.15,0.1,0.5-i*0.1,'#bdb5a2'); s.position.set(0,0.05+i*0.1,1.85-i*0.12); g.add(s); });
    // vitrines
    [-1.2,1.2].forEach(x=>{
      const w = box(0.7,1.1,0.08,'#20364d',{transparent:true,opacity:0.75,emissive:0x2f6fae,emissiveIntensity:0.35});
      w.position.set(x,1.6,1.44); g.add(w);
    });
    // enseigne néon BANQUE
    const sign = makeSignPanel('BANQUE', '#e8b64a', 2.4, 0.55);
    sign.position.set(0,2.55,1.62); g.add(sign);
    const halo = registerNightHalo(makeGlowSprite('#e8b64a', 2.4), 0.55);
    halo.position.set(0,2.55,1.9); g.add(halo);
    // symbole € sur le fronton
    const coin = cyl(0.28,0.28,0.08,'#e8b64a',16); coin.rotation.x=Math.PI/2; coin.position.set(0,3.45,0.6); g.add(coin);
    return g;
  },
};


// placeholder générique quand un GLB manque (ou en mode rendu léger) :
// une forme simple mais correctement proportionnée plutôt qu'un trou dans la scène
function placeholderFor(key, spec){
  const target = spec && spec.target ? spec.target : 1.5;
  if(key.startsWith('CITY_SKY')){
    const g = group();
    const h = Math.max(target, 6);
    const b = box(3.4, h, 3.4, '#3b3550'); b.position.y = h/2; g.add(b);
    const win = box(3.44, h*0.6, 0.06, '#8fd8ff', {emissive:0x2fd4c8, emissiveIntensity:0.25});
    win.position.set(0, h*0.55, 1.72); g.add(win);
    return g;
  }
  if(key.startsWith('CITY_')){
    const g = group();
    const h = Math.max(target, 3);
    const b = box(3.0, h, 3.0, '#4a4360'); b.position.y = h/2; g.add(b);
    const roof = box(3.2, 0.25, 3.2, '#332e46'); roof.position.y = h + 0.12; g.add(roof);
    return g;
  }
  if(key.startsWith('CAR_')){
    const police = key.indexOf('POLICE') >= 0;
    if(police && EXT_BUILDERS.CAR_POLICE) return EXT_BUILDERS.CAR_POLICE();
    return buildCar(key === 'CAR_TAXI' ? '#ffd23f' : '#5a5a68', 1.9, key === 'CAR_VAN' ? 0.6 : 0.45, key === 'CAR_VAN' || key === 'CAR_SUV');
  }
  if(key === 'CONE'){
    const g = group();
    const c = cyl(0.03, 0.16, 0.42, '#ff7a2f', 10); c.position.y = 0.21; g.add(c);
    const base = box(0.34, 0.05, 0.34, '#2a2630'); base.position.y = 0.025; g.add(base);
    return g;
  }
  if(key === 'AWNING'){
    const a = box(1.8, 0.12, 0.9, '#ff2e88'); a.position.y = 2.2; a.rotation.x = -0.25;
    return a;
  }
  if(key === 'PARASOL'){
    const g = group();
    const p = cyl(0.04, 0.04, 1.9, '#4a4460'); p.position.y = 0.95; g.add(p);
    const top = cyl(0.02, 0.9, 0.35, '#2fd4c8', 10); top.position.y = 2.0; g.add(top);
    return g;
  }
  const b = box(0.8, target, 0.8, '#5a5468'); b.position.y = target/2;
  return b;
}

function placeExt(parentGroup, key, spec, x, z, rotY){
  let obj;
  if(MODEL_TEMPLATES[key]){
    obj = MODEL_TEMPLATES[key].clone(true);
    obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    if(spec.mode==='footprint') fitFootprint(obj, spec.target); else fitHeight(obj, spec.target);
  } else if(EXT_BUILDERS[key]){
    obj = EXT_BUILDERS[key]();
  } else {
    obj = placeholderFor(key, spec);
  }
  const wrap = group(); wrap.add(obj);
  wrap.position.set(x,0,z); wrap.rotation.y = rotY||0;
  if(parentGroup === exteriorStreetGroup){
    wrap.userData.sid = 's' + (extSidCounter++);
    wrap.userData.extKey = key;
  }
  parentGroup.add(wrap);
  return wrap;
}


// Places a curved streetlight so the mast sits on the kerb and the arm always
// overhangs the road. `roadDir` is the direction of the road from the mast.
function placeStreetlight(x, z, roadDir, withPointLight){
  const lightWrap = placeExt(exteriorStreetGroup, 'STREETLIGHT', {mode:'height',target:2.9}, x, z, 0);
  if(!lightWrap) return null;
  const obj = lightWrap.children[0];
  const bb = new THREE.Box3().setFromObject(obj);
  let headX = 0, headY = bb.max.y, headZ = 0, best = -Infinity;
  obj.traverse(o=>{
    if(!o.isMesh) return;
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    if(c.y > best){ best = c.y; headX = c.x; headY = c.y; headZ = c.z; }
  });
  const armDir = Math.max(Math.abs(headX), Math.abs(headZ)) < 0.15
    ? 'none'
    : Math.abs(headX) > Math.abs(headZ)
    ? (headX >= 0 ? 'x+' : 'x-')
    : (headZ >= 0 ? 'z+' : 'z-');
  // the mast sits on the side opposite the arm — slide it back onto the kerb
  if(armDir === 'x+'){ obj.position.x -= bb.min.x; }
  else if(armDir === 'x-'){ obj.position.x -= bb.max.x; }
  else if(armDir === 'z+'){ obj.position.z -= bb.min.z; }
  else if(armDir === 'z-'){ obj.position.z -= bb.max.z; }
  // yaw that turns the model's arm toward -x, then re-aim at the actual road
  const baseYaw = (armDir === 'x-' || armDir === 'none') ? 0 : armDir === 'x+' ? Math.PI : armDir === 'z+' ? Math.PI/2 : -Math.PI/2;
  const aim = roadDir === 'x-' ? 0 : roadDir === 'x+' ? Math.PI : roadDir === 'z-' ? -Math.PI/2 : Math.PI/2;
  const yaw = baseYaw + aim;
  lightWrap.rotation.y = yaw;
  const bulb = new THREE.Vector3(headX + obj.position.x, headY, headZ + obj.position.z)
    .applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  const bx = x + bulb.x, by = bulb.y, bz = z + bulb.z;
  if(!isMobile && withPointLight){
    const glow = registerNightLamp(new THREE.PointLight(0xffdd99, 0, 9, 2), 2.2);
    glow.position.set(bx, by, bz);
    exteriorStreetGroup.add(glow);
    // cône de lumière visible sous le lampadaire (rendu plus dramatique la nuit)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, Math.max(0.8, by), 14, 1, true),
      new THREE.MeshBasicMaterial({color:0xffdd99, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending})
    );
    cone.position.set(bx, by/2, bz);
    cone.userData.maxOpacity = 0.13;
    lightCones.push(cone);
    exteriorStreetGroup.add(cone);
  }

  const halo = registerNightHalo(makeGlowSprite('#ffdd99', 0.7), 0.85);
  halo.position.set(bx, by - 0.05, bz);
  exteriorStreetGroup.add(halo);
  return lightWrap;
}

// static street dressing — built once, independent of the arcade's stage/size

let extSidCounter = 0;
function buildExteriorStreet(maxSpan){
  while(exteriorStreetGroup.children.length) exteriorStreetGroup.remove(exteriorStreetGroup.children[0]);
  extSidCounter = 0;
  pedestrians.length = 0;
  cars.length = 0;
  extMovers.length = 0;
  extFlickers.length = 0;
  for(let i=lightCones.length-1;i>=0;i--) if(!lightCones[i].parent) lightCones.splice(i,1);
  for(let i=nightLamps.length-1;i>=0;i--) if(!nightLamps[i].parent) nightLamps.splice(i,1);
  for(let i=nightHalos.length-1;i>=0;i--) if(!nightHalos[i].parent) nightHalos.splice(i,1);
  patrolCar = null;

  // décor d'origine : uniquement pour les anciennes parties. Nouvelle partie = quartier à bâtir.
  const decor = !!(typeof state !== 'undefined' && state && state.cityDecor);

  const sidewalkX = -8;
  const roadX = -10.6;
  const roadLaneOffset = 0.55; // two lanes, cars keep to their side
  const houseX = -15.5;
  const zMin = -maxSpan, zMax = maxSpan;

  // Tout le réseau routier est calé sur une grille stricte de dalles :
  // sans ça les avenues transversales tombaient entre deux dalles (routes coupées).
  const TILE = 2.3;
  const kMin = Math.floor(zMin / TILE);
  const kMax = Math.ceil(zMax / TILE);
  const crossZ = (kMin + 1) * TILE;
  const crossZ2 = (kMax - 1) * TILE;
  const jWest = -7;          // dernière dalle ouest des avenues
  const jEast = 3;           // dernière dalle est des avenues
  const avenueXMin = roadX + jWest * TILE;
  const avenueXMax = roadX + jEast * TILE;

  // artère principale (nord-sud)
  for(let k=kMin; k<=kMax; k++){
    const z = k * TILE;
    if(k === kMin+1 || k === kMax-1) continue; // dalles laissées aux carrefours
    const key = Math.abs(z) < TILE*0.6 ? 'ROAD_CROSS' : 'ROAD_STRAIGHT';
    placeExt(exteriorStreetGroup, key, {mode:'footprint',target:TILE}, roadX, z, Math.PI/2);
  }
  placeExt(exteriorStreetGroup, 'ROAD_INTERSECTION', {mode:'footprint',target:TILE}, roadX, crossZ, 0);
  placeExt(exteriorStreetGroup, 'ROAD_INTERSECTION', {mode:'footprint',target:TILE}, roadX, crossZ2, 0);

  if(decor){
  // avenues transversales (est-ouest), même grille => raccord parfait aux carrefours
  [crossZ, crossZ2].forEach(cz=>{
    for(let j=jWest; j<=jEast; j++){
      if(j === 0) continue; // carrefour déjà posé
      placeExt(exteriorStreetGroup, 'ROAD_STRAIGHT', {mode:'footprint',target:TILE}, roadX + j*TILE, cz, 0);
    }
  });

  // trottoirs bordant chaque avenue, exactement sur la longueur de la chaussée
  const avenueLen = (jEast - jWest + 1) * TILE;
  const avenueMidX = (avenueXMin + avenueXMax) / 2;
  [crossZ, crossZ2].forEach(cz=>{
    [-1.55, 1.55].forEach(off=>{
      const w = box(avenueLen, 0.08, 1.1, '#5c5568');
      w.position.set(avenueMidX, 0.04, cz + off);
      w.receiveShadow = true;
      exteriorStreetGroup.add(w);
    });
  });

  // lampadaires des avenues (bras tourné vers la chaussée)
  for(let x=avenueXMin+1.6; x<=avenueXMax-1.6; x+=5.2){
    placeStreetlight(x, crossZ2 - 1.6, 'z+', true);
    placeStreetlight(x + 2.6, crossZ2 + 1.6, 'z-', false);
    placeStreetlight(x, crossZ + 1.6, 'z-', true);
    placeStreetlight(x + 2.6, crossZ - 1.6, 'z+', false);
  }

  }

  // helper : rien ne doit être posé sur une chaussée
  const ROAD_HALF = TILE/2 + 1.0;
  const onRoad = (x, z, radius)=>{
    const r = radius + ROAD_HALF;
    if(Math.abs(x - roadX) < r) return true;                       // artère principale
    if(x > avenueXMin - r && x < avenueXMax + r &&
       (Math.abs(z - crossZ) < r || Math.abs(z - crossZ2) < r)) return true; // avenues
    return false;
  };

  if(decor){
  // pâté d'immeubles derrière les maisons + gratte-ciels en fond de décor.
  // On cale les immeubles sur leur EMPRISE (pas leur hauteur) : sinon le modèle
  // est agrandi uniformément et devient une caisse géante hors d'échelle.
  const blockKeys = ['CITY_A','CITY_B','CITY_C','CITY_D','CITY_E','CITY_F','CITY_G'];
  let bi = 0;
  const placeBlock = (x, z, target, rot)=>{
    if(onRoad(x, z, target/2)) return;
    placeExt(exteriorStreetGroup, blockKeys[bi++ % blockKeys.length], {mode:'footprint', target}, x, z, rot);
  };
  for(let z=zMin+1; z<=zMax; z+=4.2){
    placeBlock(-21.5 + Math.random()*0.8, z + Math.random()*0.5, 3.4 + Math.random()*0.8, Math.PI/2 + (Math.random()*0.16-0.08));
  }
  for(let z=zMin+2; z<=zMax; z+=5.0){
    placeBlock(-26.5 + Math.random()*1.0, z, 3.8 + Math.random()*1.0, Math.PI/2);
  }
  const skyKeys = ['CITY_SKY_A','CITY_SKY_B','CITY_SKY_C','CITY_SKY_D'];
  skyKeys.forEach((k,i)=>{
    placeExt(exteriorStreetGroup, k, {mode:'footprint', target: 4.5 + (i%2)*1.2}, -33 - (i%2)*4.5, zMin + 4 + i*8, Math.PI/2);
  });
  // immeubles bordant les avenues transversales, en retrait des chaussées
  for(let x=avenueXMin+1.5; x<=avenueXMax-3.5; x+=4.0){
    placeBlock(x, crossZ - 4.2 - Math.random()*0.6, 3.2 + Math.random()*0.8, Math.PI);
    placeBlock(x + 2.0, crossZ2 + 4.2 + Math.random()*0.6, 3.2 + Math.random()*0.8, 0);
  }
  // quelques immeubles côté est, bien en retrait derrière la ruelle
  for(let z=zMin+3; z<=zMax-2; z+=4.8){
    placeBlock(18.5 + Math.random()*1.2, z, 3.2 + Math.random()*0.9, -Math.PI/2);
  }


  // roadworks on the far end — breaks the perfectly regular street
  placeExt(exteriorStreetGroup, 'BARRIER', {mode:'footprint',target:1.5}, roadX-0.7, zMin+2.2, 0.2);
  placeExt(exteriorStreetGroup, 'CONE_WORK', {mode:'height',target:0.5}, roadX-0.2, zMin+3.0, 0);
  placeExt(exteriorStreetGroup, 'CONE_WORK', {mode:'height',target:0.5}, roadX+0.3, zMin+3.6, 0);
  }

  // sidewalk (flat light strip, procedural — no dedicated sidewalk-only model chosen)
  const walk = box(2.6, 0.08, (zMax-zMin)+4, '#5c5568');
  walk.position.set(sidewalkX, 0.04, 0);
  walk.receiveShadow = true;
  exteriorStreetGroup.add(walk);

  if(decor){
  // streetlights along the sidewalk — arm always overhangs the road (-x side)
  let slIndex = 0;
  const lampX = sidewalkX - 1.0; // mast on the road-side edge of the sidewalk
  for(let z=zMin; z<=zMax; z+=4.8){
    if(Math.abs(z - crossZ) < 2.4 || Math.abs(z - crossZ2) < 2.4) continue;
    placeStreetlight(lampX, z, 'x-', slIndex%2===0);
    slIndex++;
  }


  // houses + trees + fences across the street
  const houseKeys = ['HOUSE_A','HOUSE_E','HOUSE_J'];
  let hi = 0;
  for(let z=zMin; z<=zMax; z+=3.4){
    if(onRoad(houseX, z, 1.6)) continue;
    const key = houseKeys[hi % houseKeys.length]; hi++;
    const jitter = (Math.random()*0.6-0.3);
    placeExt(exteriorStreetGroup, key, {mode:'height',target:1.8}, houseX+jitter, z, Math.PI);
    if(Math.random()<0.6){
      placeExt(exteriorStreetGroup, Math.random()<0.5?'TREE_LARGE':'TREE_SMALL', {mode:'height',target:1.3}, houseX+1.9, z+1.0, 0);
    }
    // low fence marking each little yard
    placeExt(exteriorStreetGroup, 'FENCE', {mode:'footprint',target:1.4}, houseX+1.0, z-1.6, Math.PI/2);
  }
  // planters near the building's sidewalk edge
  for(let z=zMin+1; z<=zMax; z+=5.6){
    if(onRoad(sidewalkX+1.0, z, 0.4)) continue;
    placeExt(exteriorStreetGroup, 'PLANTER', {mode:'height',target:0.55}, sidewalkX+1.0, z, 0);
  }

  // four pedestrians strolling the sidewalk, varied pace and lane
  const pedRoster = [['PED_MALE',-0.55],['PED_FEMALE',-0.15],['PED_MALE2',0.25],['PED_FEMALE2',0.65]];
  pedRoster.forEach(([key,laneOffset],i)=>{
    const startZ = zMin + 2 + i*((zMax-zMin-4)/pedRoster.length);
    const pDir = i%2===0 ? 1 : -1;
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'height',target:1.3}, sidewalkX+laneOffset, startZ, pDir>0?0:Math.PI);
    if(wrap){
      wrap.userData.noEdit = true;
      pedestrians.push({wrap, body:charBody(wrap), z:startZ, dir: pDir, speed: 0.45+Math.random()*0.35, zMin: zMin+1, zMax: zMax-1});
    }
  });

  // a handful of cars driving up and down the road, each in its own lane direction
  const carRoster = ['CAR_SEDAN','CAR_TAXI','CAR_HATCH','CAR_SUV','CAR_SPORT','CAR_DELIVERY','CAR_GARBAGE'];
  for(let i=0;i<4;i++){
    const key = carRoster[i % carRoster.length];
    const dir = i%2===0 ? 1 : -1;
    const laneX = roadX + (dir>0 ? roadLaneOffset : -roadLaneOffset);
    const startZ = zMin + (i/4)*(zMax-zMin);
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'footprint',target:1.05}, laneX, startZ, dir>0?0:Math.PI);
    if(wrap){
      wrap.userData.noEdit = true;
      cars.push({wrap, z:startZ, dir, speed: 2.6+Math.random()*1.4, zMin:zMin-2, zMax:zMax+2, x:laneX});
    }
  }

  }

  /* ---------- sol du quartier ---------- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(130, (zMax-zMin)+40),
    new THREE.MeshStandardMaterial({color:'#4c4660', roughness:0.95})
  );
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; ground.receiveShadow = true;
  exteriorStreetGroup.add(ground);

  if(decor){
  /* ---------- trottoir devant l'arcade + file d'attente ---------- */
  const queueX = -6.4;
  for(let i=0;i<5;i++){
    const key = ['PED_MALE','PED_FEMALE','PED_MALE2','PED_FEMALE2'][i%4];
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'height',target:1.3}, queueX + (i%2?0.35:-0.2), -2.6 + i*0.85, Math.PI/2);
    if(wrap) wrap.userData.noEdit = true;
    if(wrap) extMovers.push({type:'queue', wrap, base:wrap.position.y, phase:Math.random()*6.28});
  }
  // barrières lumineuses au sol devant l'entrée (flaques de néon)
  [-2.2, 0, 2.2].forEach((z,i)=>{
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.7+Math.random()*0.4, 18),
      new THREE.MeshStandardMaterial({color: i%2 ? '#2fd4c8':'#ff2e88', roughness:0.15, metalness:0.6,
        transparent:true, opacity:0.28, emissive: i%2 ? 0x2fd4c8:0xff2e88, emissiveIntensity:0.25})
    );
    puddle.rotation.x = -Math.PI/2; puddle.position.set(sidewalkX+0.4, 0.09, z);
    exteriorStreetGroup.add(puddle);
  });

  }

  /* ---------- ruelle arrière (côté est) : porte de service clandestine ---------- */
  const alleyX = 7.4;
  const alleyFloor = box(3.4, 0.06, (zMax-zMin)*0.8, '#1d1a26');
  alleyFloor.position.set(alleyX, 0.03, 0); alleyFloor.receiveShadow = true;
  exteriorStreetGroup.add(alleyFloor);
  // (plus de mur de fond isolé : il flottait à côté du bâtiment)

  if(decor){
  // (graffitis retirés avec le mur : ils flottaient dans le vide)

  placeExt(exteriorStreetGroup, 'DUMPSTER', {mode:'height',target:0.9}, alleyX-0.4, -3.2, Math.PI/2);
  placeExt(exteriorStreetGroup, 'DUMPSTER', {mode:'height',target:0.9}, alleyX+0.6, 4.1, -Math.PI/2);
  [[-2.2,-1.4],[0.6,2.6],[1.2,-5.4]].forEach(([dx,z])=>{
    placeExt(exteriorStreetGroup, 'TRASHBAG', {mode:'height',target:0.45}, alleyX+dx*0.4, z, Math.random()*6);
  });
  placeExt(exteriorStreetGroup, 'CRATE', {mode:'height',target:0.5}, alleyX+0.9, -1.0, 0.4);
  placeExt(exteriorStreetGroup, 'CRATE', {mode:'height',target:0.5}, alleyX+1.2, -0.5, 1.1);
  placeExt(exteriorStreetGroup, 'BARREL', {mode:'height',target:0.75}, alleyX-0.9, 6.2, 0);
  // néon "SORTIE" au-dessus de la porte de service + fumée d'égout
  const alleyNeon = placeExt(exteriorStreetGroup, 'NEON_TUBE', {mode:'height',target:0.14}, alleyX-1.4, 0.2, 0);
  if(alleyNeon){ alleyNeon.position.y = 2.3; extFlickers.push({obj:alleyNeon, phase:Math.random()*6.28, speed:5.5}); }
  const alleyLight = registerNightHalo(makeGlowSprite('#2fd4c8', 1.2), 0.8);
  alleyLight.position.set(alleyX-1.4, 2.3, 0.2);
  exteriorStreetGroup.add(alleyLight);
  // chat de ruelle qui rôde
  const cat = placeExt(exteriorStreetGroup, 'CAT', {mode:'height',target:0.22}, alleyX, -1, 0);
  if(cat) extMovers.push({type:'cat', wrap:cat, z:-1, dir:1, speed:0.9, zMin:-6, zMax:6, x:alleyX});

  /* ---------- parking latéral (côté nord) ---------- */
  const parkZ = zMin + 2.2;
  const lot = box(9, 0.06, 5, '#2a2635');
  lot.position.set(1.5, 0.03, parkZ - 1.5); lot.receiveShadow = true;
  exteriorStreetGroup.add(lot);
  for(let i=0;i<4;i++){
    const line = box(0.08, 0.02, 2.2, '#d8d2c0');
    line.position.set(-1.6 + i*2.0, 0.08, parkZ - 1.4);
    exteriorStreetGroup.add(line);
  }
  ['CAR_SEDAN','CAR_HATCH','CAR_SUV'].forEach((key,i)=>{
    placeExt(exteriorStreetGroup, key, {mode:'footprint',target:1.05}, -0.6 + i*2.0, parkZ - 1.4, 0);
  });
  placeExt(exteriorStreetGroup, 'BIKE', {mode:'height',target:0.55}, -4.2, parkZ + 0.6, 0.6);
  placeExt(exteriorStreetGroup, 'BIKE', {mode:'height',target:0.55}, -4.6, parkZ + 1.1, -0.3);

  /* ---------- coin snack / arrêt de bus (côté sud) ---------- */
  const southZ = zMax - 2.4;
  placeExt(exteriorStreetGroup, 'HOTDOG_STAND', {mode:'height',target:1.7}, sidewalkX + 0.6, southZ - 2.0, Math.PI/2);
  const vendor = placeExt(exteriorStreetGroup, 'PED_MALE2', {mode:'height',target:1.3}, sidewalkX + 0.1, southZ - 2.0, Math.PI/2);
  if(vendor) extMovers.push({type:'queue', wrap:vendor, base:vendor.position.y, phase:1.2});
  placeExt(exteriorStreetGroup, 'BUS_STOP', {mode:'height',target:2.0}, sidewalkX - 0.2, southZ + 1.4, Math.PI/2);
  ['PED_FEMALE','PED_MALE'].forEach((key,i)=>{
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'height',target:1.3}, sidewalkX - 0.9, southZ + 0.8 + i*1.1, -Math.PI/2);
    if(wrap) extMovers.push({type:'queue', wrap, base:wrap.position.y, phase:i*2.1});
  });
  placeExt(exteriorStreetGroup, 'PHONE_BOOTH', {mode:'height',target:2.0}, sidewalkX + 0.8, southZ + 3.6, Math.PI/2);
  placeExt(exteriorStreetGroup, 'MAILBOX', {mode:'height',target:0.9}, sidewalkX + 0.9, parkZ + 3.0, Math.PI/2);
  placeExt(exteriorStreetGroup, 'HYDRANT', {mode:'height',target:0.5}, sidewalkX + 1.1, -0.8, 0);

  /* ---------- bancs et détails le long du trottoir ---------- */
  for(let z=zMin+3; z<=zMax-3; z+=7.2){
    placeExt(exteriorStreetGroup, 'BENCH_EXT', {mode:'height',target:0.7}, sidewalkX - 0.6, z, Math.PI/2);
  }

  /* ---------- commerces voisins de l'autre côté de la rue ---------- */
  const shopColors = ['#ffd23f','#2fd4c8','#ff2e88','#8b5cf6'];
  for(let i=0;i<4;i++){
    const z = zMin + 3 + i*((zMax-zMin-6)/3);
    placeExt(exteriorStreetGroup, 'SHOPFRONT', {mode:'height',target:2.8}, -13.2, z, Math.PI/2);
    const tube = placeExt(exteriorStreetGroup, 'NEON_TUBE', {mode:'height',target:0.14}, -12.0, z, Math.PI/2);
    if(tube){
      tube.position.y = 2.0;
      tube.traverse(o=>{ if(o.isMesh && o.material){ o.material = o.material.clone(); o.material.color.set(shopColors[i]); if(o.material.emissive) o.material.emissive.set(shopColors[i]); } });
      extFlickers.push({obj:tube, phase:i*1.7, speed:3+Math.random()*4});
    }
    const halo = registerNightHalo(makeGlowSprite(shopColors[i], 1.3), 0.85);
    halo.position.set(-12.0, 2.0, z);
    exteriorStreetGroup.add(halo);
  }
  placeExt(exteriorStreetGroup, 'BILLBOARD', {mode:'height',target:3.4}, -12.6, zMin + 0.5, Math.PI/2);

  /* ---------- pigeons qui picorent devant l'entrée ---------- */
  for(let i=0;i<5;i++){
    const px = sidewalkX + 0.2 + Math.random()*1.4;
    const pz = -4 + Math.random()*8;
    const wrap = placeExt(exteriorStreetGroup, 'PIGEON', {mode:'height',target:0.16}, px, pz, Math.random()*6.28);
    if(wrap) extMovers.push({type:'pigeon', wrap, x:px, z:pz, t:Math.random()*10, nextHop:1+Math.random()*2.5});
  }

  }

  /* ---------- voiture de patrouille (visible quand la suspicion monte) ---------- */
  // on privilégie le vrai modèle Kenney (city kit) et on lui greffe le gyrophare
  const patrol = placeExt(exteriorStreetGroup, 'CAR_POLICE_M', {mode:'footprint',target:1.05}, roadX - roadLaneOffset, zMax, Math.PI);
  if(patrol){
    patrol.userData.noEdit = true;
    const carObj = patrol.children[0];
    if(carObj && !carObj.userData.beacons){
      const bb = new THREE.Box3().setFromObject(carObj);
      const topY = bb.max.y + 0.02;
      const bar = box(0.5,0.09,0.16,'#101010'); bar.position.set(0,topY+0.05,-0.05); carObj.add(bar);
      const bl = box(0.2,0.09,0.14,'#3f6fae',{emissive:0x2f6fff,emissiveIntensity:1.4}); bl.position.set(-0.14,topY+0.05,-0.05); carObj.add(bl);
      const br = box(0.2,0.09,0.14,'#c92a2a',{emissive:0xff2020,emissiveIntensity:1.4}); br.position.set(0.14,topY+0.05,-0.05); carObj.add(br);
      carObj.userData.beacons = [bl, br];
    }
    patrolCar = {wrap:patrol, z:zMax, dir:-1, speed:2.2, zMin:zMin-2, zMax:zMax+2};
    patrol.visible = false;
  }

  // les figurants animés ne sont pas éditables (ils bougent tout seuls)
  [...pedestrians, ...cars, ...extMovers].forEach(m=>{ if(m && m.wrap) m.wrap.userData.noEdit = true; });
  applyStreetOverrides();
  syncHoodLife();
}


// building shell — rebuilt whenever the arcade's stage or footprint changes
function buildExteriorBuilding(stageIdx, cols, rows){
  while(exteriorBuildingGroup.children.length) exteriorBuildingGroup.remove(exteriorBuildingGroup.children[0]);
  const st = STAGES[stageIdx];
  const casino = st.theme==='casino';
  const w = cols*CELL, d = rows*CELL;
  const wallCol = casino ? PAL.casinoWallDark : PAL.wallDark;
  const stripeCol = casino ? PAL.casinoGold : PAL.wallOrange;
  const bodyH = 2.6 + stageIdx*0.3;

  // plinth (foundation strip, gives the building a grounded base instead of floating)
  const plinth = box(w+0.15, 0.28, d+0.15, '#0e0818');
  plinth.position.set(0, 0.14, 0);
  exteriorBuildingGroup.add(plinth);

  const shell = box(w, bodyH, d, wallCol);
  shell.position.set(0, bodyH/2+0.2, 0);
  exteriorBuildingGroup.add(shell);

  const stripe = box(w+0.05, 0.5, d+0.05, stripeCol);
  stripe.position.set(0, bodyH*0.35+0.2, 0);
  exteriorBuildingGroup.add(stripe);

  // roof cap + parapet trim
  const roof = box(w+0.3, 0.2, d+0.3, casino?'#2a0f18':'#141024');
  roof.position.set(0, bodyH+0.3, 0);
  exteriorBuildingGroup.add(roof);
  const parapet = box(w+0.34, 0.16, d+0.34, casino?PAL.casinoGold:PAL.purple);
  parapet.position.set(0, bodyH+0.44, 0);
  exteriorBuildingGroup.add(parapet);
  // rooftop dressing — évite la grosse dalle violette vue du dessus
  const roofTop = bodyH + 0.52;
  const gravel = box(w-0.2, 0.04, d-0.2, casino?'#3a2430':'#2a2340');
  gravel.position.set(0, roofTop, 0);
  exteriorBuildingGroup.add(gravel);
  const acPos = [[-w*0.3,-d*0.28],[w*0.26,-d*0.3],[-w*0.2,d*0.3],[w*0.32,d*0.12],[-w*0.34,d*0.02],[w*0.06,d*0.32]];
  acPos.forEach(([ax,az],i)=>{
    const unit = box(1.05, 0.6, 0.85, '#4a4358'); unit.position.set(ax, roofTop+0.23, az);
    unit.castShadow = true; exteriorBuildingGroup.add(unit);
    const fan = cyl(0.28,0.28,0.07,'#6b6480'); fan.position.set(ax, roofTop+0.64, az);
    exteriorBuildingGroup.add(fan);
    if(i===0){
      const duct = box(0.32,0.28,d*0.45,'#3c3550'); duct.position.set(ax+0.95, roofTop+0.16, az+d*0.2);
      exteriorBuildingGroup.add(duct);
    }
  });
  // water tank sur pieds
  const tank = cyl(0.6,0.6,1.1, casino?'#5a3a24':'#4a3a5a');
  tank.position.set(w*0.3, roofTop+1.2, d*0.26); tank.castShadow = true;
  exteriorBuildingGroup.add(tank);
  [[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]].forEach(([px,pz])=>{
    const leg = cyl(0.045,0.045,0.55,'#2b2438');
    leg.position.set(w*0.3+px, roofTop+0.27, d*0.26+pz);
    exteriorBuildingGroup.add(leg);
  });
  // cage d'escalier + verrière
  const hatch = box(1.3, 0.8, 1.3, casino?'#3a1c26':'#221a38');
  hatch.position.set(-w*0.05, roofTop+0.42, d*0.05); hatch.castShadow = true;
  exteriorBuildingGroup.add(hatch);
  const sky = box(1.8, 0.06, 1.2, '#7fd6ff', {emissive:0x2a6a88, emissiveIntensity:0.35, opacity:0.85, transparent:true});
  sky.position.set(w*0.05, roofTop+0.06, -d*0.05);
  exteriorBuildingGroup.add(sky);
  // enseigne néon sur le toit — achetable
  if(hasCos('roofneon')){
    const neonBar = box(w*0.5, 0.16, 0.16, casino?PAL.casinoGold:PAL.pink, {emissive: casino?0xffcc55:0xff2f8e, emissiveIntensity:1.1});
    neonBar.position.set(0, roofTop+1.05, -d/2+0.5);
    exteriorBuildingGroup.add(neonBar);
    [-w*0.22, w*0.22].forEach(px=>{
      const mast = cyl(0.05,0.05,1.0,'#2b2438');
      mast.position.set(px, roofTop+0.5, -d/2+0.5);
      exteriorBuildingGroup.add(mast);
    });
  }

  // 🔦 projecteurs de façade : éclairent le mur d'entrée la nuit
  if(hasCos('floodlights')){
    [-d*0.3, d*0.3].forEach(pz=>{
      const mast = cyl(0.06,0.06,1.1,'#2b2438');
      mast.position.set(-w/2-2.2, 0.55, pz);
      exteriorBuildingGroup.add(mast);
      const head = box(0.36,0.28,0.3, '#1b1030', {emissive: casino?0xffcc55:0x66e0ff, emissiveIntensity:0.8});
      head.position.set(-w/2-2.2, 1.2, pz);
      exteriorBuildingGroup.add(head);
      const spot = registerNightLamp(new THREE.SpotLight(casino?0xffd9a0:0x9fe8ff, 0, 18, 0.55, 0.5, 1.1), 3.2);
      spot.position.set(-w/2-2.2, 1.25, pz);
      spot.target.position.set(-w/2+0.2, 2.2, pz*0.5);
      exteriorBuildingGroup.add(spot);
      exteriorBuildingGroup.add(spot.target);
      const halo = registerNightHalo(makeGlowSprite(casino?'#ffd9a0':'#9fe8ff', 1.1), 0.7);
      halo.position.set(-w/2-2.2, 1.25, pz);
      exteriorBuildingGroup.add(halo);
    });
  }




  // facade windows on the street-facing (west) wall, skipping the doorway
  const doorRow = Math.floor(rows/2);
  const doorZ = (doorRow - rows/2 + 0.5)*CELL;
  for(let r=0;r<rows;r++){
    if(r===doorRow) continue;
    const z = (r - rows/2 + 0.5)*CELL;
    const frame = box(0.55, 0.75, 0.08, '#1a1024');
    frame.position.set(-w/2-0.02, bodyH*0.55+0.2, z);
    exteriorBuildingGroup.add(frame);
    const glass = box(0.44, 0.6, 0.03, casino?'#4a2818':'#152436', {transparent:true, opacity:0.65, roughness:0.2, metalness:0.3});
    glass.position.set(-w/2+0.02, bodyH*0.55+0.2, z);
    exteriorBuildingGroup.add(glass);
  }

  // ---- vitrines d'entrée : vitres condamnées tant qu'elles ne sont pas rénovées
  const winColors = ['#ff2e88','#00f3ff','#ffd23f','#8b5cf6'];
  const lit = hasCos('showcase');
  [doorZ-1.55, doorZ+1.55].forEach((wz, side)=>{
    // encadrement
    const frame = box(0.14, 1.9, 2.5, casino?'#3a2010':'#1b1030');
    frame.position.set(-w/2-0.05, 1.25, wz);
    exteriorBuildingGroup.add(frame);
    const glass = lit
      ? box(0.05, 1.65, 2.25, '#9fe9ff', {transparent:true, opacity:0.24, roughness:0.05, metalness:0.5})
      : box(0.05, 1.65, 2.25, '#2a2438', {transparent:true, opacity:0.9, roughness:0.9});
    glass.position.set(-w/2-0.13, 1.25, wz);
    exteriorBuildingGroup.add(glass);
    if(!lit){
      // planches clouées sur la vitrine du local abandonné
      [-0.35, 0.3].forEach((py,k)=>{
        const plank = box(0.06, 0.2, 2.3, k? '#6b5231':'#7d6039');
        plank.position.set(-w/2-0.19, 1.25+py, wz);
        plank.rotation.x = k ? 0.06 : -0.05;
        exteriorBuildingGroup.add(plank);
      });
      return;
    }
    // bornes d'arcade visibles derrière la vitre
    for(let i=0;i<3;i++){
      const cz = wz - 0.75 + i*0.75;
      const cabCol = winColors[(i+side*2)%winColors.length];
      const cab = box(0.42, 1.15, 0.5, '#1a1230');
      cab.position.set(-w/2+0.18, 0.98, cz);
      exteriorBuildingGroup.add(cab);
      const screen = box(0.04, 0.4, 0.36, cabCol, {emissive:new THREE.Color(cabCol).getHex(), emissiveIntensity:1.2});
      screen.position.set(-w/2-0.04, 1.3, cz);
      exteriorBuildingGroup.add(screen);
      const marq = box(0.05, 0.16, 0.4, '#ffffff', {emissive:0xffffff, emissiveIntensity:0.8});
      marq.position.set(-w/2-0.04, 1.58, cz);
      exteriorBuildingGroup.add(marq);
    }
    // tube néon qui borde la vitrine
    const tubeCol = side ? '#00f3ff' : '#ff2e88';
    [[1.25, 0],[-0.05,0]].forEach(([ty])=>{
      const tube = box(0.07, 0.07, 2.4, tubeCol, {emissive:new THREE.Color(tubeCol).getHex(), emissiveIntensity:1.4});
      tube.position.set(-w/2-0.18, 1.25+ty-0.6+0.6, wz);
      tube.position.y = 1.25 + (ty>0 ? 0.95 : -0.95);
      exteriorBuildingGroup.add(tube);
    });
    const wHalo = registerNightHalo(makeGlowSprite(tubeCol, 2.2), 0.55);
    wHalo.position.set(-w/2-0.5, 1.3, wz);
    exteriorBuildingGroup.add(wHalo);
    if(!isMobile){
      const wLight = new THREE.PointLight(new THREE.Color(tubeCol).getHex(), 0.7, 5, 2);
      wLight.position.set(-w/2-0.7, 1.4, wz);
      exteriorBuildingGroup.add(wLight);
    }
  });

  // ---- petites enseignes néon animées autour de l'entrée (achetables)
  const neonSigns = [];
  const addNeonSign = (text, color, wdt, hgt, y, z, freq)=>{
    const backer = box(0.07, hgt+0.16, wdt+0.16, '#12081c');
    backer.position.set(-w/2-0.16, y, z);
    exteriorBuildingGroup.add(backer);
    const panel = makeSignPanel(text, color, wdt, hgt);
    panel.position.set(-w/2-0.22, y, z);
    panel.rotation.y = -Math.PI/2;
    exteriorBuildingGroup.add(panel);
    const halo = registerNightHalo(makeGlowSprite(color, Math.max(wdt,1)*1.1), 0.6);
    halo.position.set(-w/2-0.42, y, z);
    exteriorBuildingGroup.add(halo);
    neonSigns.push({panel, halo, freq, phase: Math.random()*6.28});
  };
  if(hasCos('entryneons')){
    addNeonSign('OPEN', '#2fd4c8', 1.2, 0.42, 2.15, doorZ-1.6, 1.4);
    addNeonSign('JEUX', '#ffd23f', 1.2, 0.42, 2.15, doorZ+1.6, 1.9);
    addNeonSign('25c', '#ff2e88', 0.8, 0.36, 0.85, doorZ-2.9, 2.6);
    addNeonSign(casino?'VIP':'TOKENS', '#8b5cf6', 1.1, 0.36, 0.85, doorZ+2.9, 2.2);
  }
  exteriorBuildingGroup.userData.neonSigns = neonSigns;


  // ampoules de marquise au-dessus de l'entrée (achetables)
  const bulbs = [];
  if(hasCos('marquee')){
    for(let i=0;i<9;i++){
      const bz = doorZ - 1.6 + i*0.4;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 8),
        new THREE.MeshStandardMaterial({color:0xfff0c0, emissive:0xffcc66, emissiveIntensity:1.4})
      );
      bulb.position.set(-w/2-0.42, 2.62, bz);
      exteriorBuildingGroup.add(bulb);
      bulbs.push(bulb);
    }
  }
  exteriorBuildingGroup.userData.marqueeBulbs = bulbs;


  // a proper detailed entrance doorway instead of a flat marker
  const doorway = buildDoorway(casino, 2.15);
  doorway.position.set(-w/2, 0.2, doorZ);
  doorway.rotation.y = -Math.PI/2;
  exteriorBuildingGroup.add(doorway);
  // auvent d'entrée : fait partie du lot marquise
  if(hasCos('marquee')){
    const doorCanopy = box(0.5, 0.08, 1.3, casino?PAL.casinoGold:PAL.pink);
    doorCanopy.position.set(-w/2-0.3, 2.55, doorZ);
    exteriorBuildingGroup.add(doorCanopy);
    const canopyPoleA = cyl(0.03,0.03,0.5,'#333333'); canopyPoleA.position.set(-w/2-0.5,2.3,doorZ-0.55); exteriorBuildingGroup.add(canopyPoleA);
    const canopyPoleB = cyl(0.03,0.03,0.5,'#333333'); canopyPoleB.position.set(-w/2-0.5,2.3,doorZ+0.55); exteriorBuildingGroup.add(canopyPoleB);
  }
  // lettre glissée sous la porte : point de départ de l'histoire
  introLetter = null;
  if(!(state && state.storyDone && state.storyDone.includes('intro'))){
    const letter = group();
    const env = box(0.34,0.02,0.24,'#efe6cf'); env.position.y=0.02; letter.add(env);
    const flap = box(0.2,0.02,0.14,'#d9cbab'); flap.position.set(0.02,0.035,0); flap.rotation.y=0.35; letter.add(flap);
    const halo = makeGlowSprite('#fff3c4', 0.6); halo.position.y=0.25; letter.add(halo);
    const tag = makeTagSprite('\u2709 Lire la lettre', '#ffe600');
    tag.position.set(0, 1.15, 0);
    letter.add(tag);
    letter.position.set(-w/2-0.75, 0.21, doorZ+0.15);
    letter.rotation.y = 0.4;
    letter.userData.baseY = letter.position.y;
    letter.userData.halo = halo;
    letter.userData.tag = tag;
    letter.userData.pickable = 'letter';
    exteriorBuildingGroup.add(letter);
    introLetter = letter;
    // planches clouées sur la porte : la boîte est condamnée
    [0.35,0.95].forEach((y,k)=>{
      const plank = box(0.08,0.16,1.5, k? '#6b5231':'#7d6039');
      plank.position.set(-w/2-0.28, 0.9+y, doorZ);
      plank.rotation.x = k ? 0.12 : -0.12;
      exteriorBuildingGroup.add(plank);
    });
  }


  // grande enseigne néon du nom — uniquement une fois achetée
  if(hasCos('facadesign')){
    const signText = (clubBrand.name || 'COSMIC COIN').slice(0,14).toUpperCase();
    const signColor = clubBrand.color;
    const signPanel = makeSignPanel(signText, signColor, 4.2, 1.05);
    signPanel.position.set(-w/2-0.12, bodyH*0.75+0.2, 0);
    signPanel.rotation.y = -Math.PI/2;
    exteriorBuildingGroup.add(signPanel);
    const signBack = box(0.08, 1.15, 4.3, '#150a1e');
    signBack.position.set(-w/2-0.06, bodyH*0.75+0.2, 0);
    exteriorBuildingGroup.add(signBack);
    const signGlow = new THREE.PointLight(casino?0xffd23f:0xff2e88, 1.2, 10, 2);
    signGlow.position.set(-w/2-0.8, bodyH*0.75+0.2, 0);
    exteriorBuildingGroup.add(signGlow);
    const signHalo = registerNightHalo(makeGlowSprite(signColor, 2.6), 0.8);
    signHalo.position.set(-w/2-0.5, bodyH*0.75+0.2, 0);
    exteriorBuildingGroup.add(signHalo);
    exteriorBuildingGroup.userData.signHalo = signHalo;
  } else {
    exteriorBuildingGroup.userData.signHalo = null;
  }


  // warm porch light over the door
  const doorGlow = new THREE.PointLight(0xffd9a0, 0.8, 4, 2);
  doorGlow.position.set(-w/2-0.4, 2.0, doorZ);
  exteriorBuildingGroup.add(doorGlow);
  const doorHalo = registerNightHalo(makeGlowSprite('#ffd9a0', 1.0), 0.8);
  doorHalo.position.copy(doorGlow.position);
  exteriorBuildingGroup.add(doorHalo);

}

let exteriorMode = false;
const interiorCamSave = {theta:orbit.theta, phi:orbit.phi, radius:orbit.radius, target:orbit.target.clone()};
function setExteriorMode(on){
  exteriorMode = on;
  roomGroup.visible = !on;
  machinesGroup.visible = !on;
  customersGroup.visible = !on;
  exteriorGroup.visible = on;
  const btn = document.getElementById('exteriorBtn');
  if(on){
    interiorCamSave.theta = orbit.theta; interiorCamSave.phi = orbit.phi;
    interiorCamSave.radius = orbit.radius; interiorCamSave.target.copy(orbit.target);
    interiorCamSave.bg = scene.background.clone(); interiorCamSave.fog = scene.fog.color.clone();
    interiorCamSave.fogNear = scene.fog.near; interiorCamSave.fogFar = scene.fog.far;
    const {cols,rows} = state.dims;
    // vue 3/4 depuis la rue : on voit la façade, le trottoir animé, la ruelle
    // arrière et le parking dans le même cadre
    orbit.target.set(-4.5, 1.6, 0);
    orbit.theta = -Math.PI/2 - 0.6; orbit.phi = 1.2;
    orbit.radius = 26 + Math.max(cols,rows)*0.9;
    // dusk sky so the streetlights and neon signs read clearly as a "living city at night"
    scene.background.set(0x0e1230);
    scene.fog.color.set(0x0e1230);
    // brume repoussée : le quartier entier reste lisible depuis la rue
    scene.fog.near = 55; scene.fog.far = isMobile?150:190;
    // le quartier de nuit doit rester lisible sans écraser les néons
    ambientLight.intensity = 2.6;
    streetMoon.visible = true;
    btn.innerText = '🏠 INTÉRIEUR';
    closeMachineMenu();
  } else {
    orbit.theta = interiorCamSave.theta; orbit.phi = interiorCamSave.phi;
    orbit.radius = interiorCamSave.radius; orbit.target.copy(interiorCamSave.target);
    if(interiorCamSave.bg) scene.background.copy(interiorCamSave.bg);
    if(interiorCamSave.fog) scene.fog.color.copy(interiorCamSave.fog);
    if(interiorCamSave.fogFar){ scene.fog.near = interiorCamSave.fogNear; scene.fog.far = interiorCamSave.fogFar; }
    ambientLight.intensity = 0.9;
    streetMoon.visible = false;
    btn.innerText = '🏙️ EXTÉRIEUR';
  }
  updateCamera();
  refreshHoodUI();
  if(typeof refreshStyleUI === 'function') refreshStyleUI();
}
document.getElementById('exteriorBtn').onclick = ()=> setExteriorMode(!exteriorMode);

/* ============================================================
   ÉDITEUR DE QUARTIER — le joueur pose routes, maisons, immeubles…
   ============================================================ */
const HOOD_KEY = 'cc_hood_v1';
const HOOD_ITEMS = [
  {id:'roadauto',  label:'🛣️ Route auto',   key:'ROAD_STRAIGHT',    spec:{mode:'footprint',target:2.3}, snap:2.3, auto:true},
  {id:'road',      label:'➖ Route droite', key:'ROAD_STRAIGHT',    spec:{mode:'footprint',target:2.3}, snap:2.3},
  {id:'roadcross', label:'🚸 Passage',      key:'ROAD_CROSS',       spec:{mode:'footprint',target:2.3}, snap:2.3},
  {id:'roadbend',  label:'↩️ Virage',       key:'ROAD_BEND',        spec:{mode:'footprint',target:2.3}, snap:2.3},
  {id:'roadinter', label:'✚ Carrefour',     key:'ROAD_INTERSECTION',spec:{mode:'footprint',target:2.3}, snap:2.3},
  {id:'sidewalk',  label:'🧱 Trottoir',     key:'ROAD_SIDE',        spec:{mode:'footprint',target:2.3}, snap:2.3},
  {id:'house_a',   label:'🏡 Maison',       key:'HOUSE_A',          spec:{mode:'height',target:1.8}},
  {id:'house_e',   label:'🏘️ Pavillon',    key:'HOUSE_E',          spec:{mode:'height',target:1.8}},
  {id:'house_j',   label:'🏚️ Vieille maison', key:'HOUSE_J',       spec:{mode:'height',target:1.8}},
  {id:'city_a',    label:'🏢 Immeuble A',   key:'CITY_A',           spec:{mode:'footprint',target:4.2}},
  {id:'city_b',    label:'🏢 Immeuble B',   key:'CITY_B',           spec:{mode:'footprint',target:4.2}},
  {id:'city_c',    label:'🏢 Immeuble C',   key:'CITY_C',           spec:{mode:'footprint',target:4.2}},
  {id:'city_f',    label:'🏬 Commerce',     key:'CITY_F',           spec:{mode:'footprint',target:4.0}},
  {id:'sky_a',     label:'🌆 Gratte-ciel',  key:'CITY_SKY_A',       spec:{mode:'footprint',target:5.0}},
  {id:'sky_c',     label:'🌇 Tour',         key:'CITY_SKY_C',       spec:{mode:'footprint',target:5.0}},
  {id:'shop',      label:'🛍️ Boutique néon', key:'SHOPFRONT',       spec:{mode:'height',target:2.8}},
  {id:'bank',      label:'🏦 Banque',       key:'BANK_BUILDING',    spec:{mode:'height',target:3.6}},
  {id:'lamp',      label:'💡 Lampadaire',   key:'STREETLIGHT',      spec:{mode:'height',target:2.9}},
  {id:'tree',      label:'🌳 Arbre',        key:'TREE_LARGE',       spec:{mode:'height',target:1.5}},
  {id:'planter',   label:'🪴 Jardinière',   key:'PLANTER',          spec:{mode:'height',target:0.55}},
  {id:'fence',     label:'🚧 Clôture',      key:'FENCE',            spec:{mode:'footprint',target:1.4}},
  {id:'bench',     label:'🪑 Banc',         key:'BENCH_EXT',        spec:{mode:'height',target:0.7}},
  {id:'phone',     label:'☎️ Cabine',       key:'PHONE_BOOTH',      spec:{mode:'height',target:2.0}},
  {id:'car',       label:'🚗 Voiture',      key:'CAR_SEDAN',        spec:{mode:'footprint',target:1.05}},
  {id:'taxi',      label:'🚕 Taxi',         key:'CAR_TAXI',         spec:{mode:'footprint',target:1.05}},
  {id:'van',       label:'🚐 Camionnette',  key:'CAR_VAN',          spec:{mode:'footprint',target:1.05}},
  {id:'wallneon',  label:'💗 Néon mural',   key:'WALL_NEON',        spec:{mode:'height',target:2.4}},
  {id:'neonarrow', label:'➡️ Flèche néon',  key:'NEON_ARROW',       spec:{mode:'height',target:2.4}},
  {id:'graffiti',  label:'🎨 Graffiti',     key:'GRAFFITI',         spec:{mode:'height',target:1.7}},
  {id:'bulbs',     label:'✨ Guirlande',    key:'BULB_STRING',      spec:{mode:'height',target:2.4}},
  {id:'posterext', label:'🖼️ Affiche géante', key:'POSTER_WALL',   spec:{mode:'height',target:1.9}},
  {id:'awning',    label:'⛱️ Store banne',  key:'AWNING',           spec:{mode:'height',target:2.1}},
  {id:'rope',      label:'🚩 Cordon VIP',   key:'VELVET_ROPE',      spec:{mode:'height',target:1.0}},
  {id:'palmneon',  label:'🌴 Palmier néon', key:'PALM_NEON',        spec:{mode:'height',target:2.4}},
  {id:'marquee',   label:'🪧 Enseigne perso', key:'MARQUEE_SIGN',   spec:{mode:'height',target:2.6}},
];
/* prix des éléments du quartier : on paie avec les jetons gagnés */
const HOOD_COST = {
  roadauto:0, road:0, roadcross:0, roadbend:0, roadinter:0, sidewalk:0,
  house_a:60, house_e:60, house_j:45, city_a:110, city_b:110, city_c:110,
  city_f:120, sky_a:200, sky_c:200, shop:90, bank:0, lamp:25, tree:15, planter:10,
  fence:8, bench:12, phone:30, car:40, taxi:45, van:50,
  wallneon:70, neonarrow:55, graffiti:30, bulbs:35, posterext:40,
  awning:60, rope:45, palmneon:65, marquee:150,
};
function hoodCost(id){ return HOOD_COST[id] ?? 20; }
function hoodRefund(id){ return Math.round(hoodCost(id)*0.5); }

let hoodEdit = false;
let hoodSel = null;
let hoodRot = 0;
let hoodErase = false;
let hoodMove = false;      // mode déplacement : on attrape un objet posé puis on le repose
let hoodCarry = null;      // entrée en cours de déplacement
let hoodData = [];   // {id,x,z,rot}

const hoodPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const hoodHit = new THREE.Vector3();

function hoodDef(id){ return HOOD_ITEMS.find(i=>i.id===id); }

/* --- Raccordement automatique des routes (droite / virage / T / carrefour) --- */
const HOOD_TILE = 2.3;
const ROAD_IDS = ['roadauto','road','roadcross','roadbend','roadinter'];
// Directions dans l'ordre N(-Z), E(+X), S(+Z), W(-X)
const DIR_VECT = [[0,-1],[1,0],[0,1],[-1,0]];
// Ouvertures des modèles à rotation 0 (déduites de la géométrie Kenney)
const ROAD_SHAPES = [
  {key:'ROAD_END',       open:[2]},        // cul-de-sac ouvert au sud
  {key:'ROAD_STRAIGHT',  open:[0,2]},      // droite nord-sud
  {key:'ROAD_BEND',      open:[2,3]},      // virage sud-ouest
  {key:'ROAD_TEE',       open:[1,2,3]},    // T (fermé au nord)
  {key:'ROAD_CROSSROAD', open:[0,1,2,3]},  // carrefour
];
function roadCellKey(x,z){ return Math.round(x/HOOD_TILE) + '|' + Math.round(z/HOOD_TILE); }
function roadCellSet(){
  const set = new Set();
  hoodData.forEach(e=>{ if(ROAD_IDS.includes(e.id)) set.add(roadCellKey(e.x,e.z)); });
  if(typeof exteriorStreetGroup !== 'undefined' && exteriorStreetGroup){
    exteriorStreetGroup.children.forEach(w=>{
      const k = w.userData && w.userData.extKey;
      if(k && k.startsWith('ROAD') && k!=='ROAD_SIDE') set.add(roadCellKey(w.position.x, w.position.z));
    });
  }
  return set;
}
function autoRoadPiece(x, z, cells){
  const cx = Math.round(x/HOOD_TILE), cz = Math.round(z/HOOD_TILE);
  const links = DIR_VECT.map(([dx,dz]) => cells.has((cx+dx)+'|'+(cz+dz)));
  const n = links.filter(Boolean).length;
  // isolée : dalle droite nord-sud
  if(n === 0) return {key:'ROAD_STRAIGHT', rot:0};
  // bout de ligne : on garde une droite alignée sur le voisin (pas de cul-de-sac)
  if(n === 1){
    const d = links.indexOf(true);
    return {key:'ROAD_STRAIGHT', rot:(d % 2 === 0) ? 0 : Math.PI/2};
  }
  // deux voisins opposés : droite alignée
  if(n === 2 && links[0] === links[2]){
    return {key:'ROAD_STRAIGHT', rot: links[0] ? 0 : Math.PI/2};
  }
  for(const shape of ROAD_SHAPES){
    if(shape.open.length !== n) continue;
    for(let r=0; r<4; r++){
      // rotation de +r*90° autour de Y : l'ouverture d du modèle vise (d + r) % 4
      const ok = shape.open.every(d => links[(d + r) % 4]);
      if(ok) return {key:shape.key, rot:r * Math.PI/2};
    }
  }
  return {key:'ROAD_STRAIGHT', rot:0};
}


function spawnHood(entry, cells){
  const def = hoodDef(entry.id);
  if(!def) return null;
  let key = def.key, rot = entry.rot || 0;
  if(def.auto){
    const piece = autoRoadPiece(entry.x, entry.z, cells || roadCellSet());
    key = piece.key; rot = piece.rot;
  }
  const wrap = placeExt(hoodGroup, key, def.spec, entry.x, entry.z, rot);
  if(!wrap) return null;
  wrap.position.set(entry.x, def.id.startsWith('road')||def.id==='sidewalk' ? 0.02 : 0, entry.z);
  wrap.rotation.y = rot;
  wrap.userData.hood = entry;
  return wrap;
}
function rebuildHood(){
  while(hoodGroup.children.length) hoodGroup.remove(hoodGroup.children[0]);
  const cells = roadCellSet();
  hoodData.forEach(e=>spawnHood(e, cells));
  syncHoodLife();
}

/* le quartier s'anime au fur et à mesure : des habitants près des maisons,
   des voitures dès qu'une rue fait au moins trois dalles. */
function syncHoodLife(){
  if(typeof state === 'undefined' || !state) return;
  for(let i=pedestrians.length-1;i>=0;i--) if(pedestrians[i].wrap?.userData?.hoodLife) pedestrians.splice(i,1);
  for(let i=cars.length-1;i>=0;i--) if(cars[i].wrap?.userData?.hoodLife) cars.splice(i,1);
  while(hoodLifeGroup.children.length) hoodLifeGroup.remove(hoodLifeGroup.children[0]);
  if(state.cityDecor) return;   // ancienne ville : ses figurants sont déjà là

  const homes = hoodData.filter(e=>/^(house|city|sky|shop)/.test(e.id));
  const nPed = Math.min(6, Math.floor(homes.length/2));
  for(let i=0;i<nPed && homes.length;i++){
    const h = homes[(i*3) % homes.length];
    const key = ['PED_MALE','PED_FEMALE','PED_MALE2','PED_FEMALE2'][i%4];
    const dir = i%2===0 ? 1 : -1;
    const wrap = placeExt(hoodLifeGroup, key, {mode:'height',target:1.3}, h.x + 1.7, h.z, dir>0?0:Math.PI);
    if(!wrap) continue;
    wrap.userData.hoodLife = true; wrap.userData.noEdit = true;
    pedestrians.push({wrap, body:charBody(wrap), z:h.z, dir, speed:0.4+Math.random()*0.3, zMin:h.z-4, zMax:h.z+4});
  }

  // les voitures suivent réellement le tracé des routes (graphe de dalles)
  const cells = roadCellSet();
  const list = [...cells].map(k=>{ const [a,b]=k.split('|'); return [Number(a), Number(b)]; });
  const linked = list.filter(([cx,cz]) => DIR_VECT.some(([dx,dz]) => cells.has((cx+dx)+'|'+(cz+dz))));
  const nCars = Math.min(4, Math.floor(linked.length/3));
  for(let i=0;i<nCars;i++){
    const start = linked[Math.floor(i*linked.length/nCars)];
    const nexts = DIR_VECT.map(([dx,dz],d)=>[start[0]+dx, start[1]+dz, d]).filter(n=>cells.has(n[0]+'|'+n[1]));
    if(!nexts.length) continue;
    const nx = nexts[i % nexts.length];
    const key = ['CAR_SEDAN','CAR_TAXI','CAR_HATCH','CAR_SUV'][i%4];
    const wrap = placeExt(hoodLifeGroup, key, {mode:'footprint',target:1.05}, start[0]*HOOD_TILE, start[1]*HOOD_TILE, 0);
    if(!wrap) continue;
    wrap.userData.hoodLife = true; wrap.userData.noEdit = true;
    cars.push({wrap, cell:[start[0],start[1]], next:[nx[0],nx[1]], from:(nx[2]+2)%4, t:0, speed:1.6+Math.random()*0.8});
  }
}

/* choisit la dalle suivante : tout droit en priorité, demi-tour en cul-de-sac */
function nextRoadCell(car, cells){
  const [cx,cz] = car.cell;
  const opts = DIR_VECT.map(([dx,dz],d)=>({x:cx+dx, z:cz+dz, d}))
    .filter(o=>cells.has(o.x+'|'+o.z));
  if(!opts.length) return null;
  const straight = (car.from + 2) % 4;
  const fwd = opts.filter(o=>o.d !== car.from);
  const pool = fwd.length ? fwd : opts;
  const go = pool.find(o=>o.d === straight && Math.random() < 0.6) || pool[Math.floor(Math.random()*pool.length)];
  return go;
}

function writeHood(){
  try { localStorage.setItem(HOOD_KEY, JSON.stringify(hoodData)); } catch(e){}
}
function readHood(){
  try {
    const raw = localStorage.getItem(HOOD_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(e=>e && hoodDef(e.id)) : [];
  } catch(e){ return []; }
}

function refreshHoodUI(){
  const bar = document.getElementById('hoodBar');
  const panel = document.getElementById('hoodPanel');
  if(!bar || !panel) return;
  bar.style.display = exteriorMode ? 'flex' : 'none';
  panel.style.display = (exteriorMode && hoodEdit) ? 'block' : 'none';
  const toggle = document.getElementById('hoodToggle');
  if(toggle) toggle.classList.toggle('on', hoodEdit);
  const eraseBtn = document.getElementById('hoodErase');
  if(eraseBtn) eraseBtn.classList.toggle('on', hoodErase);
  const moveBtn = document.getElementById('hoodMove');
  if(moveBtn){
    moveBtn.classList.toggle('on', hoodMove);
    moveBtn.innerText = hoodCarry ? '✋ Repose-le' : '✋ Déplacer';
  }
  const rotLbl = document.getElementById('hoodRotVal');
  if(rotLbl) rotLbl.innerText = Math.round(hoodRot*180/Math.PI)+'°';
  panel.querySelectorAll('.hoodItem').forEach(b=>{
    b.classList.toggle('on', b.dataset.id===hoodSel && !hoodErase);
    b.classList.toggle('tooPoor', state.money < hoodCost(b.dataset.id));
  });
  const head = document.getElementById('hoodMoney');
  if(head) head.innerText = `Jetons : ${Math.round(state.money)}¢ — retirer un objet rembourse la moitié.`;
  const arrows = document.getElementById('hoodArrows');
  const editing = !!(exteriorMode && hoodEdit);
  if(arrows) arrows.style.display = editing ? 'grid' : 'none';
  document.body.classList.toggle('hoodEdit', editing);
  if(typeof updateHoodGrid === 'function') updateHoodGrid();
}

function buildHoodPalette(){
  const list = document.getElementById('hoodList');
  if(!list) return;
  list.innerHTML = HOOD_ITEMS.map(i=>{
    const c = hoodCost(i.id);
    return `<button type="button" class="hoodItem" data-id="${i.id}">${i.label}<b class="hoodPrice">${c>0 ? c+'¢' : 'Gratuit'}</b></button>`;
  }).join('');

  list.querySelectorAll('.hoodItem').forEach(b=>{
    b.onclick = ()=>{
      hoodErase = false;
      hoodSel = (hoodSel===b.dataset.id) ? null : b.dataset.id;
      refreshHoodUI();
    };
  });
}

function initHoodEditor(){
  buildHoodPalette();
  hoodData = readHood();
  rebuildHood();
  const t = document.getElementById('hoodToggle');
  if(t) t.onclick = ()=>{ hoodEdit = !hoodEdit; if(!hoodEdit){ hoodSel=null; hoodErase=false; } refreshHoodUI(); };
  const r = document.getElementById('hoodRotate');
  if(r) r.onclick = ()=>{
    hoodRot = (hoodRot + Math.PI/2) % (Math.PI*2);
    const sel = hoodCarry || hoodPick;
    if(sel && !hoodCarry){
      if(sel.kind==='hood'){ sel.entry.rot = hoodRot; writeHood(); rebuildHood(); }
      else { sel.wrap.rotation.y = hoodRot; saveStreetWrap(sel.wrap); }
    }
    refreshHoodUI();
  };
  const e = document.getElementById('hoodErase');
  if(e) e.onclick = ()=>{ hoodErase = !hoodErase; if(hoodErase){ hoodSel = null; hoodMove = false; hoodCarry = null; } refreshHoodUI(); };
  const mv = document.getElementById('hoodMove');
  if(mv) mv.onclick = ()=>{
    hoodMove = !hoodMove;
    if(hoodMove){ hoodErase = false; hoodSel = null; }
    hoodCarry = null;
    refreshHoodUI();
  };
  const rs = document.getElementById('hoodRestore');
  if(rs) rs.onclick = ()=>{
    streetOvr = {}; writeOvr();
    eachStreetWrap(w=>{ w.visible = true; w.userData.hidden = false; });
    hoodPick = null;
    buildExteriorStreet(16);
    updateHoodGrid();
    log("Décor d'origine du quartier remis en place.");
  };
  const wp = document.getElementById('hoodWipe');
  if(wp) wp.onclick = ()=>{
    eachStreetWrap(w=>{
      streetOvr[w.userData.sid] = {del:true};
      w.visible = false; w.userData.hidden = true;
    });
    writeOvr();
    hoodPick = null; hoodCarry = null;
    hoodData = []; writeHood(); rebuildHood();
    updateHoodGrid();
    log("Quartier rasé : terrain vide, à toi de tout reconstruire (↺ Tout remettre pour annuler).");
  };

  const u = document.getElementById('hoodUndo');
  if(u) u.onclick = ()=>{
    if(!hoodData.length) return;
    hoodPick = null; hoodData.pop(); writeHood(); rebuildHood(); updateHoodGrid();
    log("Dernier élément du quartier retiré.");
  };
  const c = document.getElementById('hoodClear');
  if(c) c.onclick = ()=>{
    if(!hoodData.length) return;
    hoodPick = null; hoodData = []; writeHood(); rebuildHood(); updateHoodGrid();
    log("Quartier personnalisé effacé.");
  };
  refreshHoodUI();
}

/* ---------- panneau STYLE : couleurs des murs, détail, sol ---------- */
function applyStyle(){
  writeStyle();
  if(typeof writeSave === 'function') writeSave();
  buildRoom(state.stage);
  refreshStyleUI();
}
function refreshStyleUI(){
  const panel = document.getElementById('stylePanel');
  if(!panel) return;
  panel.style.display = 'block'; // le panneau vit maintenant dans l'onglet Déco de la boutique
  const btn = document.getElementById('styleToggle');
  if(btn) btn.style.display = 'none';

  const w = document.getElementById('styleWall'); if(w) w.value = roomStyle.wall;
  const t1 = document.getElementById('styleTrim'); if(t1) t1.value = roomStyle.trim;
  const t2 = document.getElementById('styleTrim2'); if(t2) t2.value = roomStyle.trim2;
  const f = document.getElementById('styleFloor'); if(f) f.value = roomStyle.floor;
  panel.querySelectorAll('#styleDetails .styleDet').forEach(b=>{
    const id = b.dataset.det;

    const owned = roomStyle.owned.includes(id);
    const price = DETAIL_COST[id] || 0;
    const def = WALL_DETAILS.find(d=>d.id===id); if(!def) return;
    b.classList.toggle('on', id === roomStyle.detail);
    b.classList.toggle('locked', !owned);
    b.innerText = owned ? def.label : `${def.label} · ${price}¢`;
  });
  const bill = document.getElementById('styleCost');
  if(bill) bill.innerText = `Repeindre une surface : ${PAINT_COST}¢ — jetons : ${Math.round(state.money)}¢`;
  if(typeof refreshBrandUI === 'function') refreshBrandUI();
  refreshCosmeticsUI();
}

/* ---------- déco achetable (rien n'est offert : néons, enseignes, affiches) ---------- */
function refreshCosmeticsUI(){
  const list = document.getElementById('cosmoList');
  if(!list) return;
  list.querySelectorAll('.styleDet').forEach(b=>{
    const def = COSMETICS.find(c=>c.id===b.dataset.cos); if(!def) return;
    const owned = hasCos(def.id);
    b.classList.toggle('on', owned);
    b.classList.toggle('locked', !owned);
    b.innerText = owned ? `${def.label} ✓` : `${def.label} · ${def.price}¢`;
  });
  const info = document.getElementById('cosmoInfo');
  if(info){
    const left = COSMETICS.filter(c=>!hasCos(c.id)).length;
    info.innerText = left
      ? `${left} décoration(s) encore à acheter — jetons : ${Math.round(state.money)}¢`
      : `Tout est décoré ! jetons : ${Math.round(state.money)}¢`;
  }
}
function initCosmeticsUI(){
  const list = document.getElementById('cosmoList');
  if(!list) return;
  list.innerHTML = COSMETICS.map(c=>
    `<button type="button" class="styleDet" data-cos="${c.id}">${c.label}</button>`).join('');
  list.querySelectorAll('.styleDet').forEach(b=>{
    b.onclick = ()=>{
      const def = COSMETICS.find(c=>c.id===b.dataset.cos); if(!def) return;
      if(hasCos(def.id)){ log(`« ${def.label} » est déjà installé.`); return; }
      if(!payFor(def.price, `« ${def.label} »`)) { refreshCosmeticsUI(); return; }
      state.cosmetics.push(def.id);
      log(`Déco installée : ${def.label}.`);
      buildRoom(state.stage);
      if(state.dims) buildExteriorBuilding(state.stage, state.dims.cols, state.dims.rows);
      refreshCosmeticsUI();
      if(typeof writeSave === 'function') writeSave();
    };
  });
  refreshCosmeticsUI();
}
let styleOpen = false;

function initStyleUI(){
  const list = document.getElementById('styleDetails');
  if(list){
    list.innerHTML = WALL_DETAILS.map(d=>`<button type="button" class="styleDet" data-det="${d.id}">${d.label}</button>`).join('');
    list.querySelectorAll('.styleDet').forEach(b=>{
      b.onclick = ()=>{
        const id = b.dataset.det;
        if(!roomStyle.owned.includes(id)){
          const price = DETAIL_COST[id] || 0;
          if(!payFor(price, `le style « ${WALL_DETAILS.find(d=>d.id===id).label} »`)) return;
          roomStyle.owned.push(id);
          log(`Style de mur débloqué : ${WALL_DETAILS.find(d=>d.id===id).label}.`);
        }
        roomStyle.detail = id;
        applyStyle();
      };
    });
  }
  // aperçu gratuit pendant qu'on fait glisser, facturé quand on valide la couleur
  const bind = (id, key)=>{
    const el = document.getElementById(id);
    if(!el) return;
    let before = roomStyle[key];
    el.onfocus = ()=>{ before = roomStyle[key]; };
    el.oninput = ()=>{ roomStyle[key] = el.value; buildRoom(state.stage); };
    el.onchange = ()=>{
      const picked = el.value;
      if(picked === before){ return; }
      roomStyle[key] = before;
      if(!payFor(PAINT_COST, 'un coup de peinture')){ applyStyle(); return; }
      roomStyle[key] = picked;
      before = picked;
      applyStyle();
      log(`Surface repeinte pour ${PAINT_COST}¢.`);
    };
  };
  bind('styleWall','wall'); bind('styleTrim','trim'); bind('styleTrim2','trim2'); bind('styleFloor','floor');
  const tog = document.getElementById('styleToggle');
  if(tog) tog.onclick = ()=>{ openShopTab('deco'); };

  const rst = document.getElementById('styleReset');
  if(rst) rst.onclick = ()=>{ roomStyle = {...STYLE_DEFAULT, owned:roomStyle.owned}; applyStyle(); log("Décoration de la salle remise à zéro (les styles achetés restent à toi)."); };
  refreshStyleUI();
}



/* ---------- boutique enseigne : nom de la boîte + couleurs d'enseigne ---------- */
function applyBrandToTitle(){
  const t = document.getElementById('title');
  if(t && t.firstChild) t.firstChild.nodeValue = (clubBrand.name || 'COSMIC COIN').toUpperCase();
}
function rebuildExteriorSign(){
  if(state.dims) buildExteriorBuilding(state.stage, state.dims.cols, state.dims.rows);
  if(typeof rebuildHood === 'function') rebuildHood();
  applyBrandToTitle();
}
function refreshBrandUI(){
  const input = document.getElementById('brandName');
  if(input && document.activeElement !== input) input.value = clubBrand.name;
  const list = document.getElementById('brandSigns');
  if(list){
    list.querySelectorAll('.styleDet').forEach(b=>{
      const def = SIGN_STYLES.find(s=>s.id===b.dataset.sign);
      const owned = clubBrand.owned.includes(def.id);
      b.classList.toggle('on', clubBrand.sign===def.id);
      b.classList.toggle('locked', !owned);
      b.innerText = owned ? def.label : `${def.label} · ${def.price}¢`;
      b.style.borderColor = def.color;
    });
  }
  const info = document.getElementById('brandInfo');
  if(info){
    const cur = `Nom actuel : « ${clubBrand.name} ».`;
    const sign = hasCos('facadesign')
      ? "L'enseigne de la façade affiche ce nom."
      : "⚠️ Achète l'enseigne de façade (déco ci-dessus) pour voir ce nom en néon dehors.";
    const cost = renameCost();
    const price = cost ? `${cost}¢` : 'gratuit (1er baptême)';
    info.innerText = `${cur} ${sign} Renommer : ${price} — jetons : ${Math.round(state.money)}¢`;
  }

}
function initBrandUI(){
  const list = document.getElementById('brandSigns');
  if(list){
    list.innerHTML = SIGN_STYLES.map(s=>`<button type="button" class="styleDet" data-sign="${s.id}">${s.label}</button>`).join('');
    list.querySelectorAll('.styleDet').forEach(b=>{
      b.onclick = ()=>{
        const def = SIGN_STYLES.find(s=>s.id===b.dataset.sign);
        if(!clubBrand.owned.includes(def.id)){
          if(!payFor(def.price, `l'enseigne « ${def.label} »`)) { refreshBrandUI(); return; }
          clubBrand.owned.push(def.id);
          log(`Nouvelle enseigne débloquée : ${def.label}.`);
        }
        clubBrand.sign = def.id;
        writeBrand(); if(typeof writeSave === 'function') writeSave(); rebuildExteriorSign(); refreshBrandUI();
      };
    });
  }
  const save = document.getElementById('brandSave');
  const input = document.getElementById('brandName');
  if(save && input){
    let typed = input.value || '';
    input.oninput = ()=>{ typed = input.value || ''; };
    const doRename = ()=>{
      const val = ((input.value || typed) || '').trim().slice(0,14);
      if(!val){ log("Tape d'abord un nom dans la case avant de valider."); refreshBrandUI(); return; }
      if(val.toUpperCase() === clubBrand.name.toUpperCase()){
        log(`La boîte s'appelle déjà « ${clubBrand.name} ».`); refreshBrandUI(); return;
      }
      const cost = renameCost();
      if(!payFor(cost, 'un changement de nom')){ refreshBrandUI(); return; }
      clubBrand.name = val.toUpperCase();
      clubBrand.named = true;
      typed = clubBrand.name;
      input.value = clubBrand.name;
      writeBrand(); if(typeof writeSave === 'function') writeSave(); rebuildExteriorSign(); refreshBrandUI();
      log(`✅ La boîte s'appelle maintenant « ${clubBrand.name} ».`);
      if(!hasCos('facadesign')) log("Pense à acheter l'enseigne de façade pour afficher ce nom en néon dehors.");
    };
    // pointerdown : évite que le clavier mobile (blur + reflow) avale le clic
    save.onpointerdown = (e)=>{ e.preventDefault(); doRename(); };
    save.onclick = (e)=>{ e.preventDefault(); };
    input.onkeydown = (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); doRename(); input.blur(); } };
  }

  applyBrandToTitle();
  refreshBrandUI();
}

/* ---------- retouches du décor d'origine (déplacer / retirer / remettre) ---------- */
const OVR_KEY = 'cc_hood_ovr_v1';
let streetOvr = {};
try { streetOvr = JSON.parse(localStorage.getItem(OVR_KEY) || '{}') || {}; } catch(e){ streetOvr = {}; }
function writeOvr(){ try { localStorage.setItem(OVR_KEY, JSON.stringify(streetOvr)); } catch(e){} }
function eachStreetWrap(fn){
  exteriorStreetGroup.children.forEach(w=>{ if(w.userData && w.userData.sid) fn(w); });
}
function applyStreetOverrides(){
  eachStreetWrap(w=>{
    const o = streetOvr[w.userData.sid];
    if(!o) return;
    if(o.del){ w.visible = false; w.userData.hidden = true; return; }
    if(typeof o.x === 'number'){ w.position.x = o.x; w.position.z = o.z; }
    if(typeof o.rot === 'number') w.rotation.y = o.rot;
  });
}
function streetFromObject(obj){
  let o = obj;
  while(o){ if(o.userData && o.userData.sid) return o; o = o.parent; }
  return null;
}
function editableHits(){
  const hits = raycaster.intersectObjects([hoodGroup, exteriorStreetGroup], true);
  for(const h of hits){
    const hw = hoodFromObject(h.object);
    if(hw) return {kind:'hood', wrap:hw, entry:hw.userData.hood};
    const sw = streetFromObject(h.object);
    if(sw && !sw.userData.noEdit && sw.visible) return {kind:'street', wrap:sw};
  }
  return null;
}
function saveStreetWrap(w){
  streetOvr[w.userData.sid] = {x:+w.position.x.toFixed(3), z:+w.position.z.toFixed(3), rot:+w.rotation.y.toFixed(3)};
  writeOvr();
}

function hoodFromObject(obj){
  let o = obj;
  while(o){ if(o.userData && o.userData.hood) return o; o = o.parent; }
  return null;
}

/* ---------- damier de l'éditeur : carreaux visibles + case survolée ---------- */
let hoodPick = null;          // élément sélectionné, déplaçable aux flèches
let hoodGridMesh = null;
let hoodGridSnapUsed = 0;
const hoodCell = new THREE.Mesh(
  new THREE.PlaneGeometry(1,1),
  new THREE.MeshBasicMaterial({color:0x2fd4c8, transparent:true, opacity:0.32, depthWrite:false})
);
hoodCell.rotation.x = -Math.PI/2;
hoodCell.position.y = 0.06;
hoodCell.visible = false;
scene.add(hoodCell);

const hoodPickBox = new THREE.Mesh(
  new THREE.PlaneGeometry(1,1),
  new THREE.MeshBasicMaterial({color:0xff3ea5, transparent:true, opacity:0.38, depthWrite:false})
);
hoodPickBox.rotation.x = -Math.PI/2;
hoodPickBox.position.y = 0.07;
hoodPickBox.visible = false;
scene.add(hoodPickBox);

/* ---------- fantôme de pose : l'objet choisi apparaît avant d'être posé ---------- */
const hoodGhostGroup = group();
hoodGhostGroup.visible = false;
scene.add(hoodGhostGroup);
let hoodGhostId = null, hoodGhostRot = null;
function clearHoodGhost(){
  while(hoodGhostGroup.children.length) hoodGhostGroup.remove(hoodGhostGroup.children[0]);
  hoodGhostId = null; hoodGhostRot = null;
  hoodGhostGroup.visible = false;
}
function buildHoodGhost(){
  while(hoodGhostGroup.children.length) hoodGhostGroup.remove(hoodGhostGroup.children[0]);
  const def = hoodDef(hoodSel);
  if(!def) return;
  const wrap = placeExt(hoodGhostGroup, def.key, def.spec, 0, 0, 0);
  if(!wrap) return;
  wrap.rotation.y = def.auto ? 0 : hoodRot;
  wrap.traverse(o=>{
    if(!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const m = src ? src.clone() : new THREE.MeshBasicMaterial();
    m.transparent = true; m.opacity = 0.45; m.depthWrite = false;
    if(m.emissive) m.emissive.setHex(0x2fd4c8);
    o.material = m;
  });
  hoodGhostId = hoodSel; hoodGhostRot = hoodRot;
}
function updateHoodGhost(x, z){
  const active = exteriorMode && hoodEdit && hoodSel && !hoodErase && !hoodMove;
  if(!active || x === undefined || x === null){ hoodGhostGroup.visible = false; return; }
  if(hoodGhostId !== hoodSel || hoodGhostRot !== hoodRot) buildHoodGhost();
  if(!hoodGhostGroup.children.length){ hoodGhostGroup.visible = false; return; }
  const def = hoodDef(hoodSel);
  const snap = (def && def.snap) || 1.15;
  hoodGhostGroup.position.set(Math.round(x/snap)*snap, 0.03, Math.round(z/snap)*snap);
  hoodGhostGroup.visible = true;
}
let hoodGhostPos = null;


/* ---------- aperçu de la case visée à l'intérieur (achat / déplacement) ---------- */
const roomCell = new THREE.Mesh(
  new THREE.PlaneGeometry(CELL*0.92, CELL*0.92),
  new THREE.MeshBasicMaterial({color:0x2fd4c8, transparent:true, opacity:0.3, depthWrite:false})
);
roomCell.rotation.x = -Math.PI/2;
roomCell.position.y = 0.05;
roomCell.visible = false;
scene.add(roomCell);
canvas.addEventListener('pointermove', (e)=>{
  const active = !exteriorMode && !state.paused && (movingMachine || state.selected);
  if(!active){ roomCell.visible = false; return; }
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(roomGroup.children, true);
  if(!hits.length){ roomCell.visible = false; return; }
  const {cols, rows} = state.dims;
  const nx = Math.floor(hits[0].point.x/CELL + cols/2);
  const nz = Math.floor(hits[0].point.z/CELL + rows/2);
  if(nx<0||nx>=cols||nz<0||nz>=rows){ roomCell.visible = false; return; }
  const p = cellToWorld(nx,nz,cols,rows);
  const busy = state.grid[nz][nx] && state.grid[nz][nx] !== movingMachine;
  roomCell.material.color.setHex(busy ? 0xff3ea5 : 0x2fd4c8);
  roomCell.position.set(p.x, 0.05, p.z);
  roomCell.visible = true;
});

function selPos(sel){
  if(!sel) return null;
  return sel.kind==='hood' ? {x:sel.entry.x, z:sel.entry.z} : {x:sel.wrap.position.x, z:sel.wrap.position.z};
}
function selSnap(sel){
  if(!sel) return null;
  if(sel.kind==='hood'){ const d = hoodDef(sel.entry.id); return (d && d.snap) || 1.15; }
  return 1.15;
}
function currentSnap(){
  const sel = hoodCarry || hoodPick;
  if(sel) return selSnap(sel);
  const d = hoodDef(hoodSel);
  return (d && d.snap) || 1.15;
}
function updateHoodGrid(){
  const show = exteriorMode && hoodEdit;
  const snap = currentSnap();
  if(show && (!hoodGridMesh || hoodGridSnapUsed !== snap)){
    if(hoodGridMesh){ scene.remove(hoodGridMesh); hoodGridMesh.geometry.dispose(); }
    const div = 60;
    hoodGridMesh = new THREE.GridHelper(snap*div, div, 0x7cf7ff, 0x2a5a72);
    hoodGridMesh.material.transparent = true;
    hoodGridMesh.material.opacity = 0.45;
    hoodGridMesh.position.y = 0.05;
    hoodGridSnapUsed = snap;
    scene.add(hoodGridMesh);
  }
  if(hoodGridMesh) hoodGridMesh.visible = show;
  if(!show){ hoodCell.visible = false; hoodPickBox.visible = false; hoodGhostGroup.visible = false; return; }
  updateHoodGhost(hoodGhostPos && hoodGhostPos.x, hoodGhostPos && hoodGhostPos.z);

  hoodCell.scale.set(snap*0.94, snap*0.94, 1);
  const p = selPos(hoodPick);
  if(p){
    const ps = selSnap(hoodPick);
    hoodPickBox.scale.set(ps*0.98, ps*0.98, 1);
    hoodPickBox.position.set(p.x, 0.07, p.z);
    hoodPickBox.visible = true;
  } else hoodPickBox.visible = false;
}
function rayToGround(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);
  return raycaster.ray.intersectPlane(hoodPlane, hoodHit) ? hoodHit : null;
}
canvas.addEventListener('pointermove', (e)=>{
  if(!exteriorMode || !hoodEdit){ hoodCell.visible = false; hoodGhostGroup.visible = false; return; }
  const p = rayToGround(e.clientX, e.clientY);
  if(!p){ hoodCell.visible = false; hoodGhostGroup.visible = false; return; }
  const snap = currentSnap();
  hoodCell.position.set(Math.round(p.x/snap)*snap, 0.06, Math.round(p.z/snap)*snap);
  hoodCell.visible = true;
  hoodGhostPos = {x:p.x, z:p.z};
  updateHoodGhost(p.x, p.z);
});


function nudgePick(dx, dz){
  const sel = hoodCarry || hoodPick;
  if(!sel){ log("Choisis d'abord un objet : clique-le en mode ✋ Déplacer."); return; }
  const step = selSnap(sel) / 4;
  if(sel.kind==='hood'){
    sel.entry.x = +(sel.entry.x + dx*step).toFixed(3);
    sel.entry.z = +(sel.entry.z + dz*step).toFixed(3);
    writeHood(); rebuildHood();
  } else {
    sel.wrap.position.x += dx*step;
    sel.wrap.position.z += dz*step;
    saveStreetWrap(sel.wrap);
  }
  updateHoodGrid();
}
function initHoodArrows(){
  const map = {hoodUp:[0,-1], hoodDown:[0,1], hoodLeft:[-1,0], hoodRight:[1,0]};
  Object.entries(map).forEach(([id,[dx,dz]])=>{
    const b = document.getElementById(id);
    if(b) b.onclick = ()=> nudgePick(dx,dz);
  });
  addWin('keydown', (e)=>{
    if(!exteriorMode || !hoodEdit) return;
    const m = {ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0]}[e.key];
    if(!m) return;
    e.preventDefault();
    nudgePick(m[0], m[1]);
  });
}

/* ---------- grand écran : plein écran + masquage de la boutique ---------- */
function initBigScreen(){
  const btn = document.getElementById('bigScreenBtn');
  if(!btn) return;
  const sync = ()=>{
    const on = document.body.classList.contains('bigscreen');
    btn.classList.toggle('on', on);
    btn.innerText = on ? '🗗' : '🗖';
    resize();
  };
  btn.onclick = async ()=>{
    const on = !document.body.classList.contains('bigscreen');
    document.body.classList.toggle('bigscreen', on);
    try {
      if(on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if(!on && document.fullscreenElement) await document.exitFullscreen();
    } catch(err){}
    setTimeout(sync, 60);
  };
  addWin('fullscreenchange', ()=>{
    if(!document.fullscreenElement) document.body.classList.remove('bigscreen');
    sync();
  });
  sync();
}


// cadrage de départ : plan sur la façade condamnée et son enveloppe
function frameAbandonedClub(){
  const portrait = window.innerHeight > window.innerWidth;
  orbit.theta = -Math.PI/2 - 0.9;
  orbit.phi = 1.15;
  orbit.radius = portrait ? 26 : 20;
  orbit.target.set(-5.5, 1.2, 0);
  updateCamera();
}
// clic sur l'enveloppe de Rosa : lance la cinématique d'ouverture
function openIntroLetter(){
  if(!introLetter) return;
  const beat = STORY.find(b=>b.id==='intro');
  if(introLetter.parent) introLetter.parent.remove(introLetter);
  introLetter = null;
  if(!state.storyDone.includes('intro')) state.storyDone.push('intro');
  try{ writeSave(false); }catch(_e){}
  // la porte est déclouée : on reconstruit la façade sans planches ni lettre
  if(state.dims) buildExteriorBuilding(state.stage, state.dims.cols, state.dims.rows);
  if(beat) playCinematic(beat);
}
canvas.addEventListener('click', (e)=>{
  if(!exteriorMode || hoodEdit || !introLetter) return;
  if(dragMoved){ dragMoved = false; return; }
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(introLetter, true);
  if(hits.length){ openIntroLetter(); return; }
  // tolérance tactile : clic proche de l'enveloppe à l'écran
  const p = introLetter.getWorldPosition(new THREE.Vector3()).project(camera);
  const sx = (p.x*0.5+0.5)*rect.width, sy = (-p.y*0.5+0.5)*rect.height;
  const dx = (e.clientX-rect.left)-sx, dy = (e.clientY-rect.top)-sy;
  if(Math.hypot(dx,dy) < 90) openIntroLetter();
});

/* clic sur la banque du quartier (hors mode éditeur) : ouvre le guichet */
canvas.addEventListener('click', (e)=>{
  if(!exteriorMode || hoodEdit) return;
  if(dragMoved){ dragMoved = false; return; }
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(hoodGroup.children, true);
  for(const h of hits){
    const w = hoodFromObject(h.object);
    if(w && w.userData.hood && w.userData.hood.id === 'bank'){
      log('🏦 Guichet de la banque ouvert.');
      openShopTab('bank');
      return;
    }
  }
});

canvas.addEventListener('click', (e)=>{
  if(!exteriorMode || !hoodEdit) return;
  if(dragMoved){ dragMoved = false; return; }
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);

  if(hoodMove){
    if(!hoodCarry){
      const pick = editableHits();
      if(!pick) return;
      hoodCarry = pick;
      hoodPick = pick;
      hoodRot = pick.kind==='hood' ? (pick.entry.rot||0) : pick.wrap.rotation.y;
      refreshHoodUI();
      log("Objet attrapé : clique où tu veux le reposer.");
      return;
    }
    // on le repose à l'endroit cliqué
    if(!raycaster.ray.intersectPlane(hoodPlane, hoodHit)) return;
    const msnap = selSnap(hoodCarry);
    const nx = Math.round(hoodHit.x/msnap)*msnap;
    const nz = Math.round(hoodHit.z/msnap)*msnap;
    if(hoodCarry.kind==='hood'){
      hoodCarry.entry.x = nx; hoodCarry.entry.z = nz; hoodCarry.entry.rot = hoodRot;
      writeHood(); rebuildHood();
    } else {
      hoodCarry.wrap.position.x = nx; hoodCarry.wrap.position.z = nz;
      hoodCarry.wrap.rotation.y = hoodRot;
      saveStreetWrap(hoodCarry.wrap);
    }
    hoodPick = hoodCarry;
    hoodCarry = null;
    refreshHoodUI();
    return;
  }

  if(hoodErase){
    const pick = editableHits();
    if(!pick) return;
    if(pick.kind==='hood'){
      if(hoodPick && hoodPick.entry === pick.entry) hoodPick = null;
      const wasRoad = ROAD_IDS.includes(pick.entry.id);
      hoodData = hoodData.filter(d=>d !== pick.entry);
      hoodGroup.remove(pick.wrap);
      const back = hoodRefund(pick.entry.id);
      if(back>0){
        earnMoney(back, 'refund');
        log(`Objet retiré : +${back}¢ récupérés.`);
      } else log("Élément retiré.");
      if(typeof updateHUD === 'function') updateHUD();
      writeHood();
      // les dalles voisines se rebranchent (virage -> droite, carrefour -> T…)
      if(wasRoad) rebuildHood();

    } else {
      pick.wrap.visible = false;
      pick.wrap.userData.hidden = true;
      streetOvr[pick.wrap.userData.sid] = {del:true};
      writeOvr();
      if(hoodPick && hoodPick.wrap === pick.wrap) hoodPick = null;
      log("Élément du quartier retiré (↺ Tout remettre pour le récupérer).");
    }
    updateHoodGrid();
    return;
  }

  if(!hoodSel) return;
  if(!raycaster.ray.intersectPlane(hoodPlane, hoodHit)) return;
  placeHoodAt(hoodHit.x, hoodHit.z);
});

/* Pose un élément du quartier sur la case visée.
   Les routes remplacent la dalle déjà présente au lieu de s'empiler. */
function placeHoodAt(wx, wz, opts){
  const o = opts || {};
  if(!hoodSel) return false;
  const def = hoodDef(hoodSel);
  if(!def) return false;
  const snap = def.snap || 1.15;
  const entry = {
    id: hoodSel,
    x: Math.round(wx/snap)*snap,
    z: Math.round(wz/snap)*snap,
    rot: hoodRot,
  };
  if(Math.abs(entry.x) > 90 || Math.abs(entry.z) > 90) return false;
  const isRoad = ROAD_IDS.includes(entry.id) || entry.id === 'sidewalk';
  if(isRoad){
    const k = roadCellKey(entry.x, entry.z);
    const dup = hoodData.find(d=>(ROAD_IDS.includes(d.id) || d.id==='sidewalk') && roadCellKey(d.x,d.z)===k);
    if(dup){
      if(dup.id === entry.id && !o.replaceSame) return false;   // déjà la bonne dalle
      hoodData = hoodData.filter(d=>d !== dup);
    }
  }
  if(!payFor(hoodCost(hoodSel), def.label)) return false;
  hoodData.push(entry);
  if(o.defer) return true;
  if(ROAD_IDS.includes(entry.id)) rebuildHood(); else spawnHood(entry);
  hoodPick = {kind:'hood', entry};
  writeHood();
  updateHoodGrid();
  return true;
}

/* ---------- tracé continu des routes : maintiens et glisse ---------- */
let roadDrag = false, roadDragCells = null, roadDragAdded = 0;
function roadPaintable(){
  return exteriorMode && hoodEdit && hoodSel && !hoodErase && !hoodMove
      && (ROAD_IDS.includes(hoodSel) || hoodSel === 'sidewalk');
}
function pointerToGround(e){
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);
  return raycaster.ray.intersectPlane(hoodPlane, hoodHit) ? hoodHit : null;
}
let roadLastCell = null;
function roadPaintCell(cx, cz){
  const k = cx+'|'+cz;
  if(roadDragCells.has(k)) return;
  roadDragCells.add(k);
  if(placeHoodAt(cx*HOOD_TILE, cz*HOOD_TILE, {defer:true})) roadDragAdded++;
}
/* on relie la dernière case peinte à la nouvelle en L (droite puis virage),
   comme ça un glissé rapide ou en diagonale ne laisse jamais de trou */
function roadPaintTo(cx, cz){
  if(!roadLastCell){ roadPaintCell(cx, cz); roadLastCell = [cx, cz]; return; }
  let [px, pz] = roadLastCell;
  let guard = 0;
  while((px !== cx || pz !== cz) && guard++ < 200){
    if(px !== cx) px += Math.sign(cx - px);
    else pz += Math.sign(cz - pz);
    roadPaintCell(px, pz);
  }
  roadLastCell = [cx, cz];
}
function roadPaintAt(e){
  const p = pointerToGround(e);
  if(!p) return;
  const before = roadDragAdded;
  roadPaintTo(Math.round(p.x/HOOD_TILE), Math.round(p.z/HOOD_TILE));
  // aperçu vivant : les virages et carrefours se recalculent pendant le tracé
  if(roadDragAdded !== before && hoodData.length < 500) rebuildHood();
}
canvas.addEventListener('pointerdown', (e)=>{
  if(e.button !== 0 && e.pointerType === 'mouse') return;
  if(!roadPaintable()) return;
  if(pointers.size > 1) return;
  roadDrag = true; roadDragCells = new Set(); roadDragAdded = 0; roadLastCell = null;
  dragging = false; panning = false;         // la caméra ne tourne pas pendant le tracé
  if(tapStart) tapStart.locked = true;
  roadPaintAt(e);
});
addWin('pointermove', (e)=>{ if(roadDrag) roadPaintAt(e); });

function endRoadDrag(){
  if(!roadDrag) return;
  roadDrag = false; roadDragCells = null; roadLastCell = null;
  if(roadDragAdded > 0){
    rebuildHood();
    writeHood();
    updateHoodGrid();
    dragMoved = true;   // le clic qui suit ne repose pas une dalle en double
    log(roadDragAdded > 1 ? `🛣️ ${roadDragAdded} dalles posées d'un trait.` : '🛣️ Dalle posée.');
  }
  roadDragAdded = 0;
}
addWin('pointerup', endRoadDrag);
addWin('pointercancel', endRoadDrag);


/* ---------- panneau lumière (jour / nuit / auto + luminosité) ---------- */
function refreshLightUI(){
  ['day','night','auto'].forEach(m=>{
    const b = document.getElementById('light-'+m);
    if(b) b.classList.toggle('on', lightMode===m);
  });
  const val = document.getElementById('brightVal');
  if(val) val.innerText = Math.round(brightness*100)+'%';
}
function setLightMode(m){
  lightMode = m;
  try { localStorage.setItem('cc_lightmode', m); } catch(e) {}
  refreshLightUI();
  updateDayNight();
}
['day','night','auto'].forEach(m=>{
  const b = document.getElementById('light-'+m);
  if(b) b.onclick = ()=> setLightMode(m);
});
const brightSlider = document.getElementById('brightness');
if(brightSlider){
  brightSlider.value = String(Math.round(brightness*100));
  brightSlider.oninput = ()=>{
    brightness = Number(brightSlider.value)/100;
    renderer.toneMappingExposure = brightness;
    try { localStorage.setItem('cc_brightness', String(brightness)); } catch(e) {}
    refreshLightUI();
  };
}
refreshLightUI();

/* ---------- musique de discothèque ---------- */
const disco = createDiscoAudio();
const musicBtn = document.getElementById('musicBtn');
function refreshMusicUI(){
  if(!musicBtn) return;
  const on = disco.isOn();
  musicBtn.classList.toggle('on', on);
  musicBtn.innerText = on ? '🔊' : '🔈';
  musicBtn.title = on ? 'Couper la musique' : 'Musique disco';
}
if(musicBtn){ musicBtn.onclick = ()=>{ disco.toggle(); refreshMusicUI(); }; }
refreshMusicUI();

/* ---------- rendu léger (placeholders si les GLB ne chargent pas) ---------- */
const lightRenderBtn = document.getElementById('lightRenderBtn');
function refreshRenderUI(){
  if(!lightRenderBtn) return;
  lightRenderBtn.classList.toggle('on', lightRender);
  lightRenderBtn.innerText = lightRender ? '⚡' : '💠';
  lightRenderBtn.title = lightRender
    ? 'Rendu léger actif (placeholders) — cliquer pour les modèles 3D'
    : 'Passer en rendu léger (placeholders, démarrage instantané)';
}
if(lightRenderBtn){
  lightRenderBtn.onclick = ()=>{
    lightRender = !lightRender;
    try { localStorage.setItem('cc_lightrender', lightRender ? '1' : '0'); } catch(e) {}
    refreshRenderUI();
    window.location.reload();
  };
}
refreshRenderUI();


/* ============================================================
   MACHINE DEFS
   ============================================================ */
const MACHINES = [
  {id:'arcade', name:'Borne arcade', color:PAL.teal, price:60, earn:[3,6], time:2200, repReq:0, stageReq:0},
  {id:'pinball', name:'Flipper', color:PAL.pink, price:90, earn:[4,8], time:2600, repReq:0, stageReq:0},
  {id:'vending', name:'Distributeur', color:PAL.red, price:70, earn:[2,4], time:1600, repReq:1, stageReq:0},
  {id:'claw', name:'Machine à pinces', color:PAL.orange, price:110, earn:[5,9], time:3000, repReq:2, stageReq:0},
  {id:'ticket', name:'Comptoir tickets (+8% gains)', color:PAL.yellow, price:100, earn:[0,0], time:0, repReq:2, stageReq:0, passive:true},
  {id:'airhockey', name:'Air hockey', color:PAL.blue, price:140, earn:[6,11], time:3200, repReq:3, stageReq:0},
  {id:'basket', name:'Panier de basket', color:PAL.orange, price:130, earn:[5,10], time:2800, repReq:3, stageReq:0},
  {id:'dance', name:'Machine de danse', color:PAL.purple, price:170, earn:[7,13], time:3400, repReq:5, stageReq:0},
  {id:'gambling', name:'Machine à sous', color:PAL.red, price:200, earn:[8,15], time:3600, repReq:2, stageReq:0, illegal:true},
  {id:'wheel', name:'Roue à prix', color:PAL.yellow, price:190, earn:[7,14], time:3200, repReq:7, stageReq:1},
  {id:'roulette', name:'Roulette', color:PAL.green, price:400, earn:[15,28], time:4200, repReq:6, stageReq:1, illegal:true},
  {id:'poker', name:'Table de poker', color:PAL.green, price:450, earn:[17,32], time:4600, repReq:8, stageReq:1, illegal:true},
  {id:'blackjack', name:'Table de blackjack', color:PAL.green, price:380, earn:[14,26], time:4000, repReq:7, stageReq:1, illegal:true},
  {id:'vip', name:'Table VIP de la Reine', color:'#e8b64a', price:520, earn:[24,42], time:4800, repReq:0, stageReq:0, illegal:true, unlockReq:'vip'},
];
const DECOR = [
  {id:'trash', cat:'arcade', name:'Poubelle', color:PAL.chrome, price:20, repBoost:0.2, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'poster', cat:'arcade', name:'Affiche rétro', color:PAL.pink, price:30, repBoost:0.4, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'plant', cat:'repos', name:'Plante verte', color:PAL.green, price:40, repBoost:0.5, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'cashregister', cat:'arcade', name:'Caisse enregistreuse', color:PAL.red, price:50, repBoost:0.5, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'bench', cat:'repos', name:"Banc d'attente", color:PAL.orange, price:55, repBoost:0.6, repReq:1, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'toilets', cat:'arcade', name:'Toilettes', color:'#cfd6e6', price:90, repBoost:0.9, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'tables', cat:'repos', name:'Table + chaises', color:PAL.teal, price:70, repBoost:0.7, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'dancefloor', cat:'piste', name:'Piste de danse lumineuse', color:'#20e6d0', price:210, repBoost:1.5, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'djdeck', cat:'son', name:'Platine du DJ', color:PAL.pink, price:160, repBoost:1.3, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},

  {id:'neon', cat:'lumieres', name:'Enseigne néon', color:PAL.pink, price:80, repBoost:0.8, repReq:2, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'jukebox', cat:'son', name:'Juke-box de Momo', color:PAL.purple, price:120, repBoost:1.1, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, unlockReq:'jukebox'},
  {id:'safe', cat:'arcade', name:'Coffre planqué (-3 suspicion/jour)', color:PAL.chrome, price:170, repBoost:0.2, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, unlockReq:'safe'},
  {id:'falsewall', cat:'arcade', name:'Faux mur automatique', color:PAL.purpleDark, price:260, repBoost:0.3, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, unlockReq:'falsewall'},
  {id:'bar', cat:'repos', name:'Comptoir de bar', color:'#e8b64a', price:180, repBoost:1.4, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'sofa', cat:'repos', name:'Canapé lounge', color:'#8f1f2e', price:110, repBoost:0.9, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'discoball', cat:'lumieres', name:'Boule à facettes', color:'#cfd6e6', price:140, repBoost:1.2, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'speaker', cat:'son', name:'Enceinte de scène', color:'#141024', price:95, repBoost:0.8, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'wallart', cat:'lumieres', name:'Fresque murale néon', color:'#8b5cf6', price:75, repBoost:0.7, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'floortile', name:'Dalle de piste (bloc)', color:'#ff2e88', price:22, repBoost:0.15, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'piste'},
  {id:'banquette', name:'Banquette lounge', color:'#4a2357', price:95, repBoost:0.8, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'repos'},
  {id:'lowtable', name:'Petite table basse', color:'#e8b64a', price:45, repBoost:0.4, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'repos'},
  {id:'loungelamp', name:'Lampe d\u2019ambiance', color:'#ffcf9a', price:60, repBoost:0.5, repReq:1, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'repos'},
  {id:'movinglight', name:'Projecteur mobile (balayage)', color:'#20e6d0', price:150, repBoost:1.1, repReq:4, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'lumieres'},
  {id:'veloperope', name:'Cordon VIP doré', color:'#e8b64a', price:80, repBoost:0.7, repReq:8, stageReq:0, earn:[0,0], time:0, passive:true, decor:true, cat:'vip'},
  {id:'statue', cat:'vip', name:'Statue dorée', color:PAL.casinoGold||'#e8b64a', price:150, repBoost:1.2, repReq:0, stageReq:2, earn:[0,0], time:0, passive:true, decor:true},
];
const STAFF = [
  {id:'tech', name:'Technicien', desc:'Répare les pannes auto.', price:150, stageReq:0},
  {id:'host', name:'Hôte/hôtesse', desc:'Attire plus de clients', price:180, stageReq:0},
  {id:'security', name:'Agent de sécurité', desc:'Réduit les incidents casino', price:320, stageReq:2},
];

/* ============================================================
   GAME STATE
   ============================================================ */
function freshState(){
  return {
    money:140, rep:0, day:1, debt:400, paused:false, closed:false, stage:0, cityDecor:false,
    grid:null, dims:null, machines:[], customers:[], selected:null,
    extraCols:0, extraRows:0, grime:12, cosmetics:[],


    staff:{tech:false,host:false,security:false},
    logMsgs:[], dayTimer:0, dayLength:26000, spawnTimer:0, spawnEvery:2400, won:false,
    // ---- couche clandestine ----
    backroom:false, suspicion:0, hidden:false, busts:0, raid:null, raidsSurvived:0,
    lookout:false, launderDay:-1, bribeDay:-99, gameOver:false, illegalEarned:0,
    danger:0, doorTimer:0, playMs:0,
    unlocks:[], storyDone:[],
    questIdx:0, questProgress:{}, questsDone:[],
    stats:{earned:0, spent:0, customers:0, machinesBuilt:0, incidents:0, raids:0, busts:0,
           passed:0, refused:0, searched:0, timeMs:0},
    // journal des mouvements de caisse (anti-triche) : tout entre/sort par ici
    ledger:{in:0, out:0, loan:0, repay:0, day:1, dayIn:0},
    scored:false,
  };
}
let state = freshState();

/* ============================================================
   TRÉSORERIE VÉRIFIÉE — journal des transactions + plafonds
   Toute écriture de caisse passe par earnMoney/spendMoney :
   on garde la trace de ce qui est entré et sorti pour pouvoir
   recalculer un solde plausible (sauvegarde bidouillée, double gain…).
   ============================================================ */
const START_MONEY = 140;
function ledger(){
  if(!state.ledger) state.ledger = {in:0, out:0, loan:0, repay:0, day:state.day||1, dayIn:0};
  return state.ledger;
}
/* plafond de gains sur une journée : large pour le jeu normal, infranchissable pour un script */
function dailyEarnCap(){
  return 500 + (state.day|0)*150 + (state.machines?state.machines.length:0)*220 + (state.stage|0)*350;
}
/* borne haute du solde, reconstruite depuis le journal */
function maxPlausibleMoney(){
  const l = ledger();
  return START_MONEY + l.in + l.loan - l.out - l.repay;
}
/* entrée d'argent — kind: 'play' | 'illegal' | 'quest' | 'refund' | 'loan' */
function earnMoney(amount, kind){
  let a = Math.round(Math.max(0, Number(amount) || 0));
  if(!a) return 0;
  const l = ledger();
  if(l.day !== state.day){ l.day = state.day; l.dayIn = 0; }
  const capped = (kind !== 'loan' && kind !== 'refund');
  if(capped){
    const cap = dailyEarnCap();
    if(l.dayIn + a > cap){
      a = Math.max(0, cap - l.dayIn);
      if(a <= 0){
        log("⚠️ Recette du jour plafonnée : la caisse ne peut plus encaisser aujourd'hui.");
        return 0;
      }
    }
    l.dayIn += a;
  }
  state.money += a;
  if(kind === 'loan') l.loan += a;
  else { l.in += a; state.stats.earned += a; }
  return a;
}
/* sortie d'argent — kind: 'buy' (défaut) | 'repay' ; refuse si la caisse ne suit pas */
function spendMoney(amount, kind){
  const a = Math.round(Math.max(0, Number(amount) || 0));
  if(a > Math.round(state.money)) return false;
  state.money -= a;
  const l = ledger();
  if(kind === 'repay') l.repay += a;
  else { l.out += a; state.stats.spent += a; }
  return true;
}
/* contrôle de cohérence : un solde supérieur au journal = sauvegarde trafiquée */
function auditMoney(silent){
  const max = maxPlausibleMoney();
  if(state.money > max + 1){
    state.money = Math.max(0, Math.round(max));
    if(!silent) log("⚠️ Caisse incohérente : le solde a été recalculé depuis le journal des transactions.");
    return false;
  }
  if(state.money < 0) state.money = 0;
  return true;
}



function initGrid(){
  const dims = buildRoom(state.stage);
  state.dims = dims;
  state.grid = Array.from({length:dims.rows},()=>Array(dims.cols).fill(null));
  buildExteriorBuilding(state.stage, dims.cols, dims.rows);
  spawnGrime();
}


/* ---------- murs déplaçables : agrandir / rétrécir la pièce ---------- */
const WALL_BASE_COST = 45;  // première rangée : accessible dès le début
const WALL_STEP_COST = 35;  // chaque rangée suivante coûte plus cher
const WALL_REFUND = 20;     // récupéré en retirant un mur
function wallsBought(){ return Math.max(0, (state.extraCols||0)) + Math.max(0, (state.extraRows||0)); }
function wallCost(){ return WALL_BASE_COST + WALL_STEP_COST * wallsBought(); }
function rebuildRoomKeepMachines(){
  const dims = buildRoom(state.stage);
  state.dims = dims;
  const old = state.machines;
  state.grid = Array.from({length:dims.rows},()=>Array(dims.cols).fill(null));
  state.machines = [];
  old.forEach(m=>{
    if(m.x < dims.cols && m.z < dims.rows){
      const p = cellToWorld(m.x, m.z, dims.cols, dims.rows);
      m.mesh.position.set(p.x, m.mesh.position.y, p.z);
      state.grid[m.z][m.x] = m;
      state.machines.push(m);
    } else {
      machinesGroup.remove(m.mesh);
    }
  });
  buildExteriorBuilding(state.stage, dims.cols, dims.rows);
  spawnGrime();
  renderExpandBox();
}
function moveWall(axis, delta){
  const st = STAGES[state.stage];
  const cur = axis==='cols' ? (state.extraCols||0) : (state.extraRows||0);
  const base = axis==='cols' ? st.cols : st.rows;
  const next = base + cur + delta;
  const max = axis==='cols' ? 20 : 18;
  if(next < 4 || next > max){ log("Impossible de pousser le mur plus loin."); return; }
  if(delta > 0){
    const cost = wallCost();
    if(state.money < cost){ log(`Pas assez de jetons : une rangée coûte ${cost}¢.`); return; }
    spendMoney(cost, 'buy');

  } else {
    // refuse si des machines occupent la dernière rangée
    const occupied = state.machines.some(m=> axis==='cols' ? m.x >= next : m.z >= next);
    if(occupied){ log("Libère d'abord la rangée près du mur."); return; }
    // on ne rembourse que les rangées réellement achetées (sinon : argent gratuit en rétrécissant la salle d'origine)
    const bought = axis==='cols' ? (state.extraCols||0) : (state.extraRows||0);
    if(bought > 0){ earnMoney(WALL_REFUND, 'refund'); }
  }

  if(axis==='cols') state.extraCols = (state.extraCols||0) + delta;
  else state.extraRows = (state.extraRows||0) + delta;
  rebuildRoomKeepMachines();
  if(typeof writeSave === 'function') writeSave();
  log(delta>0 ? "Tu casses le mur et gagnes une rangée de plus." : "Tu remontes un mur : la salle rétrécit.");
}
function initWallUI(){
  const bind = (id, axis, d)=>{ const el = document.getElementById(id); if(el) el.onclick = ()=>moveWall(axis, d); };
  bind('wallColPlus','cols',1); bind('wallColMinus','cols',-1);
  bind('wallRowPlus','rows',1); bind('wallRowMinus','rows',-1);
}

/* ============================================================
   BANQUE — emprunt & remboursement progressif
   ============================================================ */
const LOAN_RATE = 0.015;            // intérêt journalier sur la dette
function creditLimit(){
  return Math.round(600 + state.stage*450 + state.rep*35 + state.stats.earned*0.05);
}
function bankBorrow(amount){
  const room = creditLimit() - state.debt;
  if(room < 40){ log("La banque refuse : ta ligne de crédit est déjà au maximum."); return; }
  const take = Math.min(amount, room);
  state.debt += take;
  earnMoney(take, 'loan');
  state.won = false;
  log(`🏦 Emprunt accordé : +${take}¢ (dette ${Math.round(state.debt)}¢).`);
  updateHUD();
  renderBankPanel();
  if(typeof writeSave === 'function') writeSave();
}
const CASH_RESERVE = 25;            // jetons qu'on garde toujours en caisse pour continuer à jouer
let pendingRepay = null;              // { amount, label } si l'utilisateur doit confirmer un remboursement
function bankRepay(amount){
  if(state.debt<=0){ log("Tu n'as plus rien à rembourser."); return; }
  // on ne vide jamais complètement la caisse : sinon la partie est bloquée.
  // seule exception : le versement qui solde définitivement la dette.
  const canClearAll = state.money >= state.debt;
  const spendable = canClearAll ? state.money : Math.max(0, state.money - CASH_RESERVE);
  const pay = Math.min(amount, state.debt, spendable);
  if(pay < 1){
    log(`Pas assez de jetons : la banque te laisse garder ${CASH_RESERVE}¢ en caisse pour faire tourner la boîte.`);
    return;
  }
  spendMoney(pay, 'repay'); state.debt -= pay;
  const summary = `<span class="ev-good">🏦 Remboursement</span><br>
• Montant versé : <b>${Math.round(pay)}¢</b><br>
• Dette restante : <b>${Math.max(0, Math.round(state.debt))}¢</b><br>
• Caisse actuelle : <b>${Math.round(state.money)}¢</b>`;
  log(summary);
  checkDebtCleared();
  updateHUD();
  renderBankPanel();
  if(typeof writeSave === 'function') writeSave();
}
function checkDebtCleared(){
  if(state.debt<=0 && !state.won){
    state.debt = 0; state.won = true;
    // plus aucune fenêtre de fin : la partie continue simplement, sans écran de début
    log("🏦 Dette soldée ! La boîte est à toi — continue de l'agrandir comme tu veux.");
  }
}

function renderBankPanel(){
  const box = document.getElementById('bankBox');
  if(!box) return;
  const lim = creditLimit();
  const room = Math.max(0, lim - Math.round(state.debt));
  const daily = Math.round(state.debt * LOAN_RATE);
  box.innerHTML = `<div class="costLine">Dette : <b>${Math.round(state.debt)}¢</b> — intérêts ${daily}¢/jour<br>
    Crédit disponible : <b>${room}¢</b> / ${lim}¢</div>`;

  // si une confirmation de remboursement est en attente, on affiche seulement ça
  if(pendingRepay && state.debt > 0 && state.money >= 1){
    const confirmRow = document.createElement('div');
    confirmRow.className = 'bankConfirm';
    const payNow = Math.min(pendingRepay.amount, state.debt, state.money >= state.debt ? state.money : Math.max(0, state.money - CASH_RESERVE));
    confirmRow.innerHTML = `<div class="costLine">Confirmer le remboursement de <b>${pendingRepay.label}</b> ?<br>
      Montant effectif : <b>${Math.round(payNow)}¢</b></div>`;
    const btns = document.createElement('div');
    btns.className = 'bankRow';
    const yes = document.createElement('button');
    yes.type = 'button'; yes.className = 'pink'; yes.innerText = `✅ Confirmer ${pendingRepay.label}`;
    yes.onclick = ()=>{ bankRepay(pendingRepay.amount); pendingRepay = null; };
    const no = document.createElement('button');
    no.type = 'button'; no.innerText = '❌ Annuler';
    no.onclick = ()=>{ pendingRepay = null; renderBankPanel(); };
    btns.appendChild(yes); btns.appendChild(no);
    box.appendChild(confirmRow);
    box.appendChild(btns);
    return;
  }

  const row = document.createElement('div');
  row.className = 'bankRow';
  [100,300,600].forEach(v=>{
    const b = document.createElement('button');
    b.type='button'; b.innerText = `+${v}¢`;
    b.disabled = room < 40;
    b.onclick = ()=>{ bankBorrow(v); };
    row.appendChild(b);
  });
  box.appendChild(row);
  const row2 = document.createElement('div');
  row2.className = 'bankRow';
  [[50,'-50¢'],[200,'-200¢'],[999999,`Max (garde ${CASH_RESERVE}¢)`]].forEach(([v,lab])=>{
    const b = document.createElement('button');
    b.type='button'; b.innerText = lab;
    b.title = "La caisse n'est jamais vidée : on garde de quoi faire tourner la boîte.";
    b.disabled = state.debt<=0 || state.money<1;
    b.onclick = ()=>{ pendingRepay = { amount:v, label:lab }; renderBankPanel(); };
    row2.appendChild(b);
  });
  box.appendChild(row2);
}

/* ============================================================
   BOÎTE ABANDONNÉE — nettoyage des gravats
   ============================================================ */
const GRIME_TOTAL = 12;
let grimeGroup = null;
function spawnGrime(){
  if(grimeGroup){ roomGroup.remove(grimeGroup); grimeGroup = null; }
  const left = state.grime|0;
  if(left<=0) return;
  grimeGroup = group();
  const {cols, rows} = state.dims || roomSize(state.stage);
  // positions stables : on garde toujours les mêmes emplacements, on n'affiche que
  // les `left` premiers => nettoyer fait bien disparaître un tas
  for(let i=0;i<left;i++){
    const cx = (i*5+2) % cols, cz = (i*3+1) % rows;
    const p = cellToWorld(cx, cz, cols, rows);
    p.x += ((i*37)%7 - 3) * 0.06;
    p.z += ((i*53)%7 - 3) * 0.06;
    const pile = group();
    const kind = i % 4;
    if(kind===0){
      // tas de gravats + sacs
      const heap = box(0.7,0.22,0.6,'#4b4436'); heap.position.y=0.11; pile.add(heap);
      const bag = sphere(0.18,'#2c2b30'); bag.position.set(-0.22,0.2,0.15); pile.add(bag);
      const bag2 = sphere(0.14,'#3a3630'); bag2.position.set(0.18,0.16,0.2); pile.add(bag2);
    } else if(kind===1){
      // pile de cartons éventrés
      const c1 = box(0.42,0.34,0.36,'#8a6b3f'); c1.position.set(0,0.17,0); c1.rotation.y=0.3; pile.add(c1);
      const c2 = box(0.34,0.28,0.3,'#7a5d34'); c2.position.set(0.22,0.45,0.08); c2.rotation.y=-0.5; pile.add(c2);
      const c3 = box(0.3,0.24,0.26,'#95784a'); c3.position.set(-0.26,0.12,0.2); c3.rotation.y=0.9; pile.add(c3);
    } else if(kind===2){
      // planches de bois en vrac
      for(let k=0;k<5;k++){
        const pl = box(1.05,0.06,0.16, k%2 ? '#6b5231' : '#7d6039');
        pl.position.set((Math.random()-0.5)*0.3, 0.04 + k*0.07, (Math.random()-0.5)*0.4);
        pl.rotation.y = (Math.random()-0.5)*1.4;
        pl.rotation.z = (Math.random()-0.5)*0.08;
        pile.add(pl);
      }
    } else {
      // tente de fortune abandonnée (vide) + bâche
      const tent = group();
      const a = box(0.9,0.06,0.7,'#2f6a52'); a.position.set(0,0.42,0); a.rotation.z=0.85; a.position.x=-0.2; tent.add(a);
      const b = box(0.9,0.06,0.7,'#275944'); b.position.set(0.2,0.42,0); b.rotation.z=-0.85; tent.add(b);
      const backw = box(0.06,0.5,0.7,'#245040'); backw.position.set(0,0.25,-0.34); tent.add(backw);
      tent.rotation.y = (i*0.7)%Math.PI;
      pile.add(tent);
      const tarp = box(0.7,0.05,0.5,'#3a3f4a'); tarp.position.set(0.45,0.03,0.4); tarp.rotation.y=0.6; pile.add(tarp);
      const bottle = cyl(0.05,0.05,0.22,'#5d7a3a',10); bottle.position.set(-0.45,0.11,0.3); bottle.rotation.z=1.4; pile.add(bottle);
    }
    pile.position.set(p.x, 0, p.z);
    pile.rotation.y = (i*1.3)%6.28;
    grimeGroup.add(pile);
  }

  roomGroup.add(grimeGroup);
}
function cleanOne(){
  if((state.grime|0)<=0){ log("La salle est déjà nickel."); return; }
  state.grime -= 1;
  state.rep = Math.min(30, state.rep + 0.2);
  spawnGrime();
  if(state.grime<=0){
    log("🧹 Dernier tas de gravats dehors : la boîte est propre, les clients paient plein tarif !");
    showEvent("SALLE REMISE À NEUF ✨", "Plus de poussière, plus de gravats. La vieille boîte abandonnée redevient un lieu où l'on a envie d'entrer. Les recettes ne sont plus pénalisées.");
  } else {
    log(`🧹 Tu déblaies un tas de gravats (${state.grime} restants).`);
  }
  updateHUD();
  if(typeof writeSave === 'function') writeSave();
}
let cleanBtnEl = null, cleanTextEl = null;
function renderCleanPanel(){
  const box = document.getElementById('cleanBox');
  if(!box) return;
  const left = state.grime|0;
  if(left<=0){ box.style.display='none'; return; }
  box.style.display='block';
  // le bouton est créé une seule fois : le recréer à chaque tick annulait les taps
  if(!cleanTextEl || cleanTextEl.parentNode !== box){
    box.innerHTML = '';
    cleanTextEl = document.createElement('div');
    cleanTextEl.className = 'costLine';
    box.appendChild(cleanTextEl);
    cleanBtnEl = document.createElement('button');
    cleanBtnEl.type='button'; cleanBtnEl.className='btn pink';
    cleanBtnEl.onclick = ()=>cleanOne();
    box.appendChild(cleanBtnEl);
  }
  cleanTextEl.innerHTML = `Boîte rachetée en ruine : <b>${left}</b> tas de gravats.<br>Recettes réduites de 40 % tant que ce n'est pas nettoyé.`;
  const label = `🧹 Nettoyer un tas (${left})`;
  if(cleanBtnEl.innerText !== label) cleanBtnEl.innerText = label;
}




/* ---------- shop UI ---------- */
function renderItemInto(container, def){
  const stageLocked = state.stage < def.stageReq;
  const repLocked = state.rep < def.repReq;
  const backLocked = !!def.illegal && !state.backroom;
  const storyLocked = !!def.unlockReq && !state.unlocks.includes(def.unlockReq);
  if(storyLocked) return; // pas encore raconté : l'objet n'existe pas dans la boutique
  const locked = stageLocked || repLocked || backLocked;
  const div = document.createElement('div');
  div.className='item'+(locked?' locked':'')+(state.selected===def.id?' selected':'');
  div.innerHTML = `<div class="sw" style="background:${def.color}"></div>
    <div class="info">${def.illegal?'<span class="illegalTag">CLANDESTIN</span> ':''}${def.name}${locked?` <span style="color:#ff6b6b">(${backLocked?'arrière-salle requise':stageLocked?'étape '+(def.stageReq+1):'rép. '+def.repReq+'★'})</span>`:''}</div>
    <div class="price">${def.price}¢</div>`;
  if(!locked) div.onclick=()=>{
    state.selected = state.selected===def.id?null:def.id;
    renderShop();
    closeMachineMenu();
    if(state.selected && window.innerWidth<=820) setSidebarOpen(false);
  };
  container.appendChild(div);
}

function renderShop(){
  const list = document.getElementById('itemList');
  list.innerHTML='';
  MACHINES.forEach(m=>renderItemInto(list,m));

  const decorList = document.getElementById('decorList');
  decorList.innerHTML='';
  DECOR.forEach(d=>renderItemInto(decorList,d));

  const staffList = document.getElementById('staffList');
  staffList.innerHTML='';
  STAFF.forEach(s=>{
    if(state.stage < s.stageReq) return;
    const owned = state.staff[s.id];
    const div = document.createElement('div');
    div.className='item'+(owned?' selected':'');
    div.innerHTML = `<div class="sw" style="background:#20e6d0"></div>
      <div class="info">${s.name}<br><span style="color:var(--dim);font-size:9px;">${s.desc}</span></div>
      <div class="price">${owned?'✔':s.price+'¢'}</div>`;
    if(!owned) div.onclick=()=>{
      if(state.money>=s.price){ state.money-=s.price; state.staff[s.id]=true; log(`Tu as embauché : ${s.name}.`); renderShop(); }
      else log("Pas assez de jetons pour ce recrutement.");
    };
    staffList.appendChild(div);
  });
  renderExpandBox();
}

function renderWallBox(){
  const info = document.getElementById('wallInfo');
  const cv = document.getElementById('wallColVal');
  const rv = document.getElementById('wallRowVal');
  const dims = state.dims || roomSize(state.stage);
  if(cv) cv.innerText = String(dims.cols);
  if(rv) rv.innerText = String(dims.rows);
  if(info) info.innerHTML = `Salle ${dims.cols}×${dims.rows} — prochaine rangée : <b>${wallCost()}¢</b> · retirer = +${WALL_REFUND}¢`;
}

function renderExpandBox(){
  const box = document.getElementById('expandText');
  const btn = document.getElementById('expandBtn');
  renderWallBox();
  if(state.stage >= STAGES.length-1){
    box.innerHTML = `<b>${STAGES[state.stage].name}</b><br>Étape maximale atteinte !`;
    btn.style.display='none';
    return;
  }
  const next = STAGES[state.stage+1];
  box.innerHTML = `Prochaine étape :<br><b>${next.name}</b><br>Coût : ${next.cost}¢ · Rép. requise : ${next.unlockRep}★`;
  btn.style.display='block';
  btn.disabled = !(state.money>=next.cost && state.rep>=next.unlockRep);
}


document.getElementById('expandBtn').onclick = ()=>{
  const next = STAGES[state.stage+1];
  if(!next) return;
  if(state.money<next.cost || state.rep<next.unlockRep) return;
  spendMoney(next.cost, 'buy');
  state.stage += 1;
  // clear machines/customers visually and logically (renovation)
  state.machines.forEach(m=>machinesGroup.remove(m.mesh));
  state.customers.forEach(c=>customersGroup.remove(c.mesh));
  state.machines=[]; state.customers=[];
  closeMachineMenu();
  initGrid();
  document.getElementById('stageLabel').innerText = STAGES[state.stage].name;
  renderShop();
  if(state.stage===1){
    showEvent("EXTENSION !", "Tu casses le mur du fond et rachètes le local voisin. Le Cosmic Coin devient une vraie Grande Salle d'Arcade, avec de la place pour de nouvelles attractions.");
  } else if(state.stage===2){
    showEvent("BIENVENUE AU CASINO", "Avec la réputation du quartier entier, tu obtiens une licence pour ouvrir des tables de jeu. Les néons changent de couleur : le Cosmic Coin devient le Cosmic Casino.");
  }
};

/* ---------- placing machines & selecting existing ones: raycast ---------- */
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let movingMachine = null;
function endMoveMode(){ movingMachine = null; }


function findMachineFromObject(obj){
  let o = obj;
  while(o){
    if(o.userData && o.userData.machine) return o.userData.machine;
    o = o.parent;
  }
  return null;
}

canvas.addEventListener('click', (e)=>{
  if(state.paused || exteriorMode) return;
  if(dragMoved) { dragMoved=false; return; }
  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);

  // mode déplacement : on repose la machine sélectionnée sur une case libre
  if(movingMachine){
    const hitsF = raycaster.intersectObjects(roomGroup.children, true);
    if(!hitsF.length) return;
    const p0 = hitsF[0].point;
    const {cols:c0, rows:r0} = state.dims;
    const nx = Math.floor(p0.x/CELL + c0/2);
    const nz = Math.floor(p0.z/CELL + r0/2);
    if(nx<0||nx>=c0||nz<0||nz>=r0) return;
    if(state.grid[nz][nx] && state.grid[nz][nx]!==movingMachine){ log("Cette case est déjà occupée."); return; }
    const zoneN = zoneAt(nx, nz);
    if(!zoneAllows(movingMachine.def, zoneN)){ log(`${movingMachine.def.name} ne peut pas aller dans ${ZONE_LABEL[zoneN]}.`); return; }
    if(zoneN === 'back' && !state.backroom){ log("L'arrière-salle est encore murée."); return; }
    const m = movingMachine;
    state.grid[m.z][m.x] = null;
    m.x = nx; m.z = nz;
    state.grid[nz][nx] = m;
    const np = cellToWorld(nx,nz,c0,r0);
    m.mesh.position.set(np.x, m.mesh.position.y, np.z);
    // les clients en route vers cette machine suivent le déménagement
    state.customers.forEach(c=>{ if(c.target===m){ c.targetPos.set(np.x,0,np.z); c.stuck=0; } });
    log(`${m.def.name} déplacé.`);
    questEvent('move');
    endMoveMode();
    return;
  }

  // tapping an existing machine (when nothing is selected in the shop) opens its menu
  if(!state.selected){
    const hitsM = raycaster.intersectObjects(machinesGroup.children, true);
    if(hitsM.length){
      const m = findMachineFromObject(hitsM[0].object);
      if(m){ openMachineMenu(m, e.clientX, e.clientY); return; }
    }
    closeMachineMenu();
    return;
  }


  closeMachineMenu();
  const hits = raycaster.intersectObjects(roomGroup.children, true);
  if(!hits.length) return;
  const pt = hits[0].point;
  const {cols,rows} = state.dims;
  const gx = Math.floor(pt.x/CELL + cols/2);
  const gz = Math.floor(pt.z/CELL + rows/2);
  if(gx<0||gx>=cols||gz<0||gz>=rows) return;
  if(state.grid[gz][gx]){ log("Cette case est déjà occupée."); return; }
  const def = MACHINES.find(m=>m.id===state.selected) || DECOR.find(d=>d.id===state.selected);
  if(!def) return;
  const zone = zoneAt(gx, gz);
  if(!zoneAllows(def, zone)){
    const wanted = def.illegal ? "l'arrière-salle" : (def.id==='dance' ? "la piste de danse" : "la zone arcade ou la piste");
    log(`${def.name} : ça se pose dans ${wanted}, pas dans ${ZONE_LABEL[zone]}.`);
    return;
  }
  if(zone === 'back' && !state.backroom){ log("L'arrière-salle est encore murée."); return; }
  if(state.money < def.price){ log("Pas assez de jetons pour cet achat."); return; }
  spendMoney(def.price, 'buy');

  state.stats.machinesBuilt += 1;
  const mesh = buildMachineMesh(def.id);
  const p = cellToWorld(gx,gz,cols,rows);
  const jitter = 0.08;
  mesh.position.set(p.x+(Math.random()*2-1)*jitter, 0, p.z+(Math.random()*2-1)*jitter);
  mesh.rotation.y = Math.floor(Math.random()*4)*(Math.PI/2);
  machinesGroup.add(mesh);
  const machine = {x:gx,z:gz,def,mesh,busy:false,broken:false,tint:null,priceMult:1,rigged:false};
  mesh.userData.machine = machine;
  state.grid[gz][gx]=machine;
  state.machines.push(machine);
  if(def.illegal) questSet('illegal_built', illegalMachines().length);
  if(def.decor){
    state.rep = Math.min(30, state.rep + (def.repBoost||0));
    log(`Décoration ajoutée : ${def.name} (+${def.repBoost}★ réputation).`);
  } else {
    log(`Nouvelle machine installée : ${def.name}.`);
  }
  if(['dancefloor','discoball','djdeck'].includes(def.id)) rebuildRoomKeepMachines();
  state.selected=null;
  renderShop();
  if(typeof writeSave === 'function') writeSave();

});

/* ---------- machine context menu (rotate / sell) ---------- */
const machineMenuEl = document.getElementById('machineMenu');
let menuMachine = null;

function openMachineMenu(m, clientX, clientY){
  menuMachine = m;
  document.getElementById('mmTitle').innerText = m.def.name;
  const sellBtn = document.getElementById('mmSell');
  const rotateBtn = document.getElementById('mmRotate');
  const refund = Math.round(m.def.price*0.5);
  sellBtn.innerText = `💰 Vendre (+${refund}¢)`;
  sellBtn.disabled = m.busy;
  sellBtn.title = m.busy ? "Un client l'utilise en ce moment" : "";
  rotateBtn.disabled = false;

  renderMachineTints(m);
  renderMachinePricing(m);

  const menuW = 210, menuH = 320;
  let left = clientX + 10, top = clientY + 10;
  if(left + menuW > window.innerWidth) left = clientX - menuW - 10;
  if(top + menuH > window.innerHeight) top = clientY - menuH - 10;
  machineMenuEl.style.left = Math.max(6,left)+'px';
  machineMenuEl.style.top = Math.max(6,top)+'px';
  machineMenuEl.classList.add('open');
}
/* pastilles de couleur */
function renderMachineTints(m){
  const row = document.getElementById('mmTints');
  if(!row) return;
  row.innerHTML = '';
  MACHINE_TINTS.forEach(t=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tintDot' + ((m.tint||null) === t.hex ? ' on' : '');
    b.title = t.label;
    b.style.background = t.hex || 'linear-gradient(135deg,#666,#ddd)';
    b.onclick = ()=>{
      m.tint = t.hex;
      applyMachineTint(m.mesh, t.hex);
      renderMachineTints(m);
      if(typeof writeSave === 'function') writeSave();
    };
    row.appendChild(b);
  });
}

/* tarif + mode arnaque */
function renderMachinePricing(m){
  const slider = document.getElementById('mmPrice');
  const label  = document.getElementById('mmPriceVal');
  const rigBtn = document.getElementById('mmRig');
  if(!slider || !label) return;
  const mult = machinePriceMult(m);
  slider.value = String(Math.round(mult*100));
  const paint = ()=>{
    const v = Math.min(2.5, Math.max(0.5, (+slider.value)/100));
    m.priceMult = v;
    const [lo,hi] = m.def.earn || [0,0];
    const avg = Math.round(((lo+hi)/2) * v * (m.rigged?1.8:1));
    const app = machineAppeal(m);
    const crowd = app >= 0.9 ? 'affluence forte' : app >= 0.5 ? 'affluence normale' : 'peu de clients';
    label.innerHTML = `Tarif ${Math.round(v*100)}% · ~${avg}¢/partie<br><span style="color:var(--dim)">${crowd}</span>`;
  };
  slider.oninput = ()=>{ paint(); };
  slider.onchange = ()=>{ paint(); if(typeof writeSave === 'function') writeSave(); };
  paint();
  if(rigBtn){
    rigBtn.innerText = m.rigged ? '🎲 Arrêter l\'arnaque' : '🎲 Truquer la machine';
    rigBtn.classList.toggle('rig-on', !!m.rigged);
    rigBtn.disabled = !!m.def.passive;
    rigBtn.onclick = ()=>{
      m.rigged = !m.rigged;
      log(m.rigged
        ? `🎲 ${m.def.name} truquée : gains ×1,8 mais les clients vont râler.`
        : `${m.def.name} remise d'aplomb : plus d'arnaque.`);
      renderMachinePricing(m);
      if(typeof writeSave === 'function') writeSave();
    };
  }
}

function closeMachineMenu(){
  menuMachine = null;
  machineMenuEl.classList.remove('open');
}
document.getElementById('mmClose').onclick = closeMachineMenu;
document.getElementById('mmRotate').onclick = ()=>{
  if(!menuMachine) return;
  menuMachine.mesh.rotation.y += Math.PI/2;
};
document.getElementById('mmMove').onclick = ()=>{
  if(!menuMachine) return;
  movingMachine = menuMachine;
  state.selected = null;
  renderShop();
  log(`Déplacement de ${movingMachine.def.name} : clique une case libre.`);
  closeMachineMenu();
};
document.getElementById('mmSell').onclick = ()=>{
  if(!menuMachine || menuMachine.busy) return;
  const m = menuMachine;
  const refund = Math.round(m.def.price*0.5);
  earnMoney(refund, 'refund');
  machinesGroup.remove(m.mesh);
  state.grid[m.z][m.x] = null;
  const idx = state.machines.indexOf(m);
  if(idx>-1) state.machines.splice(idx,1);
  // pas de client fantôme qui marche vers une machine disparue
  for(let i=state.customers.length-1;i>=0;i--){
    const c = state.customers[i];
    if(c.target===m){ c.phase='out'; c.target=null; }
  }
  if(movingMachine===m) endMoveMode();
  log(`Machine vendue : ${m.def.name} (+${refund}¢).`);
  if(['dancefloor','discoball','djdeck'].includes(m.def.id)) rebuildRoomKeepMachines();
  closeMachineMenu();
  renderShop();
  if(typeof writeSave === 'function') writeSave();
};



/* ---------- customers ---------- */
const SHIRT_COLORS=[0xffb4a2,0xe5989b,0xb5838d,0x6d6875,0xffcdb2,0x83c5be,0xf4a261];
function spawnCustomer(){
  if(state.closed) return; // club fermé : plus personne n'entre
  const free = state.machines.filter(m=>!m.busy && !m.broken && !m.def.passive && !(m.def.illegal && state.hidden));
  if(free.length===0) return;
  // tarif élevé = machine boudée, tarif cassé = machine prise d'assaut
  const weights = free.map(machineAppeal);
  const total = weights.reduce((a,b)=>a+b,0);
  let pick = Math.random()*total, ti = 0;
  for(let k=0;k<free.length;k++){ pick -= weights[k]; if(pick<=0){ ti = k; break; } ti = k; }
  const target = free[ti];
  target.busy = true;
  const shirt = SHIRT_COLORS[Math.floor(Math.random()*SHIRT_COLORS.length)];
  const mesh = buildCharacter(shirt);
  const {cols,rows,doorRow} = state.dims;
  const doorP = cellToWorld(0,doorRow,cols,rows);
  // apparition dehors, sur le seuil : le client franchit vraiment la porte
  mesh.position.set(doorP.x-CELL-1.2, 0, doorP.z);
  customersGroup.add(mesh);
  const cust = {
    mesh, target, targetPos:new THREE.Vector3(), gatePos:null, shirt,
    doorPos:new THREE.Vector3(doorP.x-CELL-1.2,0,doorP.z),
    phase:'enter', playTimer:0
  };
  cust.targetPos.copy(standSpotFor(target, cust));
  cust.gatePos = new THREE.Vector3(doorP.x-CELL/2+0.5, 0, doorP.z); // juste à l'intérieur de l'encadrement
  state.customers.push(cust);

}

// position "devant" la machine : le client se place face à l'écran, jamais dedans
const _spotBox = new THREE.Box3();
const _spotSize = new THREE.Vector3();
function standSpotFor(m, cust){
  const ry = m.mesh.rotation.y || 0;
  // L'avant des modèles est leur axe local +Z. L'encombrement projeté donne
  // une distance sûre même après rotation de la machine.
  let depth = 0.9;
  try{
    _spotBox.setFromObject(m.mesh); _spotBox.getSize(_spotSize);
    depth = Math.abs(Math.sin(ry))*_spotSize.x + Math.abs(Math.cos(ry))*_spotSize.z;
    depth = Math.max(0.5, Math.min(3.2, depth));
  }catch(e){}
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const rx = Math.cos(ry), rz = -Math.sin(ry);
  const distance = depth/2 + 0.58;
  const {cols,rows} = state.dims;
  const hx = cols*CELL/2 - 0.38, hz = rows*CELL/2 - 0.38;
  const inside = (p)=> Math.abs(p.x)<=hx && Math.abs(p.z)<=hz;
  const lateralChoices = cust && typeof cust.sideOffset === 'number'
    ? [cust.sideOffset, 0, -0.28, 0.28]
    : [0, -0.28, 0.28];
  let best = null;
  for(const lateral of lateralChoices){
    const p = new THREE.Vector3(
      m.mesh.position.x + fx*distance + rx*lateral,
      0,
      m.mesh.position.z + fz*distance + rz*lateral
    );
    if(!inside(p)) continue;
    const blocked = state.machines.some(other=>{
      if(other===m) return false;
      try{
        _spotBox.setFromObject(other.mesh).expandByScalar(0.3);
        return _spotBox.containsPoint(p);
      }catch(e){ return false; }
    });
    if(!blocked){ best = p; if(cust) cust.sideOffset = lateral; break; }
  }
  // Si la salle est très encombrée, on conserve malgré tout le vrai côté avant
  // plutôt que de rabattre le PNJ sur la borne ou derrière elle.
  return best || new THREE.Vector3(
    m.mesh.position.x + fx*distance,
    0,
    m.mesh.position.z + fz*distance
  );
}



/* petite barre de progression flottante au-dessus du client qui joue */
const PLAY_BAR_BG = new THREE.SpriteMaterial({color:0x120a1c, transparent:true, opacity:0.85, depthTest:false});
const PLAY_BAR_FG = new THREE.SpriteMaterial({color:0x20e6d0, transparent:true, depthTest:false});
function attachPlayBar(c){
  if(c.bar) return;
  const holder = group();
  const bg = new THREE.Sprite(PLAY_BAR_BG.clone()); bg.scale.set(0.62,0.09,1);
  const fg = new THREE.Sprite(PLAY_BAR_FG.clone()); fg.scale.set(0.6,0.07,1);
  fg.renderOrder = 3; bg.renderOrder = 2;
  holder.add(bg); holder.add(fg);
  holder.position.set(0, 1.72, 0);
  c.mesh.add(holder);
  c.bar = {holder, bg, fg};
}
function updatePlayBar(c, ratio){
  if(!c.bar) return;
  const w = 0.6 * Math.max(0.02, Math.min(1, ratio));
  c.bar.fg.scale.set(w, 0.07, 1);
  c.bar.fg.position.x = -(0.6 - w)/2;
  c.bar.fg.material.color.set(c.target && c.target.rigged ? 0xff4fa3 : 0x20e6d0);
}
function detachPlayBar(c){
  if(!c.bar) return;
  c.mesh.remove(c.bar.holder);
  c.bar = null;
}

function updateCustomers(dt){
  for(let i=state.customers.length-1;i>=0;i--){
    const c = state.customers[i];
    // machine disparue (vendue, saisie, planquée) : le client repart au lieu de rester figé
    if(c.phase!=='out' && c.phase!=='exit' && state.closed){ if(c.target) c.target.busy=false; c.target=null; c.phase = c.gatePos ? 'exit' : 'out'; c.gateTimer = 0; }
    if(c.phase!=='out' && c.phase!=='exit' && (!c.target || state.machines.indexOf(c.target)===-1 || (c.target.def.illegal && state.hidden))){
      if(c.target) c.target.busy = false;
      detachPlayBar(c);
      c.target = null; c.phase = c.gatePos ? 'exit' : 'out'; c.gateTimer = 0;
    }
    if(c.phase==='enter' || c.phase==='exit'){
      // franchissement de la porte : on vise d'abord le seuil
      const gp = c.gatePos || c.targetPos;
      const d = new THREE.Vector3().subVectors(gp, c.mesh.position); d.y=0;
      const dd = d.length();
      c.gateTimer = (c.gateTimer||0) + dt;
      if(dd < 0.25 || c.gateTimer > 8000){
        c.gateTimer = 0;
        c.phase = (c.phase==='enter') ? 'in' : 'out';
      } else {
        d.normalize();
        c.mesh.position.addScaledVector(d, (1.6*dt/1000));
        c.mesh.position.y = Math.abs(Math.sin(performance.now()/140))*0.05;
        stepCharacter(c.mesh, performance.now()/150);
        faceTowards(c.mesh, gp.x, gp.z);
      }
      continue;
    }
    if(c.phase==='in'){
      // la machine a pu être déplacée/pivotée : on resynchronise la cible
      if(c.target) c.targetPos.copy(standSpotFor(c.target, c));
      const dir = new THREE.Vector3().subVectors(c.targetPos,c.mesh.position); dir.y=0;
      const dist = dir.length();
      if(dist<0.25){
        c.mesh.position.set(c.targetPos.x, 0, c.targetPos.z);
        c.phase='playing'; c.playTimer=0; c.stuck=0;
        setPlayingCharacterVisible(c.mesh, true);
      }
      else{
        dir.normalize();
        c.mesh.position.addScaledVector(dir, (1.6*dt/1000));
        c.mesh.position.y = Math.abs(Math.sin(performance.now()/140))*0.05;
        stepCharacter(c.mesh, performance.now()/150);
        faceTowards(c.mesh, c.targetPos.x, c.targetPos.z);
        // anti-blocage : si on n'avance plus, on rejoint directement la machine
        c.stuck = (c.prevDist!==undefined && dist > c.prevDist-0.002) ? (c.stuck||0)+dt : 0;
        if(c.stuck > 4000){
          c.mesh.position.set(c.targetPos.x, 0, c.targetPos.z);
          c.phase='playing'; c.playTimer=0; c.stuck=0;
          setPlayingCharacterVisible(c.mesh, true);
        }
      }
      c.prevDist = dist;
    } else if(c.phase==='playing'){
      // Le client reste debout, au sol et face à la borne pendant toute la partie.
      setPlayingCharacterVisible(c.mesh, true);
      if(c.target){
        // machine déplacée ou pivotée : point d'attente ET orientation recalculés
        c.targetPos.copy(standSpotFor(c.target, c));
        c.mesh.position.set(c.targetPos.x, 0, c.targetPos.z);
        faceTowards(c.mesh, c.target.mesh.position.x, c.target.mesh.position.z);
      }
      const t = performance.now();

      c.mesh.position.y = 0;
      // la pose des bras est appliquée APRÈS l'orientation, en repère local
      playPose(c.mesh, t);

      c.playTimer += dt;
      attachPlayBar(c);
      updatePlayBar(c, c.target ? Math.min(1, c.playTimer/Math.max(1,c.target.def.time)) : 0);

      if(c.playTimer >= c.target.def.time){
        const [lo,hi]=c.target.def.earn;
        const ticketCounters = state.machines.filter(m=>m.def.id==='ticket').length;
        const ticketMult = 1 + Math.min(0.4, ticketCounters*0.08); // +8%/counter, capped +40%
        const priceMult = machinePriceMult(c.target);
        let gain = Math.round((lo+Math.random()*(hi-lo)) * ticketMult * priceMult * ((state.grime|0)>0 ? 0.6 : 1));
        // tarif cassé : les clients sont contents ; tarif abusif : la réputation prend
        if(priceMult < 0.95) state.rep = Math.min(30, state.rep + 0.08);
        else if(priceMult > 1.25) state.rep = Math.max(0, state.rep - (priceMult-1.25)*0.14);
        // machine truquée : gros gains, mais clients qui gueulent et flics qui s'intéressent
        let scammed = false;
        if(c.target.rigged){
          gain = Math.round(gain * 1.8);
          const risk = Math.min(0.55, 0.16 + riggedCount()*0.05) * (state.staff.security || state.lookout ? 0.6 : 1);
          if(Math.random() < risk){
            scammed = true;
            state.rep = Math.max(0, state.rep - 0.9);
            state.suspicion = Math.min(100, state.suspicion + 1.6);
            state.danger = Math.min(100, (state.danger||0) + 1.2);
          }
        }
        const illegalPlay = !!c.target.def.illegal;
        if(illegalPlay){
          gain = Math.round(gain * 2.3);
          state.suspicion = Math.min(100, state.suspicion + (state.lookout?0.45:0.75)*(1+state.danger/120));
          state.rep = Math.min(30, state.rep + 0.05);
        } else {
          state.rep = Math.min(30,state.rep+0.15);
        }
        gain = earnMoney(gain, illegalPlay ? 'illegal' : 'play');
        if(illegalPlay) state.illegalEarned += gain;

        state.stats.customers += 1;
        if(scammed){
          spawnFloatText(c.mesh.position, `ARNAQUE !`);
          log(`😡 Un client crie à l'arnaque sur ${c.target.def.name} : réputation en baisse.`);
        } else {
          spawnFloatText(c.mesh.position, `+${gain}¢`);
        }
        detachPlayBar(c);
        setPlayingCharacterVisible(c.mesh, false);
        resetLimbPose(c.mesh); // retour à une pose de marche neutre
        c.target.busy=false;
        c.target=null;
        c.phase = c.gatePos ? 'exit' : 'out'; c.gateTimer = 0;
      }
    } else if(c.phase==='out'){
      c.mesh.rotation.z = 0;
      detachPlayBar(c);
      setPlayingCharacterVisible(c.mesh, false);
      resetLimbPose(c.mesh);

      const dir = new THREE.Vector3().subVectors(c.doorPos,c.mesh.position); dir.y=0;
      const dist = dir.length();
      if(dist<0.2){ customersGroup.remove(c.mesh); state.customers.splice(i,1); continue; }
      dir.normalize();
      c.mesh.position.addScaledVector(dir,(1.8*dt/1000));
      c.mesh.position.y = Math.abs(Math.sin(performance.now()/140))*0.05;
      stepCharacter(c.mesh, performance.now()/150);
      faceTowards(c.mesh, c.doorPos.x, c.doorPos.z);
      // filet : un client qui traîne trop longtemps dehors est retiré
      c.outTimer = (c.outTimer||0) + dt;
      if(c.outTimer > 20000){ customersGroup.remove(c.mesh); state.customers.splice(i,1); continue; }
    }
  }
  if(state.staff.host && Math.random()<0.0025) spawnCustomer();
}


const floaters=[];
function spawnFloatText(pos,text){
  const sp = makeSprite(text, '#ffd23f');
  sp.position.set(pos.x,1.6,pos.z);
  scene.add(sp);
  floaters.push({sp,life:1100});
  spawnCoinBurst(pos);
}

/* ---------- coin/sparkle particle burst on payout ---------- */
const particles=[];
const sparkleGeo = new THREE.PlaneGeometry(0.09,0.09);
function spawnCoinBurst(pos){
  const count = isMobile ? 5 : 9;
  for(let i=0;i<count;i++){
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random()<0.6 ? 0xffd23f : 0xff9fd0,
      transparent:true, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false
    });
    const p = new THREE.Mesh(sparkleGeo, mat);
    p.position.set(pos.x, 1.2, pos.z);
    const ang = Math.random()*Math.PI*2;
    const spd = 0.9 + Math.random()*1.3;
    scene.add(p);
    particles.push({
      mesh:p,
      vx: Math.cos(ang)*spd, vz: Math.sin(ang)*spd,
      vy: 1.6 + Math.random()*1.2,
      life: 650 + Math.random()*250, maxLife: 900
    });
  }
}
function updateParticles(dt){
  const g = 3.2;
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    const s = dt/1000;
    p.vy -= g*s;
    p.mesh.position.x += p.vx*s;
    p.mesh.position.y += p.vy*s;
    p.mesh.position.z += p.vz*s;
    p.mesh.rotation.z += dt*0.01;
    p.life -= dt;
    p.mesh.material.opacity = Math.max(0, p.life/p.maxLife);
    if(p.life<=0){ scene.remove(p.mesh); p.mesh.material.dispose(); particles.splice(i,1); }
  }
}

/* ============================================================
   ARRIÈRE-SALLE CLANDESTINE
   ============================================================ */
const BACKROOM_COST = 260;
const LOOKOUT_COST = 240;
const LAUNDER_COST = 70;
const BRIBE_COST = 220;

function illegalMachines(){ return state.machines.filter(m=>m.def.illegal); }

function setHidden(on){
  const was = state.hidden;
  state.hidden = on;
  if(on && !was) questEvent('hide');
  if(on && typeof doorVisitor!=='undefined' && doorVisitor) visitorLeaves();
  illegalMachines().forEach(m=>{
    m.mesh.visible = !on;
    if(on){ m.busy = false; }
  });
  renderBackroom();
}

function backAction(label, sub, price, enabled, fn, danger){
  const div = document.createElement('div');
  div.className = 'item back'+(enabled?'':' locked')+(danger?' danger':'');
  div.innerHTML = `<div class="sw" style="background:${danger?'#ff2e88':'#ffe600'}"></div>
    <div class="info">${label}<br><span style="color:var(--dim);font-size:9px;">${sub}</span></div>
    <div class="price">${price===0?'':price+'¢'}</div>`;
  if(enabled) div.onclick = fn;
  return div;
}

function renderBackroom(){
  const box = document.getElementById('backroomList');
  if(!box) return;
  box.innerHTML = '';
  if(!state.backroom){
    box.appendChild(backAction("Rouvrir l'arrière-salle", "La porte cachée de Rosa. Machines clandestines, gains x2,3.", BACKROOM_COST, state.money>=BACKROOM_COST, ()=>{
      spendMoney(BACKROOM_COST, 'buy');
      state.backroom = true;
      questEvent('backroom');
      log("Tu descelles la porte du fond. L'arrière-salle de Rosa rouvre ce soir.");
      showEvent("L'ARRIÈRE-SALLE", "Derrière le mur, la moquette rouge n'a pas bougé depuis 1985. Les machines clandestines rapportent bien plus — mais chaque mise fait monter la suspicion, et le commissariat de la 9e finit toujours par frapper à la porte. Planque tout avant la descente.");
      renderShop();
    }, true));
    return;
  }
  const ill = illegalMachines().length;
  box.appendChild(backAction(state.hidden?"Rouvrir la salle secrète":"Planquer les machines",
    state.hidden?`${ill} machine(s) sous bâche — aucun gain clandestin.`:`${ill} machine(s) exposée(s) en cas de descente.`,
    0, ill>0, ()=>{ setHidden(!state.hidden); log(state.hidden?"Faux mur en place, machines planquées.":"Faux mur ouvert, la nuit peut commencer."); }, !state.hidden));

  box.appendChild(backAction("Blanchir la caisse", state.launderDay===state.day?"Déjà fait aujourd'hui.":"-18 suspicion (1×/jour).", LAUNDER_COST,
    state.money>=LAUNDER_COST && state.launderDay!==state.day, ()=>{
      spendMoney(LAUNDER_COST, 'buy'); state.launderDay = state.day;
      state.suspicion = Math.max(0, state.suspicion-18);
      log("Recettes passées dans les jetons d'arcade. La compta redevient présentable.");
      renderBackroom();
    }));

  box.appendChild(backAction("Pot-de-vin à l'inspecteur", state.day-state.bribeDay<3?"L'inspecteur se fait discret (3 jours).":"-40 suspicion, risque légal.", BRIBE_COST,
    state.money>=BRIBE_COST && state.day-state.bribeDay>=3, ()=>{
      spendMoney(BRIBE_COST, 'buy'); state.bribeDay = state.day;
      state.suspicion = Math.max(0, state.suspicion-40);
      log("Une enveloppe change de main dans l'arrière-cour. Silence acheté.");
      renderBackroom();
    }));

  if(!state.lookout){
    box.appendChild(backAction("Engager un guetteur", "Prévient plus tôt et ralentit la suspicion.", LOOKOUT_COST, state.money>=LOOKOUT_COST, ()=>{
      spendMoney(LOOKOUT_COST, 'buy'); state.lookout = true;
      log("Momo prend son poste devant la porte. Il siffle deux fois quand ça sent le bleu.");
      renderBackroom();
    }));
  }
}

/* ============================================================
   TRI DES CLANDESTINS À LA PORTE DU FOND
   ============================================================ */
const VISITOR_KINDS = [
  {id:'habitue', name:'Un habitué de Rosa', weight:34, danger:-2, pay:[35,70],
   tells:["Il connaît le mot de passe de 85.","Il salue Momo par son prénom.","Manteau élimé, poches vides."]},
  {id:'joueur',  name:'Gros joueur nerveux', weight:26, danger:6, pay:[90,170],
   tells:["Liasse trop épaisse pour un honnête homme.","Il regarde deux fois derrière lui.","Il parle vite, très vite."]},
  {id:'indic',   name:'Visage qui pose des questions', weight:22, danger:18, pay:[20,40],
   tells:["Il demande qui tient la caisse.","Il veut savoir combien de tables tournent.","Il n'a rien parié mais tout observé."]},
  {id:'flic',    name:'Costume trop propre', weight:18, danger:34, pay:[0,0],
   tells:["Chaussures cirées, semelle réglementaire.","Il refuse un verre offert.","Une bosse sous la veste, côté ceinture."]},
];
const VISIT_WAIT = 20000;
let doorVisitor = null;

function pickVisitorKind(){
  const heat = 1 + state.danger/90;
  const pool = VISITOR_KINDS.map(k=>({k, w: k.danger>0 ? k.weight*heat : k.weight}));
  const total = pool.reduce((s,p)=>s+p.w,0);
  let r = Math.random()*total;
  for(const p of pool){ r -= p.w; if(r<=0) return p.k; }
  return pool[0].k;
}
function addDanger(n, why){
  state.danger = Math.max(0, Math.min(100, state.danger + n));
  if(why) log(why);
  updateDangerHUD();
}
function dangerLabel(){
  const d = state.danger;
  return d<20?'CALME':d<45?'TENDU':d<70?'CHAUD':'BRÛLANT';
}
function updateDangerHUD(){
  const v = document.getElementById('danger');
  if(v) v.innerText = `${Math.round(state.danger)}% ${dangerLabel()}`;
  const st = document.getElementById('dangerStat');
  if(st) st.classList.toggle('hot', state.danger>=60);
}

function doorWorld(){
  const {cols,rows,doorRow} = state.dims;
  return cellToWorld(0,doorRow,cols,rows);
}
function spawnVisitor(){
  const kind = pickVisitorKind();
  const mesh = buildCharacter(0x2b2b3a);
  const d = doorWorld();
  mesh.position.set(d.x-CELL*3, 0, d.z-CELL*0.4);
  customersGroup.add(mesh);
  doorVisitor = {
    kind, mesh, phase:'walk',
    stand: new THREE.Vector3(d.x-CELL*1.1, 0, d.z),
    exit: new THREE.Vector3(d.x-CELL*4, 0, d.z-CELL*0.6),
    timer: VISIT_WAIT, searched:false, revealed:false,
    tell: kind.tells[Math.floor(Math.random()*kind.tells.length)],
  };
}
function removeVisitor(){
  if(!doorVisitor) return;
  if(doorVisitor.mesh.parent) customersGroup.remove(doorVisitor.mesh);
  doorVisitor = null;
  renderDoorPanel();
}
function visitorLeaves(){
  if(!doorVisitor) return;
  doorVisitor.phase = 'leave';
  renderDoorPanel();
}

/* --- décisions du joueur --- */
function doorSearch(){
  const v = doorVisitor; if(!v || v.searched || v.phase!=='wait') return;
  v.searched = true;
  state.stats.searched += 1;
  questEvent('search');
  v.timer = Math.min(v.timer, 9000);
  const acc = 0.5 + (state.lookout?0.22:0) + (state.staff.security?0.18:0);
  if(Math.random() < acc){
    v.revealed = true;
    log(`Fouille : ${v.kind.id==='flic'?"badge planqué dans la doublure. C'est un flic.":v.kind.id==='indic'?"carnet de notes plein de noms. C'est un indic.":"rien que des billets. Client réglo."}`);
    if(v.kind.danger<=0) { state.rep = Math.max(0, state.rep-0.3); addDanger(2); }
    else addDanger(-3);
  } else {
    log("Fouille bâclée : impossible de dire qui c'est. Momo hausse les épaules.");
    addDanger(2);
  }
  renderDoorPanel();
}
function doorPass(){
  const v = doorVisitor; if(!v || v.phase!=='wait') return;
  state.stats.passed += 1;
  const free = state.machines.filter(m=>m.def.illegal && !m.busy && !m.broken && !state.hidden);
  if(v.kind.id==='flic'){
    addDanger(v.kind.danger);
    state.suspicion = Math.min(100, state.suspicion+18);
    log("🚨 Tu laisses entrer le costume propre. Il traverse la salle sans jouer et ressort en téléphonant.");
    if(!state.raid && !state.gameOver) startRaid();
  } else if(v.kind.id==='indic'){
    addDanger(v.kind.danger);
    state.suspicion = Math.min(100, state.suspicion+8);
    log("Le curieux entre, compte les tables et repart. Ça se saura.");
  } else {
    const [lo,hi] = v.kind.pay;
    let gain = Math.round((lo + Math.random()*(hi-lo)) * (1 + state.danger/220));
    gain = earnMoney(gain, 'illegal'); state.illegalEarned += gain;
    questEvent('pass_good');
    questEvent('illegal_earn', gain);
    state.rep = Math.min(30, state.rep+0.2);
    addDanger(v.kind.danger);
    spawnFloatText(v.mesh.position, `+${gain}¢`);
    log(`${v.kind.name} passe la porte du fond : +${gain}¢ de mise.`);
    if(free.length){
      const target = free[Math.floor(Math.random()*free.length)];
      target.busy = true;
      const d = doorWorld();
      state.customers.push({mesh:v.mesh, target, targetPos:standSpotFor(target),
        doorPos:new THREE.Vector3(d.x-CELL,0,d.z), phase:'in', playTimer:0});
      doorVisitor = null; renderDoorPanel(); return;
    }
  }
  visitorLeaves();
}
function doorRefuse(){
  const v = doorVisitor; if(!v || v.phase!=='wait') return;
  state.stats.refused += 1;
  if(v.kind.danger>0){
    questEvent('refuse_bad');
    addDanger(-Math.min(12, v.kind.danger*0.6));
    log(`Porte refermée au nez de « ${v.kind.name.toLowerCase()} ». Bien vu.`);
  } else {
    state.rep = Math.max(0, state.rep-0.5);
    addDanger(4);
    log("Un fidèle de Rosa se fait refouler. Il ira raconter ça ailleurs.");
  }
  visitorLeaves();
}

function renderDoorPanel(){
  const panel = document.getElementById('doorPanel');
  if(!panel) return;
  const v = doorVisitor;
  const active = !!v && v.phase==='wait' && !state.paused;
  panel.classList.toggle('on', active);
  if(!active) return;
  const who = v.revealed ? v.kind.name : 'Quelqu\'un frappe à la porte du fond';
  document.getElementById('doorWho').innerText = who;
  document.getElementById('doorTell').innerText = v.tell;
  const sBtn = document.getElementById('doorSearch');
  sBtn.disabled = v.searched;
  sBtn.innerText = v.searched ? (v.revealed?'✅ Fouillé':'🤷 Fouillé') : '🔦 Fouiller';
  const fill = document.getElementById('doorFill');
  if(fill) fill.style.width = Math.max(0, (v.timer/VISIT_WAIT)*100)+'%';
}

function updateDoor(dt){
  // décrue naturelle du danger
  state.danger = Math.max(0, state.danger - dt*0.00035*(state.hidden?2:1));

  if(doorVisitor){
    const v = doorVisitor;
    const goal = v.phase==='leave' ? v.exit : v.stand;
    const dir = new THREE.Vector3().subVectors(goal, v.mesh.position); dir.y=0;
    const dist = dir.length();
    if(dist > 0.15){
      dir.normalize();
      v.mesh.position.addScaledVector(dir, 1.5*dt/1000);
      v.mesh.position.y = Math.abs(Math.sin(performance.now()/140))*0.05;
      stepCharacter(v.mesh, performance.now()/150);
      faceTowards(v.mesh, goal.x, goal.z);
    } else if(v.phase==='walk'){
      v.phase='wait'; renderDoorPanel();
    } else if(v.phase==='leave'){
      removeVisitor(); return;
    }
    if(v.phase==='wait'){
      v.timer -= dt;
      renderDoorPanel();
      if(v.timer<=0){
        addDanger(6, "Personne n'a répondu à la porte du fond. Le type repart en maugréant.");
        visitorLeaves();
      }
    }
    return;
  }

  if(!state.backroom || state.gameOver || state.raid || state.hidden) return;
  state.doorTimer = (state.doorTimer||0) + dt;
  const every = 11000 + Math.random()*3000;
  if(state.doorTimer > every){
    state.doorTimer = 0;
    if(Math.random() < 0.7) spawnVisitor();
  }
}

/* ============================================================
   QUÊTES CLANDESTINES
   ============================================================ */
const QUESTS = [
  {
    id:'q_porte', title:"Chapitre 1 — La porte de Rosa",
    intro:"Momo : « La porte du fond est encore scellée. Tant qu'elle est murée, on ne rembourse rien. »",
    done:"Momo : « Voilà. La salle du fond respire à nouveau. Maintenant fais gaffe à qui tu fais entrer. »",
    objectives:[
      {id:'backroom', label:"Rouvrir l'arrière-salle", goal:1, track:'backroom'},
      {id:'ill1', label:"Installer une machine clandestine", goal:1, track:'illegal_built'},
    ],
    reward:{money:120, log:"Momo glisse 120¢ « pour la peine »."},
  },
  {
    id:'q_tri', title:"Chapitre 2 — Trier les visages",
    intro:"Momo : « Un sur cinq qui frappe est un problème. Fouille, refuse, apprends les têtes. »",
    done:"Momo : « T'as l'œil maintenant. Le quartier va se calmer un peu. »",
    objectives:[
      {id:'search', label:"Fouiller 3 visiteurs", goal:3, track:'search'},
      {id:'refuse', label:"Refuser 2 indics ou flics", goal:2, track:'refuse_bad'},
    ],
    reward:{money:150, danger:-12, log:"Le bouche-à-oreille filtre déjà les curieux (-12 danger)."},
  },
  {
    id:'q_planque', title:"Chapitre 3 — Planquer avant l'orage",
    intro:"Momo : « Quand la banalisée se gare, t'as quelques secondes. Entraîne-toi à tout planquer. »",
    done:"Momo : « Rien vu, rien saisi. C'est comme ça qu'on dure. »",
    objectives:[
      {id:'hide', label:"Planquer les machines 2 fois", goal:2, track:'hide'},
      {id:'raid', label:"Survivre à une descente", goal:1, track:'raid_survived'},
    ],
    reward:{money:200, rep:1, log:"Les habitués reviennent : la maison sait se tenir (+1★)."},
  },
  {
    id:'q_plan', title:"Chapitre 4 — Réagencer la salle du fond",
    intro:"La Reine : « Vos tables sont mal posées. Déplace-moi ça, on joue à l'abri des regards. »",
    done:"La Reine : « Mieux. On peut travailler ici. »",
    objectives:[
      {id:'move', label:"Déplacer 3 machines", goal:3, track:'move'},
      {id:'ill3', label:"Avoir 3 machines clandestines", goal:3, track:'illegal_built'},
    ],
    reward:{money:250, log:"La Reine laisse une enveloppe de 250¢ sur le tapis."},
  },
  {
    id:'q_nuit', title:"Chapitre 5 — La grande nuit",
    intro:"La Reine : « Ce soir j'amène mes joueurs. Fais entrer les bons, et seulement les bons. »",
    done:"La Reine : « Belle soirée. La caisse s'en souviendra. »",
    objectives:[
      {id:'pass', label:"Faire entrer 6 vrais joueurs", goal:6, track:'pass_good'},
      {id:'earn', label:"Encaisser 400¢ au fond", goal:400, track:'illegal_earn'},
    ],
    reward:{money:400, rep:2, log:"La nuit de la Reine rapporte gros (+400¢, +2★)."},
  },
  {
    id:'q_final', title:"Chapitre 6 — Payer Rosa",
    intro:"Vasseur : « Je repasserai. Deux fois plutôt qu'une. »",
    done:"Toi : « Deux descentes de plus, rien saisi. Rosa peut dormir. »",
    objectives:[
      {id:'raid2', label:"Survivre à 2 descentes de plus", goal:2, track:'raid_survived'},
      {id:'days', label:"Tenir 5 nuits de plus", goal:5, track:'day'},
    ],
    reward:{money:600, rep:2, danger:-20, log:"Le quartier te laisse tranquille. 600¢ et la paix."},
  },
];

function activeQuest(){
  if(state.questIdx==null || state.questIdx>=QUESTS.length) return null;
  return QUESTS[state.questIdx];
}
function questSet(track, value){
  const q = activeQuest();
  if(!q || state.gameOver) return;
  for(const o of q.objectives){
    if(o.track!==track) continue;
    const cur = state.questProgress[o.id]||0;
    const next = Math.min(o.goal, Math.max(cur, value));
    if(next===cur) continue;
    state.questProgress[o.id] = next;
    if(next>=o.goal) log(`✅ Objectif : ${o.label}.`);
  }
  renderQuestPanel();
  if(q.objectives.every(o=>(state.questProgress[o.id]||0)>=o.goal)) completeQuest();
}
function questEvent(track, n=1){

  const q = activeQuest();
  if(!q || state.gameOver) return;
  let changed = false;
  for(const o of q.objectives){
    if(o.track!==track) continue;
    const cur = state.questProgress[o.id]||0;
    if(cur>=o.goal) continue;
    state.questProgress[o.id] = Math.min(o.goal, cur+n);
    changed = true;
    if(state.questProgress[o.id]>=o.goal) log(`✅ Objectif : ${o.label}.`);
  }
  if(!changed) return;
  renderQuestPanel();
  if(q.objectives.every(o=>(state.questProgress[o.id]||0)>=o.goal)) completeQuest();
}
function completeQuest(){
  const q = activeQuest(); if(!q) return;
  const r = q.reward||{};
  if(r.money){ earnMoney(r.money, 'quest'); }
  if(r.rep) state.rep = Math.min(30, state.rep + r.rep);
  if(r.danger) addDanger(r.danger);
  state.questsDone.push(q.id);
  log(`🎯 ${q.title} — terminé. ${r.log||''}`);
  showEvent(`${q.title} · TERMINÉ`, `${q.done}\n\n${r.log||''}`);
  state.questIdx += 1;
  state.questProgress = {};
  const next = activeQuest();
  if(next) log(`🎯 Nouvelle mission : ${next.title}. ${next.intro}`);
  renderQuestPanel();
}
function renderQuestPanel(){
  const box = document.getElementById('questBox');
  if(!box) return;
  const q = activeQuest();
  if(!q){
    box.innerHTML = `<div class="qTitle">Toutes les missions accomplies</div>
      <div class="qIntro">La dette de Rosa est derrière toi. Fais tourner la salle comme tu veux.</div>`;
    return;
  }
  const rows = q.objectives.map(o=>{
    const cur = Math.min(o.goal, state.questProgress[o.id]||0);
    const ok = cur>=o.goal;
    const pct = Math.round((cur/o.goal)*100);
    return `<div class="qObj${ok?' ok':''}">
      <span>${ok?'✔':'○'} ${o.label}</span><b>${cur}/${o.goal}</b>
      <div class="qBar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
  box.innerHTML = `<div class="qTitle">${q.title}</div>
    <div class="qIntro">${q.intro}</div>${rows}`;
}


/* ============================================================
   DIALOGUES & CINÉMATIQUES
   ============================================================ */
const CAST = {
  rosa:    {name:'Lettre de Rosa',      color:'#ffe600'},
  momo:    {name:'Momo, le guetteur',   color:'#20e6d0'},
  vasseur: {name:'Inspecteur Vasseur',  color:'#ff2e88'},
  reine:   {name:'La Reine du quartier',color:'#e8b64a'},
  toi:     {name:'Toi',                 color:'#ffffff'},
};
const STORY = [
  {
    id:'intro',
    when: ()=> true,
    cam: {exterior:true, theta:-Math.PI/2-0.9, phi:1.15, radius:22, target:[-5.5,1.2,0]},
    lines: [
      ['toi',   "Un local minuscule, la porte condamnée avec des planches. Un truc dépasse en dessous… une enveloppe."],
      ['rosa',  "« Si tu lis ça, c'est que je suis partie sans prévenir. La nuit du 3 août, les flics ont mis les scellés et vidé la caisse. J'ai laissé la boîte comme elle était. »"],
      ['rosa',  "« Ils ont tout emporté : la piste, la boule, les platines. Le reste, ce sont des gravats, des cartons et les tentes de ceux qui dormaient là quand plus personne ne venait. »"],
      ['rosa',  "« Il te reste quatre murs et un bout de rue. Pousse-les toi-même, rachète tout jeton par jeton. Et si un jour tu ouvres la porte du fond… ne le fais que si tu n'as plus le choix. »"],
      ['toi',   "400¢ de dette, quatre murs et un quartier vide à bâtir. On arrache les planches et on rallume."],
    ],

  },
  {
    id:'momo',
    when: ()=> state.rep >= 3,
    cam: {exterior:false, theta:Math.PI*0.6, phi:0.85, radius:13, target:[0,1.1,0]},
    lines: [
      ['momo', "Hé, patron. Momo. Je traînais devant la salle du temps de Rosa. Je vois arriver les flics avant qu'ils sortent de bagnole."],
      ['momo', "Je te laisse mon juke-box en gage de bonne foi. Mets-le dans la salle, les gens restent plus longtemps."],
      ['toi',  "Marché conclu, Momo."],
    ],
    unlock: {key:'jukebox', label:"Juke-box de Momo (décoration)"},
  },
  {
    id:'porte',
    when: ()=> state.backroom,
    cam: {exterior:false, theta:-Math.PI*0.35, phi:1.0, radius:11, target:[2.5,1.0,2.5]},
    lines: [
      ['toi',  "La moquette rouge de Rosa n'a pas bougé depuis 1985. Les tables non plus."],
      ['momo', "Première règle de l'arrière-salle : l'argent ne dort jamais dans la caisse. Prends ce coffre, planque-le dans un coin."],
      ['momo', "Chaque nuit, il fait baisser la pression. Les comptables du commissariat détestent ça."],
    ],
    unlock: {key:'safe', label:"Coffre planqué (-3 suspicion/jour)"},
  },
  {
    id:'vasseur',
    when: ()=> state.danger >= 45,
    cam: {exterior:true, theta:-Math.PI/2-0.2, phi:1.25, radius:24, target:[-3,1.5,2]},
    lines: [
      ['vasseur', "Joli quartier. Beaucoup de passage pour une salle d'arcade, non ?"],
      ['toi',     "Les gamins aiment les flippers, inspecteur."],
      ['vasseur', "Bien sûr. Je repasserai. Sans prévenir."],
      ['momo',    "Il te lâchera plus. Fais-toi monter un faux mur automatique : au premier signal, tout disparaît."],
    ],
    unlock: {key:'falsewall', label:"Faux mur automatique (planque auto en descente)"},
  },
  {
    id:'reine',
    when: ()=> state.illegalEarned >= 400,
    cam: {exterior:false, theta:Math.PI*0.15, phi:0.9, radius:12, target:[-1,1.2,-1]},
    lines: [
      ['reine', "On parle de ta porte du fond jusqu'à la gare. C'est rare, une maison qui paie encore ses gagnants."],
      ['reine', "Je t'installe ma table. Mes joueurs misent gros — et ils attirent l'œil. À toi de voir si tu tiens la pression."],
      ['toi',   "Installe-la. Rosa n'a jamais reculé."],
    ],
    unlock: {key:'vip', label:"Table VIP de la Reine (arrière-salle)"},
  },
  {
    id:'final',
    when: ()=> state.debt <= 0,
    cam: {exterior:true, theta:-Math.PI/2-0.7, phi:1.1, radius:28, target:[-4.5,2.0,0]},
    lines: [
      ['toi',   "Dernier versement. La banque n'a plus rien à me réclamer."],
      ['momo',  "Et le quartier a de nouveau une salle. Rosa aurait aimé le bruit que ça fait ce soir."],
      ['rosa',  "« Le Cosmic Coin n'appartient à personne, petit. Il appartient à ceux qui y jouent. »"],
    ],
  },
];

const cine = {
  active:false, lines:[], idx:0, char:0, typing:false, typer:null,
  from:null, to:null, t:0, dur:1100, wasPaused:false, wasExterior:false, restore:null,
};
function cineEl(id){ return document.getElementById(id); }

function playCinematic(beat){
  if(cine.active) return;
  cine.active = true;
  cine.lines = beat.lines; cine.idx = 0;
  cine.wasPaused = state.paused;
  cine.wasExterior = exteriorMode;
  state.paused = true;
  if(beat.cam && beat.cam.exterior !== exteriorMode) setExteriorMode(!!beat.cam.exterior);
  cine.restore = {theta:orbit.theta, phi:orbit.phi, radius:orbit.radius, target:orbit.target.clone()};
  if(beat.cam){
    cine.from = {theta:orbit.theta, phi:orbit.phi, radius:orbit.radius, target:orbit.target.clone()};
    cine.to = {
      theta:beat.cam.theta, phi:beat.cam.phi, radius:beat.cam.radius,
      target:new THREE.Vector3(...(beat.cam.target||[0,1,0])),
    };
    cine.t = 0;
  } else { cine.from = cine.to = null; }
  cine.beat = beat;
  const box = cineEl('cinema');
  if(box) box.classList.add('on');
  showLine();
}
function showLine(){
  const l = cine.lines[cine.idx];
  if(!l) { endCinematic(); return; }
  const who = CAST[l[0]] || CAST.toi;
  const whoEl = cineEl('cineWho'), txtEl = cineEl('cineText');
  if(whoEl){ whoEl.innerText = who.name; whoEl.style.color = who.color; }
  if(!txtEl) return;
  window.clearInterval(cine.typer);
  txtEl.innerText = '';
  cine.char = 0; cine.typing = true;
  const full = l[1];
  cine.typer = window.setInterval(()=>{
    cine.char += 2;
    txtEl.innerText = full.slice(0, cine.char);
    if(cine.char >= full.length){ window.clearInterval(cine.typer); cine.typing = false; }
  }, 18);
}
function cineAdvance(){
  if(!cine.active) return;
  if(cine.typing){
    window.clearInterval(cine.typer); cine.typing = false;
    const el = cineEl('cineText'); if(el) el.innerText = cine.lines[cine.idx][1];
    return;
  }
  cine.idx += 1;
  if(cine.idx >= cine.lines.length) endCinematic();
  else showLine();
}
function endCinematic(){
  if(!cine.active) return;
  window.clearInterval(cine.typer);
  cine.active = false; cine.typing = false;
  const box = cineEl('cinema'); if(box) box.classList.remove('on');
  const beat = cine.beat;
  if(beat && beat.unlock && !state.unlocks.includes(beat.unlock.key)){
    state.unlocks.push(beat.unlock.key);
    log(`🔓 Débloqué : ${beat.unlock.label}`);
    renderShop();
    showEvent('NOUVEAU DANS LA SALLE', `${beat.unlock.label} est disponible dans la boutique.`);
    return; // showEvent gère la pause
  }
  if(beat && beat.id === 'intro' && state.dims){
    // la lettre est ramassée et les planches arrachées
    buildExteriorBuilding(state.stage, state.dims.cols, state.dims.rows);
  }
  if(cine.wasExterior !== exteriorMode) setExteriorMode(cine.wasExterior);

  else if(cine.restore){
    orbit.theta = cine.restore.theta; orbit.phi = cine.restore.phi;
    orbit.radius = cine.restore.radius; orbit.target.copy(cine.restore.target);
    updateCamera();
  }
  state.paused = cine.wasPaused;
}
function updateCinematic(dt){
  if(!cine.active || !cine.to) return;
  cine.t = Math.min(1, cine.t + dt/cine.dur);
  const e = cine.t<0.5 ? 2*cine.t*cine.t : 1-Math.pow(-2*cine.t+2,2)/2;
  orbit.theta = cine.from.theta + (cine.to.theta-cine.from.theta)*e;
  orbit.phi = cine.from.phi + (cine.to.phi-cine.from.phi)*e;
  orbit.radius = cine.from.radius + (cine.to.radius-cine.from.radius)*e;
  orbit.target.lerpVectors(cine.from.target, cine.to.target, e);
  updateCamera();
}
function maybeStory(){
  if(cine.active || state.gameOver) return;
  if(document.getElementById('eventModal').style.display === 'flex') return;
  for(const beat of STORY){
    if(beat.id === 'intro') continue; // l'intro ne se joue qu'en cliquant sur la lettre
    if(state.storyDone.includes(beat.id)) continue;
    if(!beat.when()) continue;
    state.storyDone.push(beat.id);
    playCinematic(beat);
    return;
  }
}

document.getElementById('doorSearch').onclick = doorSearch;
document.getElementById('doorPass').onclick   = doorPass;
document.getElementById('doorRefuse').onclick = doorRefuse;
document.getElementById('cineNext').onclick = cineAdvance;
document.getElementById('cineSkip').onclick = ()=>{ cine.idx = cine.lines.length; endCinematic(); };
document.getElementById('cinema').onclick = (e)=>{ if(e.target.id!=='cineSkip') cineAdvance(); };

/* ---------- descentes de police ---------- */
function startRaid(){
  const warn = Math.round((state.lookout ? 22000 : 13000) * (1 - Math.min(0.35, state.danger/300)));
  if(doorVisitor) visitorLeaves();
  if(!state.hidden && state.machines.some(m=>m.def.id==='falsewall')){
    setHidden(true);
    log("Le faux mur automatique claque : tout est planqué avant même que tu bouges.");
  }
  state.raid = {timer:warn, total:warn};
  state.stats.raids += 1;
  const banner = document.getElementById('raidBanner');
  banner.classList.add('on');
  log("🚨 Une voiture banalisée se gare en face. DESCENTE !");
  if(window.innerWidth<=820) setSidebarOpen(true);
}

function resolveRaid(){
  const banner = document.getElementById('raidBanner');
  banner.classList.remove('on');
  state.raid = null;
  const exposed = illegalMachines().filter(m=>!state.hidden);
  if(exposed.length===0){
    state.suspicion = Math.max(0, state.suspicion-35);
    state.raidsSurvived += 1;
    questEvent('raid_survived');
    log("Contrôle terminé : rien à signaler. Les flics repartent bredouilles.");
    showEvent("RIEN À SIGNALER", "Deux agents traversent la salle, tapotent une borne, repartent. Derrière le faux mur, personne n'ose respirer. Suspicion en forte baisse.");
  } else {
    const fine = Math.min(state.money, 120 + exposed.length*40);
    spendMoney(fine, 'buy');
    state.rep = Math.max(0, state.rep-2);
    state.busts += 1;
    state.stats.busts += 1;
    state.stats.incidents += 1;
    state.suspicion = 45;
    const seized = exposed[Math.floor(Math.random()*exposed.length)];
    machinesGroup.remove(seized.mesh);
    state.grid[seized.z][seized.x] = null;
    const idx = state.machines.indexOf(seized); if(idx>-1) state.machines.splice(idx,1);
    log(`Descente ratée : -${Math.round(fine)}¢ d'amende, ${seized.def.name} saisie.`);
    if(state.busts>=3){
      state.gameOver = true;
      recordRun('scellés'); writeSave();
      showEvent("SCELLÉS SUR LA PORTE", "Troisième descente ratée. Le juge ferme le Cosmic Coin et la dette de Rosa passe au liquidateur. Fin de l'histoire — appuie sur Reset pour retenter ta chance.");
    } else {
      showEvent("DESCENTE RATÉE", `Les agents trouvent ${exposed.length} machine(s) clandestine(s). Amende de ${Math.round(fine)}¢, "${seized.def.name}" part à la fourrière. Encore ${3-state.busts} avertissement(s) avant la fermeture.`);
    }
    renderShop();
  }
}

function updateRaid(dt){
  if(!state.raid) return;
  state.raid.timer -= dt;
  const secs = Math.max(0, Math.ceil(state.raid.timer/1000));
  const el = document.getElementById('raidText');
  if(el) el.innerText = state.hidden
    ? `DESCENTE — tout est planqué · ${secs}s`
    : `DESCENTE DANS ${secs}s — PLANQUE LES MACHINES !`;
  if(state.raid.timer<=0) resolveRaid();
}

/* ---------- events / day cycle ---------- */
function maybeTriggerEvent(){
  if(state.machines.length===0) return;
  if(Math.random()<0.15){
    const target = state.machines[Math.floor(Math.random()*state.machines.length)];
    if(!target.def.passive && !target.broken){
      target.broken = true; target.busy = true;
      state.stats.incidents += 1;
      if(state.staff.tech){
        setTimeout(()=>{ target.broken=false; target.busy=false; log(`Le technicien a réparé : ${target.def.name}.`); },4000);
      } else {
        showEvent("Panne !", `La machine "${target.def.name}" tombe en panne. Sans technicien, elle reste hors service un moment.`);
        setTimeout(()=>{ if(target.broken){target.broken=false; target.busy=false;} },12000);
      }
    }
  } else {
    const flavorArcade=["Un groupe de lycéens débarque après les cours.","Une critique locale glisse un mot positif dans le journal du quartier.","Une rumeur circule : ta salle serait la plus cool du coin."];
    const flavorCasino=["Un habitué VIP fait tinter les jetons jusque tard dans la nuit.","Un inspecteur passe vérifier les licences — tout est en ordre.","La rumeur du grand Cosmic Casino attire du monde depuis la ville voisine."];
    const pool = state.stage===2?flavorCasino:flavorArcade;
    log(pool[Math.floor(Math.random()*pool.length)]);
  }
}
function newDay(){
  state.day+=1;
  { const l = ledger(); l.day = state.day; l.dayIn = 0; }
  auditMoney();
  questEvent('day');
  if(state.debt>0){
    state.debt += state.debt * LOAN_RATE;   // intérêts du jour
    const payment = Math.min(state.debt, 20+state.rep*3, Math.max(0, state.money - CASH_RESERVE));
    if(payment >= 1){ state.money-=payment; state.debt-=payment; log(`Jour ${state.day} — Remboursement banque : -${Math.round(payment)}¢.`); }
    else log(`Jour ${state.day} — Pas assez pour rembourser la banque ce jour-ci...`);
  }
  checkDebtCleared();
  const safes = state.machines.filter(m=>m.def.id==='safe').length;
  if(safes) state.suspicion = Math.max(0, state.suspicion - safes*3);
  // suspicion : décroît les nuits calmes, monte si la salle secrète tourne à découvert
  if(state.backroom){
    const active = illegalMachines().length;
    if(active===0 || state.hidden) state.suspicion = Math.max(0, state.suspicion-4);
    else state.suspicion = Math.min(100, state.suspicion + 1 + active*0.6);
  }
  // rumeurs et descentes
  if(state.backroom && !state.raid && !state.gameOver && state.day>2){
    const chance = state.suspicion/210 + state.danger/320 + (illegalMachines().length && !state.hidden ? 0.04 : 0);
    if(Math.random() < chance) startRaid();
    else if(state.suspicion>60 && Math.random()<0.4) log("Un habitué murmure que des questions ont été posées au comptoir du café d'en face.");
  }
  state.spawnEvery = Math.max(900, state.spawnEvery-60);
  maybeTriggerEvent();
  log(`--- Fin du jour ${state.day-1}, ouverture du jour ${state.day} ---`);
}

/* ---------- log & hud ---------- */
function log(msg){
  state.logMsgs.unshift(msg); state.logMsgs=state.logMsgs.slice(0,50);
  document.getElementById('log').innerHTML = state.logMsgs.map(m=>`<div>${m}</div>`).join('');
}
function updateHUD(){
  document.getElementById('money').innerText=Math.round(state.money);
  document.getElementById('rep').innerText=state.rep.toFixed(1);
  document.getElementById('day').innerText=state.day;
  document.getElementById('debt').innerText=Math.max(0,Math.round(state.debt));
  document.getElementById('susp').innerText=Math.round(state.suspicion);
  const suspStat = document.getElementById('suspStat');
  suspStat.classList.toggle('hot', state.suspicion>=55);
  const bar = document.getElementById('suspFill');
  if(bar) bar.style.width = Math.min(100,state.suspicion)+'%';
  const scoreEl = document.getElementById('score');
  if(scoreEl) scoreEl.innerText = computeScore().toLocaleString('fr-FR');
  updateDangerHUD();
  if(typeof refreshHoodUI === 'function' && exteriorMode) refreshHoodUI();
  if(typeof refreshStyleUI === 'function' && shopTab === 'deco') refreshStyleUI();
  renderDoorPanel();
  renderExpandBox();
  renderBankPanel();
  if(typeof refreshDock === 'function') refreshDock();
  renderCleanPanel();
  renderBackroom();
  renderQuestPanel();
}

/* ---------- events modal ---------- */
function setModalOpen(on){
  document.body.classList.toggle('modalOpen', !!on);
  if(on && typeof closeAllPanels === 'function') closeAllPanels('none');
}
function showEvent(title,text){
  state.paused=true;
  setModalOpen(true);
  document.getElementById('eventTitle').innerText=title;
  document.getElementById('eventText').innerText=text;
  document.getElementById('eventModal').style.display='flex';
}
document.getElementById('closeEventBtn').onclick=()=>{
  document.getElementById('eventModal').style.display='none';
  setModalOpen(false);
  if(!cine.active && cine.restore){
    if(cine.wasExterior !== exteriorMode) setExteriorMode(cine.wasExterior);
    else {
      orbit.theta = cine.restore.theta; orbit.phi = cine.restore.phi;
      orbit.radius = cine.restore.radius; orbit.target.copy(cine.restore.target);
      updateCamera();
    }
    cine.restore = null;
  }
  state.paused = !state.gameOver ? false : true;
};
document.getElementById('closeStoryBtn').onclick=()=>{ document.getElementById('storyModal').style.display='none'; setModalOpen(false); maybeStory(); };

/* ---------- mobile sidebar drawer ---------- */
const sidebarEl = document.getElementById('sidebar');
const menuToggleBtn = document.getElementById('menuToggle');
const dragHandleEl = document.getElementById('dragHandle');
function setSidebarOpen(open){
  sidebarEl.classList.toggle('open', open);
  menuToggleBtn.innerText = open ? '✕ FERMER' : '🕹️ BOUTIQUE';
  setTimeout(resize, 300); // canvas area changes as drawer slides
}
menuToggleBtn.onclick = ()=> setSidebarOpen(!sidebarEl.classList.contains('open'));
dragHandleEl.onclick = ()=> setSidebarOpen(!sidebarEl.classList.contains('open'));

/* ---------- onglets de la boutique ---------- */
let shopTab = 'machines';
const SHOP_TABS = ['machines','room','deco','bank','manage'];
function setShopTab(tab){
  if(!SHOP_TABS.includes(tab)) tab = 'machines';
  shopTab = tab;
  document.querySelectorAll('#shopTabs button').forEach(b=>{
    b.classList.toggle('on', b.dataset.tab === tab);
  });
  document.querySelectorAll('.shopTab').forEach(p=>{
    p.style.display = (p.dataset.tab === tab) ? 'block' : 'none';
  });
  if(tab === 'deco' && typeof refreshStyleUI === 'function') refreshStyleUI();
}
function openShopTab(tab){
  closeAllPanels('shop');
  setShopTab(tab);
  setSidebarOpen(true);
  sidebarEl.scrollTop = 0;
  refreshDock();
}
function initShopTabs(){
  document.querySelectorAll('#shopTabs button').forEach(b=>{
    b.onclick = ()=>{ setShopTab(b.dataset.tab); sidebarEl.scrollTop = 0; refreshDock(); };
  });
  setShopTab(shopTab);
}

/* ---------- dock : un seul menu, un seul panneau ouvert à la fois ---------- */
function closeAllPanels(except){
  if(except!=='shop') setSidebarOpen(false);
  if(except!=='opts') document.body.classList.remove('optsOn');
  if(except!=='acts') document.body.classList.remove('actsOn');
  refreshDock();
}
function refreshDock(){
  const set=(id,on)=>{ const b=document.getElementById(id); if(b) b.classList.toggle('on', !!on); };
  const shopOpen = sidebarEl.classList.contains('open');
  set('dockShop', shopOpen && shopTab !== 'deco');
  set('dockDeco', shopOpen && shopTab === 'deco');
  set('dockHood', exteriorMode);
  set('dockCam', document.body.classList.contains('camOn'));
  set('dockOpts', document.body.classList.contains('optsOn'));
  set('dockActs', document.body.classList.contains('actsOn'));
  const hood = document.getElementById('dockHood');
  if(hood) hood.querySelector('span').innerText = exteriorMode ? 'Intérieur' : 'Quartier';
}
function initDock(){
  const on=(id,fn)=>{ const b=document.getElementById(id); if(b) b.onclick=fn; };
  on('dockShop', ()=>{
    // le bouton ouvre toujours quelque chose : s'il est déjà ouvert sur la déco, on revient aux machines
    if(sidebarEl.classList.contains('open') && shopTab !== 'machines'){ openShopTab('machines'); return; }
    if(sidebarEl.classList.contains('open') && window.innerWidth <= 820){ setSidebarOpen(false); refreshDock(); return; }
    openShopTab('machines');
  });
  on('dockDeco', ()=>{
    if(exteriorMode) setExteriorMode(false);
    if(sidebarEl.classList.contains('open') && shopTab === 'deco' && window.innerWidth <= 820){ setSidebarOpen(false); refreshDock(); return; }
    openShopTab('deco');
  });

  on('dockHood', ()=>{
    closeAllPanels('hood');
    setExteriorMode(!exteriorMode);
    refreshDock();
  });
  on('dockCam', ()=>{ document.body.classList.toggle('camOn'); refreshDock(); });
  on('dockOpts', ()=>{
    const open = !document.body.classList.contains('optsOn');
    closeAllPanels('opts');
    document.body.classList.toggle('optsOn', open);
    refreshDock();
  });
  on('dockActs', ()=>{
    const open = !document.body.classList.contains('actsOn');
    closeAllPanels('acts');
    document.body.classList.toggle('actsOn', open);
    refreshDock();
  });
  // les actions reprennent exactement les boutons de Gestion
  const relay = (id, target)=>{
    const b = document.getElementById(id);
    if(!b) return;
    b.onclick = ()=>{
      document.body.classList.remove('actsOn');
      refreshDock();
      const t = document.getElementById(target);
      if(t) t.click();
    };
  };
  relay('actSave', 'saveNowBtn');
  relay('actSlots', 'slotsBtn');
  relay('actMenu', 'menuBtn');
  relay('actQuit', 'quitBtn');
  // Charger la partie : reprend la sauvegarde la plus récente (auto + emplacements)
  const actLoad = document.getElementById('actLoad');
  if(actLoad) actLoad.onclick = ()=>{
    document.body.classList.remove('actsOn');
    refreshDock();
    const best = latestSave();
    if(!best){ log('Aucune sauvegarde à charger.'); return; }
    if(!confirm(`Charger la partie ${best.label.toLowerCase()} ? La partie en cours sera remplacée.`)) return;
    try {
      state.scored = false;
      applySave(best.data);
      writeSave();
      renderShop(); updateHUD();
      try{ renderQuestPanel(); }catch(e){}
      log(`▶ Partie chargée : ${best.label} — jour ${state.day}, ${Math.round(state.money)}¢ en caisse.`);
    } catch(e){ log("⚠️ Impossible de charger cette sauvegarde."); }
  };
  if(window.innerWidth > 820) document.body.classList.add('camOn');
  refreshDock();
}

addWin('orientationchange', ()=>setTimeout(resize,300));

document.getElementById('pauseBtn').onclick=()=>{
  state.paused=!state.paused;
  document.getElementById('pauseBtn').innerText = state.paused?'▶ Reprendre':'⏸ Pause';
};
const closedBtn = document.getElementById('closedBtn');
function refreshClosedBtn(){
  if(!closedBtn) return;
  closedBtn.innerText = state.closed ? '🔓 Ouvrir le club' : '🚪 Fermer le club';
  closedBtn.classList.toggle('pink', state.closed);
  document.body.classList.toggle('clubClosed', !!state.closed);
}
if(closedBtn) closedBtn.onclick=()=>{
  state.closed = !state.closed;
  refreshClosedBtn();
  log(state.closed
    ? "Rideau baissé : personne n'entre, la pression policière retombe doucement. Idéal pour rénover."
    : "Le club rouvre : les clients reviennent.");
};
refreshClosedBtn();
function startNewGame(){
  recordRun(state.gameOver ? 'scellés' : 'abandon');
  clearSave();
  state.machines.forEach(m=>machinesGroup.remove(m.mesh));
  state.customers.forEach(c=>customersGroup.remove(c.mesh));
  removeVisitor();
  endCinematic();
  floaters.forEach(f=>scene.remove(f.sp));
  floaters.length=0;
  closeMachineMenu();
  state = freshState();
  document.getElementById('raidBanner').classList.remove('on');
  // on repart d'un quartier vierge : plus que le sol, la rue principale et le trottoir
  hoodData = []; writeHood();
  streetOvr = {}; writeOvr();
  initGrid();
  buildExteriorStreet(16);
  rebuildHood();
  document.getElementById('stageLabel').innerText = STAGES[state.stage].name;
  setExteriorMode(true);
  frameAbandonedClub();
  document.getElementById('pauseBtn').innerText='⏸ Pause';
  refreshClosedBtn();
  renderShop(); updateHUD();
  log("Nouvelle partie : te voilà devant une boîte condamnée. Une enveloppe dépasse sous la porte — clique dessus.");
}
document.getElementById('resetBtn').onclick = startNewGame;

/* ============================================================
   SAUVEGARDE AUTOMATIQUE
   ============================================================ */
const SAVE_KEY = 'cc_save_v1';
const SAVE_VERSION = 1;
let saveTimer = 0; // horodatage du dernier autosave
// tant que la partie sauvegardée n'a pas été chargée au démarrage, on n'écrase RIEN
// (les fonctions d'initialisation appellent writeSave avant que la sauvegarde soit lue)
var saveReady = false; // eslint-disable-line no-var

const AUTOSAVE_MS = 600000; // sauvegarde automatique toutes les 10 minutes

/* ---- signature locale des sauvegardes (détection de bidouille) ---- */
const SAVE_SALT = 'cosmic-coin-1988';
function saveSignature(d){
  const src = SAVE_SALT + '|' + [d.money, d.debt, d.day, d.rep, d.stage,
    (d.ledger&&d.ledger.in)|0, (d.ledger&&d.ledger.out)|0, (d.ledger&&d.ledger.loan)|0,
    (d.ledger&&d.ledger.repay)|0, (d.machines||[]).length, (d.stats&&d.stats.earned)|0].join('|');
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for(let i=0;i<src.length;i++){
    const c = src.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + c * (i+7)) >>> 0; h2 = Math.imul(h2, 2246822519) >>> 0;
  }
  return h1.toString(36) + '-' + h2.toString(36);
}
function signSave(d){ d.sig = saveSignature(d); return d; }
/* true si la sauvegarde n'a pas été modifiée à la main */
function saveTrusted(d){ return !!d && typeof d.sig === 'string' && d.sig === saveSignature(d); }

function serializeSave(){
  return signSave({
    v: SAVE_VERSION, ts: Date.now(),
    money: state.money, rep: state.rep, day: state.day, debt: state.debt, stage: state.stage,
    extraCols: state.extraCols||0, extraRows: state.extraRows||0, grime: state.grime|0,
    cosmetics: state.cosmetics||[],

    staff: state.staff, dayTimer: state.dayTimer, dayLength: state.dayLength, won: state.won,
    backroom: state.backroom, suspicion: state.suspicion, hidden: state.hidden, busts: state.busts,
    raidsSurvived: state.raidsSurvived, lookout: state.lookout, launderDay: state.launderDay,
    bribeDay: state.bribeDay, gameOver: state.gameOver, illegalEarned: state.illegalEarned,
    danger: state.danger, playMs: Math.round(state.playMs||0), closed: !!state.closed, cityDecor: !!state.cityDecor, baseRoom: 1, unlocks: state.unlocks, storyDone: state.storyDone,
    questIdx: state.questIdx, questProgress: state.questProgress, questsDone: state.questsDone,
    stats: state.stats, ledger: ledger(), logMsgs: state.logMsgs.slice(-14),
    // personnalisations : murs/sol/motif + nom & enseigne de la boîte
    style: {...roomStyle},
    brand: {name: clubBrand.name, sign: clubBrand.sign, owned: clubBrand.owned, named: !!clubBrand.named},
    machines: state.machines.map(m=>({id:m.def.id, x:m.x, z:m.z, rot:m.mesh.rotation.y, broken:!!m.broken,
      tint:m.tint||null, priceMult:machinePriceMult(m), rigged:!!m.rigged})),
    // clients en train de jouer : on note la machine (cellule), l'avancement et la couleur du perso
    players: state.customers
      .filter(c=>c.phase==='playing' && c.target && !c.illegal)
      .map(c=>({mx:c.target.x, mz:c.target.z, t:Math.round(c.playTimer||0), shirt:c.shirt||null})),
  });
}
let lastSaveAt = 0;         // horodatage réel du dernier enregistrement réussi
function flashSaveBadge(){
  const el = document.getElementById('saveBadge');
  if(!el) return;
  el.classList.add('on');
  el.innerText = '💾 sauvegardé';
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.classList.remove('on'); }, 1400);
}
function writeSave(loud){
  // la partie n'est JAMAIS effacée automatiquement (fin de partie ou victoire comprises) :
  // seul le bouton Reset remet à zéro.
  if(!saveReady) return;   // démarrage : on ne touche pas à la sauvegarde avant de l'avoir chargée
  try {

    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave()));
    lastSaveAt = Date.now();
    if(loud) flashSaveBadge();   // badge discret : seulement autosave 10 min + sauvegarde manuelle
  } catch(e){}
}

function clearSave(){ try { localStorage.removeItem(SAVE_KEY); } catch(e){} }

/* enregistrement immédiat quand on quitte / masque l'onglet : rien n'est perdu */
{
  const flush = ()=>{ try { writeSave(); } catch(e){} };
  const onHide = ()=>{ if(document.visibilityState === 'hidden') flush(); };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', onHide);
  _winL.push(['pagehide', flush, undefined], ['beforeunload', flush, undefined]);
}

/* ---- résumé lisible d'une sauvegarde (menu de démarrage) ---- */
function saveAgeLabel(ts){
  if(!ts) return 'date inconnue';
  const d = new Date(ts);
  const diff = Math.max(0, Date.now() - ts);
  const mn = Math.floor(diff/60000);
  let rel;
  if(mn < 1) rel = "à l'instant";
  else if(mn < 60) rel = `il y a ${mn} min`;
  else if(mn < 60*24) rel = `il y a ${Math.floor(mn/60)} h`;
  else rel = `il y a ${Math.floor(mn/1440)} j`;
  const date = d.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'});
  const heure = d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  return `${date} à ${heure} · ${rel}`;
}
function playedLabel(ms){
  const m = Math.floor((ms||0)/60000);
  if(m < 60) return `${m} min de jeu`;
  return `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} de jeu`;
}
function saveSummary(data){
  if(!data) return null;
  const machines = (data.machines||[]).length;
  return {
    when: saveAgeLabel(data.ts),
    line: `Jour ${data.day||1} · ${Math.round(data.money||0)}¢ · dette ${Math.round(data.debt||0)}¢`,
    line2: `${machines} machine${machines>1?'s':''} · réputation ${Math.round(data.rep||0)} · ${playedLabel(data.playMs)}`,
  };
}

function readSave(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || data.v !== SAVE_VERSION) return null;
    data.__untrusted = !saveTrusted(data);
    return data;
  } catch(e){ return null; }
}

/* dernière sauvegarde toutes sources confondues (auto + emplacements) */
function latestSave(){
  const cands = [];
  const auto = readSave();
  if(auto) cands.push({data:auto, label:'Sauvegarde auto', slot:0});
  for(let i=1;i<=SLOT_COUNT;i++){
    const d = readSlot(i);
    if(d) cands.push({data:d, label:`Emplacement ${i}`, slot:i});
  }
  if(!cands.length) return null;
  cands.sort((a,b)=>(b.data.ts||0)-(a.data.ts||0));
  return cands[0];
}

/* ---- emplacements de sauvegarde manuelle ---- */
const SLOT_COUNT = 3;
const slotKey = (i)=>`cc_slot_${i}`;
function readSlot(i){
  try {
    const raw = localStorage.getItem(slotKey(i));
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(!d || d.v !== SAVE_VERSION) return null;
    d.__untrusted = !saveTrusted(d);
    return d;
  } catch(e){ return null; }
}
function writeSlot(i){
  try {
    localStorage.setItem(slotKey(i), JSON.stringify(serializeSave()));
    log(`💾 Partie enregistrée dans l'emplacement ${i}.`);
    flashSaveBadge();
    return true;
  } catch(e){ log("⚠️ Impossible d'enregistrer (stockage plein)."); return false; }
}
function deleteSlot(i){ try { localStorage.removeItem(slotKey(i)); } catch(e){} }
function loadSlot(i){
  const d = readSlot(i);
  if(!d) return false;
  try {
    state.scored = false;
    applySave(d);
    writeSave();                 // la partie chargée devient la partie courante
    renderShop(); updateHUD();
    try{ renderQuestPanel(); }catch(e){}
    log(`📁 Emplacement ${i} chargé : jour ${state.day}, ${Math.round(state.money)}¢ en caisse.`);
    return true;
  } catch(e){ log("⚠️ Cette sauvegarde est illisible."); return false; }
}

let slotOnLoad = null;   // callback optionnel (fermeture du menu titre)
function renderSlots(){
  const list = document.getElementById('slotList');
  if(!list) return;
  list.innerHTML = '';
  for(let i=1;i<=SLOT_COUNT;i++){
    const d = readSlot(i);
    const sum = d ? saveSummary(d) : null;
    const row = document.createElement('div');
    row.className = 'slotRow';
    const info = sum ? `${sum.when}\n${sum.line}\n${sum.line2}` : 'Emplacement vide';
    row.innerHTML = `<div class="slotName">EMPLACEMENT ${i}</div><div class="slotInfo">${info}</div>`;
    const acts = document.createElement('div'); acts.className = 'slotActs';
    const bSave = document.createElement('button');
    bSave.className = 'btn'; bSave.type = 'button';
    bSave.innerText = d ? '💾 Écraser' : '💾 Enregistrer';
    bSave.onclick = ()=>{ if(d && !confirm(`Écraser l'emplacement ${i} ?`)) return; writeSlot(i); renderSlots(); };
    acts.appendChild(bSave);
    if(d){
      const bLoad = document.createElement('button');
      bLoad.className = 'btn pink'; bLoad.type = 'button'; bLoad.innerText = '▶ Charger';
      bLoad.onclick = ()=>{
        if(!confirm(`Charger l'emplacement ${i} ? La partie en cours sera remplacée.`)) return;
        if(loadSlot(i)){
          closeSlotPanel();
          if(slotOnLoad) { const f = slotOnLoad; slotOnLoad = null; f(); }
        }
      };
      const bDel = document.createElement('button');
      bDel.className = 'btn'; bDel.type = 'button'; bDel.innerText = '🗑 Supprimer';
      bDel.onclick = ()=>{ if(!confirm(`Supprimer l'emplacement ${i} ?`)) return; deleteSlot(i); renderSlots(); };
      acts.appendChild(bLoad); acts.appendChild(bDel);
    }
    row.appendChild(acts);
    list.appendChild(row);
  }
}
function openSlotPanel(onLoad){
  slotOnLoad = onLoad || null;
  renderSlots();
  const m = document.getElementById('slotModal');
  if(m) m.style.display = 'flex';
}
function closeSlotPanel(){
  const m = document.getElementById('slotModal');
  if(m) m.style.display = 'none';
}
function initSlotsUI(){
  const c = document.getElementById('slotClose');
  if(c) c.onclick = ()=>{ slotOnLoad = null; closeSlotPanel(); };
  const b = document.getElementById('slotsBtn');
  if(b) b.onclick = ()=>openSlotPanel();
}

function applySave(data){
  setTimeout(()=>{ try{ refreshClosedBtn(); }catch(e){} }, 0);
  Object.assign(state, {
    playMs: data.playMs||0,
    money:data.money, rep:data.rep, day:data.day, debt:data.debt, stage:data.stage,
    // anciennes sauvegardes : la taille venait de l'étape, on la convertit en rangées achetées
    extraCols:(data.extraCols||0) + (data.baseRoom ? 0 : Math.max(0, ([6,9,12][data.stage||0] ?? BASE_COLS) - BASE_COLS)),
    extraRows:(data.extraRows||0) + (data.baseRoom ? 0 : Math.max(0, ([5,7,9][data.stage||0] ?? BASE_ROWS) - BASE_ROWS)),
    cityDecor: data.baseRoom ? !!data.cityDecor : true, grime:(data.grime===undefined?0:data.grime|0),
    // anciennes parties : la déco était offerte, on la leur laisse
    cosmetics: Array.isArray(data.cosmetics) ? data.cosmetics : COSMETICS.map(c=>c.id),

    staff:{...state.staff, ...(data.staff||{})}, dayTimer:data.dayTimer||0,
    dayLength:data.dayLength||state.dayLength, won:!!data.won,
    backroom:!!data.backroom, suspicion:data.suspicion||0, hidden:false,
    busts:data.busts||0, raidsSurvived:data.raidsSurvived||0, lookout:!!data.lookout,
    launderDay:data.launderDay??-1, bribeDay:data.bribeDay??-99, gameOver:!!data.gameOver,
    illegalEarned:data.illegalEarned||0, danger:data.danger||0, closed:!!data.closed,
    unlocks:data.unlocks||[], storyDone:data.storyDone||[],
    questIdx:data.questIdx??0, questProgress:data.questProgress||{}, questsDone:data.questsDone||[],
    stats:{...state.stats, ...(data.stats||{})},
    ledger: (data.ledger && typeof data.ledger === 'object')
      ? {in:data.ledger.in|0, out:data.ledger.out|0, loan:data.ledger.loan|0,
         repay:data.ledger.repay|0, day:data.ledger.day|0, dayIn:data.ledger.dayIn|0}
      // vieille sauvegarde sans journal : on le reconstruit depuis les statistiques
      : {in:(data.stats&&data.stats.earned)|0, out:(data.stats&&data.stats.spent)|0,
         loan:Math.max(0,(data.debt||0)), repay:0, day:data.day||1, dayIn:0},
    logMsgs:data.logMsgs||[],
  });
  // sauvegarde retouchée à la main ? on recale le solde sur le journal des transactions
  if(data.__untrusted){
    const max = maxPlausibleMoney();
    if(state.money > max + 1){
      state.money = Math.max(0, Math.round(max));
      log("⚠️ Sauvegarde modifiée détectée : la caisse a été recalculée depuis le journal.");
    }
  } else auditMoney(true);
  // ---- personnalisations restaurées avant la construction de la salle ----
  if(data.style && typeof data.style === 'object'){
    roomStyle = {...STYLE_DEFAULT, ...data.style};
    roomStyle.owned = Array.isArray(data.style.owned) ? data.style.owned.slice() : ['stripes','plain'];
    if(!roomStyle.owned.includes('stripes')) roomStyle.owned.push('stripes');
    if(!roomStyle.owned.includes('plain')) roomStyle.owned.push('plain');
    writeStyle();
  }
  if(data.brand && typeof data.brand === 'object'){
    clubBrand.name = data.brand.name || BRAND_DEFAULT.name;
    clubBrand.sign = data.brand.sign || BRAND_DEFAULT.sign;
    clubBrand.owned = Array.isArray(data.brand.owned) ? data.brand.owned.slice() : ['neonpink'];
    clubBrand.named = !!data.brand.named;
    if(!clubBrand.owned.includes('neonpink')) clubBrand.owned.push('neonpink');
    writeBrand();
  }
  initGrid();
  (data.machines||[]).forEach(sm=>{
    const def = MACHINES.find(m=>m.id===sm.id) || DECOR.find(d=>d.id===sm.id);
    if(!def) return;
    const {cols,rows} = state.dims;
    if(sm.x<0||sm.x>=cols||sm.z<0||sm.z>=rows||state.grid[sm.z][sm.x]) return;
    const mesh = buildMachineMesh(def.id);
    const p = cellToWorld(sm.x, sm.z, cols, rows);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = sm.rot || 0;
    machinesGroup.add(mesh);
    const machine = {x:sm.x, z:sm.z, def, mesh, busy:false, broken:!!sm.broken,
      tint: sm.tint || null, priceMult: (typeof sm.priceMult==='number' ? sm.priceMult : 1), rigged: !!sm.rigged};
    if(machine.tint) applyMachineTint(mesh, machine.tint);
    mesh.userData.machine = machine;
    state.grid[sm.z][sm.x] = machine;
    state.machines.push(machine);
  });
  // ---- clients qui étaient en train de jouer : on les remet devant leur machine ----
  (data.players||[]).forEach(sp=>{
    const target = state.machines.find(m=>m.x===sp.mx && m.z===sp.mz);
    if(!target || target.busy || target.broken) return;
    const shirt = (typeof sp.shirt==='number') ? sp.shirt : SHIRT_COLORS[Math.floor(Math.random()*SHIRT_COLORS.length)];
    const mesh = buildCharacter(shirt);
    const spot = standSpotFor(target);
    mesh.position.set(spot.x, 0, spot.z);
    setPlayingCharacterVisible(mesh, true);
    customersGroup.add(mesh);
    target.busy = true;
    const {cols:cc, rows:rr, doorRow:dr} = state.dims;
    const doorP = cellToWorld(0, dr, cc, rr);
    state.customers.push({
      mesh, target, targetPos:spot.clone(),
      gatePos:new THREE.Vector3(doorP.x-CELL/2+0.5, 0, doorP.z),
      doorPos:new THREE.Vector3(doorP.x-CELL-1.2, 0, doorP.z),
      shirt, phase:'playing',
      playTimer: Math.max(0, Math.min(sp.t||0, target.def.time-200)),
    });
  });
  setHidden(false);
  // le nom validé de l'enseigne doit réapparaître partout après un chargement
  try{ writeBrand(); rebuildExteriorSign(); refreshBrandUI(); }catch(e){}
  document.getElementById('log').innerHTML = state.logMsgs.map(m=>`<div>${m}</div>`).join('');
}
addWin('beforeunload', ()=>{ writeSave(); });
addWin('visibilitychange', ()=>{ if(document.visibilityState==='hidden') writeSave(); });

/* ============================================================
   SCORE, STATS & CLASSEMENT
   ============================================================ */
const SCORE_KEY = 'cc_scores_v1';
function computeScore(){
  const st = state.stats;
  const days = state.day - 1;
  return Math.max(0, Math.round(
    st.earned * 0.6
    + state.money * 0.4
    + state.rep * 25
    + days * 40
    + state.raidsSurvived * 120
    + state.machines.length * 15
    + (state.debt <= 0 ? 600 : 0)
    - st.busts * 200
    - st.incidents * 25
    - state.suspicion * 2
  ));
}
function loadScores(){
  try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '[]'); } catch(e){ return []; }
}
function saveScore(entry){
  const list = loadScores();
  list.push(entry);
  list.sort((a,b)=>b.score-a.score);
  const top = list.slice(0,10);
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(top)); } catch(e){}
  return top;
}
function fmtTime(ms){
  const total = Math.round(ms/1000);
  const m = Math.floor(total/60), sec = total%60;
  return `${m}m ${String(sec).padStart(2,'0')}s`;
}
function recordRun(reason){
  if(state.scored) return null;
  if(state.day<=1 && state.stats.earned<=0) return null;
  state.scored = true;
  const entry = {
    score: computeScore(), day: state.day, money: Math.round(state.money),
    rep: Number(state.rep.toFixed(1)), busts: state.stats.busts,
    incidents: state.stats.incidents, time: Math.round(state.stats.timeMs),
    reason, date: new Date().toISOString().slice(0,10),
  };
  saveScore(entry);
  log(`🏆 Partie enregistrée : ${entry.score} points (${reason}).`);
  return entry;
}
function renderScorePanel(){
  const modal = document.getElementById('scoreModal');
  if(!modal) return;
  const st = state.stats;
  document.getElementById('scoreNow').innerText = computeScore().toLocaleString('fr-FR');
  document.getElementById('statList').innerHTML = [
    ['📅 Jours tenus', state.day-1],
    ['⏱️ Temps de jeu', fmtTime(st.timeMs)],
    ['💰 Jetons gagnés', Math.round(st.earned)+'¢'],
    ['🕶️ Dont clandestin', Math.round(state.illegalEarned)+'¢'],
    ['🛒 Dépensé', Math.round(st.spent)+'¢'],
    ['🕹️ Machines posées', st.machinesBuilt],
    ['🙋 Clients servis', st.customers],
    ['🚪 Clandestins acceptés / refusés', st.passed+' / '+st.refused],
    ['🔦 Fouilles', st.searched],
    ['🚨 Descentes subies', st.raids],
    ['⚖️ Descentes ratées', st.busts],
    ['🔧 Incidents', st.incidents],
  ].map(([k,v])=>`<div class="statRow"><span>${k}</span><b>${v}</b></div>`).join('');
  const scores = loadScores();
  document.getElementById('scoreBoard').innerHTML = scores.length
    ? scores.map((e,i)=>`<div class="statRow"><span>${i+1}. J${e.day} · ${fmtTime(e.time)} · ${e.reason}</span><b>${e.score.toLocaleString('fr-FR')}</b></div>`).join('')
    : '<div class="statRow"><span>Aucune partie enregistrée pour le moment.</span></div>';
}
function openScorePanel(){
  renderScorePanel();
  document.getElementById('scoreModal').style.display = 'flex';
}
document.getElementById('scoreBtn').onclick = openScorePanel;
document.getElementById('closeScoreBtn').onclick = ()=>{ document.getElementById('scoreModal').style.display='none'; };
document.getElementById('clearScoreBtn').onclick = ()=>{
  try { localStorage.removeItem(SCORE_KEY); } catch(e){}
  renderScorePanel();
};

/* ============================================================
   MAIN LOOP
   ============================================================ */
let lastTime=null;
/* ---------- day/night ambiance cycle ----------
   phase 0=midnight, 0.25=dawn, 0.5=midday, 0.75=dusk, back to 1=midnight.
   Drives the sky dome gradient, sun/moon position, stars, and light levels. */
const SKY_KEYFRAMES = {
  top:    [0x05030f, 0x3a3a6c, 0x2a6bd6, 0x2a1440],   // midnight, dawn, midday, dusk
  bottom: [0x150826, 0xff9a5c, 0xbfe0ff, 0xff6a8a],
};
const _c0=new THREE.Color(), _c1=new THREE.Color(), _topOut=new THREE.Color(), _botOut=new THREE.Color();
function cycleLerp(hexArr, phase, out){
  const seg = phase*4;
  const idx = Math.floor(seg)%4, next=(idx+1)%4, t=seg-Math.floor(seg);
  _c0.set(hexArr[idx]); _c1.set(hexArr[next]);
  out.copy(_c0).lerp(_c1, t);
  return out;
}
function updateDayNight(){
  // le mode choisi par le joueur fige la lumière (jour clair / nuit néon) —
  // 'auto' garde le cycle jour/nuit lié à la journée de jeu
  const phase = lightMode==='day' ? 0.5
    : lightMode==='night' ? 0.02
    : state.dayTimer/state.dayLength;
  const angle = phase*Math.PI*2 - Math.PI/2;
  const sunHeight = Math.sin(angle);
  const dayFactor = Math.max(0, sunHeight);
  const nightFactor = Math.max(0, -sunHeight);

  // plancher de lumière : même en pleine nuit la salle et la rue restent lisibles
  // (contraste plus marqué : soleil franc le jour, bleu nuit dramatique le soir)
  sun.intensity = 0.35 + dayFactor*1.6;
  sun.color.setHSL(0.09 + dayFactor*0.05, 0.55 - dayFactor*0.35, 0.55 + dayFactor*0.12);
  ambientLight.intensity = (exteriorMode ? 1.15 : 0.95) + dayFactor*1.5;
  ambientLight.color.setHex(nightFactor>0.35 ? 0x6f7bcc : 0xb9a8dd);
  streetMoon.visible = nightFactor > 0.05;
  streetMoon.intensity = 0.35 + nightFactor*1.15;
  if(scene.fog){
    scene.fog.near = exteriorMode ? (60 - nightFactor*14) : (isMobile?34:42);
    scene.fog.far = exteriorMode ? (isMobile?170:210) : (isMobile?95:125);
  }


  cycleLerp(SKY_KEYFRAMES.top, phase, _topOut);
  cycleLerp(SKY_KEYFRAMES.bottom, phase, _botOut);
  skyDome.material.uniforms.topColor.value.copy(_topOut);
  skyDome.material.uniforms.bottomColor.value.copy(_botOut);
  if(!exteriorMode){
    scene.background.copy(_topOut);
    scene.fog.color.copy(_botOut);
  } else {
    scene.fog.color.copy(_botOut);
  }

  const sunAngle = angle;
  sunSprite.position.set(Math.cos(sunAngle)*SKY_R, Math.max(-15,sunHeight*SKY_R*0.55)+18, -20);
  sunSprite.material.opacity = Math.min(1, dayFactor*1.4);
  sun.position.set(Math.cos(sunAngle)*12, Math.max(3,sunHeight*14+6), 8);

  const moonAngle = angle+Math.PI;
  const moonHeight = Math.sin(moonAngle);
  const mx = Math.cos(moonAngle)*SKY_R, my = Math.max(-15,moonHeight*SKY_R*0.55)+18;
  moonSprite.position.set(mx,my,-20);
  moonHalo.position.set(mx,my,-20);
  const moonOpacity = Math.min(1, nightFactor*1.4);
  moonSprite.material.opacity = moonOpacity;
  moonHalo.material.opacity = moonOpacity*0.7;

  if(starField) starField.material.opacity = nightFactor*0.85;

  // les halos néon s'estompent en plein jour (sinon grosses taches blanches)
  const haloFactor = 0.18 + nightFactor*0.9;
  for(let i=0;i<nightHalos.length;i++){
    const h = nightHalos[i];
    if(!h.parent) continue;
    h.material.opacity = (h.userData.maxOpacity ?? 1) * Math.min(1, haloFactor);
    const s = (h.userData.baseSize ?? 1) * (0.7 + haloFactor*0.35);
    h.scale.set(s,s,1);
  }

  // lampadaires : éteints en plein jour, allumés au crépuscule
  const lampFactor = Math.min(1, Math.max(0, (nightFactor + 0.12) * 1.35));
  for(let i=0;i<nightLamps.length;i++){
    const l = nightLamps[i];
    if(!l.parent) continue;
    l.intensity = (l.userData.maxIntensity ?? 1) * lampFactor;
  }
  for(let i=0;i<lightCones.length;i++){
    const c = lightCones[i];
    if(!c.parent) continue;
    c.visible = lampFactor > 0.08;
    c.material.opacity = (c.userData.maxOpacity ?? 0.12) * lampFactor;
  }
  nightAmount = lampFactor;
}


function animate(ts){
  if(_disposed) return;
  if(lastTime===null) lastTime=ts;
  const dt = Math.min(80, ts-lastTime); lastTime=ts;
  if(!state.paused) state.playMs = (state.playMs||0) + dt;
  if(ts - saveTimer > AUTOSAVE_MS){ saveTimer = ts; writeSave(true); }
  if(canvas.clientWidth && (renderer.domElement.width!==canvas.clientWidth*renderer.getPixelRatio())) resize();

  // scintillement doux des écrans + purge de ceux dont la machine a été vendue
  for(let i=screenMats.length-1;i>=0;i--){
    const s = screenMats[i];
    if(!s.parent){ screenMats.splice(i,1); continue; }
    s.material.emissiveIntensity = 1.25 + Math.sin(ts*0.004 + s.userData.flick) * 0.35;
  }

  if(!state.paused){
    state.spawnTimer+=dt;
    if(state.spawnTimer>=state.spawnEvery){ state.spawnTimer=0; spawnCustomer(); }
    updateCustomers(dt);
    for(let i=floaters.length-1;i>=0;i--){
      const f=floaters[i]; f.life-=dt; f.sp.position.y+=dt*0.0006;
      f.sp.material.opacity = Math.max(0,f.life/1100);
      if(f.life<=0){ scene.remove(f.sp); floaters.splice(i,1); }
    }
    updateParticles(dt);
    updateRaid(dt);
    updateDoor(dt);
    if(state.closed){
      state.suspicion = Math.max(0, state.suspicion - dt*0.0018);
      state.danger = Math.max(0, state.danger - dt*0.0012);
    }
    state.stats.timeMs += dt;
    state.dayTimer+=dt;
    updateDayNight();
    if(state.dayTimer>=state.dayLength){ state.dayTimer=0; newDay(); }
    updateHUD();
  }
  // projecteurs qui balaient le ciel dès la tombée de la nuit
  for(let i=0;i<searchlights.length;i++){
    const sl = searchlights[i];
    const on = exteriorMode ? nightAmount : 0;
    sl.grp.visible = on > 0.06;
    if(!sl.grp.visible) continue;
    const t2 = ts*0.001;
    sl.grp.rotation.y = t2*sl.speed + sl.phase;
    sl.grp.rotation.z = Math.sin(t2*0.45 + sl.phase)*0.42;
    sl.spot.intensity = on * (state.raid ? 26 : 14);
    sl.beam.material.opacity = on * 0.035;
  }
  // enseignes néon + marquise de l'entrée
  if(exteriorMode){
    const tn = ts*0.001;
    if(introLetter){
      introLetter.position.y = introLetter.userData.baseY + Math.sin(tn*2.2)*0.05;
      introLetter.rotation.y = 0.4 + Math.sin(tn*0.8)*0.15;
      const pulse = 0.7 + 0.3*Math.abs(Math.sin(tn*2.6));
      if(introLetter.userData.halo){
        introLetter.userData.halo.material.opacity = pulse;
        introLetter.userData.halo.scale.setScalar(0.6 + pulse*0.5);
      }
      if(introLetter.userData.tag) introLetter.userData.tag.position.y = 1.15 + Math.sin(tn*2.2)*0.06;
    }
    const signs = exteriorBuildingGroup.userData.neonSigns || [];

    for(const s of signs){
      const flick = Math.random() < 0.012 ? 0.25 : 0.65 + 0.35*Math.abs(Math.sin(tn*s.freq + s.phase));
      s.panel.material.opacity = flick;
      s.panel.material.transparent = true;
      s.halo.material.opacity *= flick;

    }
    const bulbs = exteriorBuildingGroup.userData.marqueeBulbs || [];
    for(let i=0;i<bulbs.length;i++){
      const on = ((Math.floor(tn*4) + i) % 3) !== 0;
      bulbs[i].material.emissiveIntensity = on ? 1.6 : 0.15;
    }
  }
  // vie de la piste de danse : dalles qui pulsent, boule à facettes, spots mobiles

  if(!exteriorMode){
    const t = ts*0.001;
    for(let i=0;i<danceTiles.length;i++){
      const tile = danceTiles[i];
      const pulse = 0.25 + 0.75*Math.abs(Math.sin(t*2.2 + tile.userData.phase));
      tile.material.emissiveIntensity = pulse;
      tile.material.emissive.setHSL(((t*0.12 + tile.userData.phase*0.09) % 1), 0.85, 0.55);
    }
    if(discoBall) discoBall.rotation.y = t*0.8;
    for(let i=0;i<dancers.length;i++){
      const d = dancers[i];
      const beat = Math.abs(Math.sin(t*2.4 + d.phase));
      danceCharacter(d.wrap, t*4.4 + d.phase, d.style);
      if(d.style==='jump'){
        d.wrap.position.y = d.base + beat*0.22;
        d.wrap.rotation.z = Math.sin(t*2.4 + d.phase)*0.06;
      } else if(d.style==='sway'){
        d.wrap.position.y = d.base + beat*0.05;
        d.wrap.rotation.z = Math.sin(t*1.6 + d.phase)*0.16;
        d.wrap.position.x = d.x + Math.sin(t*1.2 + d.phase)*0.18;
      } else if(d.style==='spin'){
        d.wrap.rotation.y += 0.02;
        d.wrap.position.y = d.base + beat*0.1;
      } else { // dj
        d.wrap.position.y = d.base + beat*0.06;
        d.wrap.rotation.z = Math.sin(t*2.4)*0.05;
      }
    }
    zoneLights.forEach((l,i)=>{
      if(l.userData.kind==='dance'){
        const b = l.userData.base;
        l.position.set(b.x + Math.sin(t*1.4 + l.userData.seed)*1.4, b.y, b.z + Math.cos(t*1.1 + l.userData.seed)*1.2);
        l.intensity = 1.2 + Math.abs(Math.sin(t*3 + i))*1.2;
      } else if(l.userData.kind==='back'){
        l.intensity = 1.2 + Math.sin(t*1.2)*0.25 + (state.hidden ? -0.6 : 0);
      }
    });
  }

  disco.setDucked(exteriorMode || state.paused);

  if(exteriorMode){
    pedestrians.forEach(p=>{
      p.z += p.dir*p.speed*dt/1000;
      if(p.z>p.zMax){ p.z=p.zMax; p.dir=-1; p.wrap.rotation.y=Math.PI; }
      if(p.z<p.zMin){ p.z=p.zMin; p.dir=1; p.wrap.rotation.y=0; }
      p.wrap.position.z = p.z;
      if(!p.body) p.body = charBody(p.wrap);
      stepCharacter(p.body, performance.now()/170*Math.max(0.6,p.speed*1.6), 1);
    });
    if(cars.length){
      const roadCells = roadCellSet();
      const lane = 0.5;
      cars.forEach(c=>{
        if(!c.next && c.cell){
          const again = nextRoadCell(c, roadCells);
          if(again) c.next = [again.x, again.z];
        }
        if(!c.next){

          // ancienne voiture de la ville de départ : trajet linéaire
          c.z += (c.dir||1)*c.speed*dt/1000;
          if(c.dir>0 && c.z>c.zMax) c.z = c.zMin;
          if(c.dir<0 && c.z<c.zMin) c.z = c.zMax;
          c.wrap.position.z = c.z;
          return;
        }
        c.t += (c.speed*dt/1000) / HOOD_TILE;
        while(c.t >= 1){
          c.t -= 1;
          c.from = (DIR_VECT.findIndex(([dx,dz]) => c.cell[0]+dx===c.next[0] && c.cell[1]+dz===c.next[1]) + 2) % 4;
          c.cell = c.next;
          const go = nextRoadCell(c, roadCells);
          if(!go){ c.t = 0; c.next = null; return; }
          c.next = [go.x, go.z];
        }
        const ax = c.cell[0]*HOOD_TILE, az = c.cell[1]*HOOD_TILE;
        const bx = c.next[0]*HOOD_TILE, bz = c.next[1]*HOOD_TILE;
        const hx = bx-ax, hz = bz-az;
        const len = Math.hypot(hx,hz) || 1;
        // décalage à droite du sens de marche : chaque voiture reste sur sa voie
        const ox = (-hz/len)*lane, oz = (hx/len)*lane;
        c.wrap.position.set(ax + hx*c.t + ox, 0, az + hz*c.t + oz);
        c.wrap.rotation.y = Math.atan2(hx, hz);
      });
    }

    const now = performance.now()/1000;
    extMovers.forEach(m=>{
      if(m.type==='queue'){
        // badauds qui piétinent en attendant d'entrer
        m.wrap.position.y = (m.base||0) + Math.abs(Math.sin(now*2 + m.phase))*0.045;
        m.wrap.rotation.y += Math.sin(now*0.7 + m.phase)*0.004;
        if(m.body===undefined) m.body = charBody(m.wrap);
        if(m.body) stepCharacter(m.body, now*2.4 + m.phase, 0.35);
      } else if(m.type==='cat'){
        m.z += m.dir*m.speed*dt/1000;
        if(m.z>m.zMax){ m.z=m.zMax; m.dir=-1; m.wrap.rotation.y=Math.PI; }
        if(m.z<m.zMin){ m.z=m.zMin; m.dir=1; m.wrap.rotation.y=0; }
        m.wrap.position.z = m.z;
      } else if(m.type==='pigeon'){
        m.t += dt/1000;
        if(m.t>m.nextHop){
          m.t = 0; m.nextHop = 1+Math.random()*2.5;
          m.x += (Math.random()-0.5)*0.6;
          m.z += (Math.random()-0.5)*0.9;
          m.wrap.rotation.y = Math.random()*6.28;
          m.wrap.position.x = m.x; m.wrap.position.z = m.z;
        }
        // petit picorage
        m.wrap.position.y = Math.max(0, Math.sin(now*6 + m.z)*0.02);
      }
    });
    extFlickers.forEach(f=>{
      const on = Math.sin(now*f.speed + f.phase) > -0.75;
      f.obj.traverse(o=>{
        if(o.isMesh && o.material && o.material.emissiveIntensity !== undefined){
          o.material.emissiveIntensity = on ? 1.2 : 0.15;
        }
      });
    });
    if(patrolCar){
      // la patrouille sort dès que la suspicion dépasse 35, ou pendant une descente
      const active = state.suspicion > 35 || state.danger > 55 || !!state.raid;
      patrolCar.wrap.visible = active;
      if(active){
        patrolCar.z += patrolCar.dir*patrolCar.speed*dt/1000;
        if(patrolCar.z < patrolCar.zMin) patrolCar.z = patrolCar.zMax;
        patrolCar.wrap.position.z = patrolCar.z;
        const beacons = patrolCar.wrap.children[0]?.userData?.beacons;
        if(beacons){
          const blink = Math.sin(now*8) > 0;
          beacons[0].material.emissiveIntensity = blink ? 2.2 : 0.1;
          beacons[1].material.emissiveIntensity = blink ? 0.1 : 2.2;
        }
      }
    }
  }

  updateCinematic(dt);
  state.storyTick = (state.storyTick||0) + dt;
  if(state.storyTick > 800){ state.storyTick = 0; maybeStory(); }

  renderer.render(scene,camera);
  _raf = requestAnimationFrame(animate);
}

/* ---------- hook de debug (dev uniquement) ---------- */
if(import.meta.env && import.meta.env.DEV){
  window.__cosmicCoin = {
    get state(){ return state; },
    startRaid, resolveRaid, setHidden, log, spawnVisitor, addDanger,
    playCinematic, maybeStory, STORY,
    get doorVisitor(){ return doorVisitor; }, renderShop, updateHUD,
    get orbit(){ return orbit; },
    get camPos(){ return camera.position.toArray(); },
    get scene(){ return scene; },
    get exteriorBuildingGroup(){ return exteriorBuildingGroup; },
  };
}

/* ---------- init ---------- */
preloadModels(()=>{
  document.getElementById('loadModal').style.display='none';
  resize();
  const saved = readSave();
  let loaded = false;
  if(saved){
    try {
      state.scored = false;
      applySave(saved);
      loaded = true;
    } catch(e){
      // sauvegarde illisible : on repart proprement SANS l'effacer (elle reste récupérable)
      console.error('[CosmicCoin] sauvegarde illisible', e);
      loaded = false;
    }
  }
  if(!loaded){
    initGrid();
    setExteriorMode(true);
    frameAbandonedClub();
  }
  saveReady = true;   // à partir d'ici, la partie peut être enregistrée sans risque


  buildExteriorStreet(16);
  initHoodEditor();
  initHoodArrows();
  initBigScreen();
  initTapPlace();
  initCamPad();
  initShopTabs();
  initDock();
  initSlotsUI();


  initBrandUI();
  initStyleUI();
  initCosmeticsUI();
  initWallUI();

  updateCamera();
  renderShop();
  updateHUD();
  document.getElementById('stageLabel').innerText = STAGES[state.stage].name;
  if(loaded) log(`Partie rechargée automatiquement : jour ${state.day}, ${Math.round(state.money)}¢ en caisse.`);
  else log("Une boîte de nuit condamnée, des planches sur la porte… et une enveloppe qui dépasse en dessous. Clique dessus.");
  if(lightRender) log("Rendu léger actif : la salle s'affiche avec des placeholders (⚡ dans la barre du haut).");
  else if(missingModels.length) log(`${missingModels.length} modèle(s) 3D indisponible(s) — remplacés par des placeholders.`);
  renderQuestPanel();
  { const q0 = activeQuest(); if(q0) log(`🎯 Mission : ${q0.title}. ${q0.intro}`); }

  /* ---- menu de démarrage (façon jeu PC) ---- */
  const smEl = document.getElementById('startMenu');
  if(smEl){
    const smCont = document.getElementById('smContinue');
    const smInfo = document.getElementById('smSaveInfo');
    const smNew  = document.getElementById('smNew');
    const smSc   = document.getElementById('smScores');
    const smMus  = document.getElementById('smMusic');
    const smCred = document.getElementById('smCredits');
    let menuWasPaused = state.paused;

    const openMenu = ()=>{
      menuWasPaused = state.paused;
      state.paused = true;
      smEl.style.display = 'flex';
    };
    const closeMenu = ()=>{
      smEl.style.display = 'none';
      state.paused = menuWasPaused && state.gameOver ? true : false;
      document.getElementById('pauseBtn').innerText = state.paused ? '▶ Reprendre' : '⏸ Pause';
    };
    const refreshMenu = ()=>{
      // un seul bouton : il reprend toujours la sauvegarde la plus récente
      const best = latestSave();
      if(best){
        const s = saveSummary(best.data);
        smInfo.innerText = `${best.label} · ${s.when}\n${s.line}\n${s.line2}`;
        smCont.disabled = false;
      } else if(loaded){
        smInfo.innerText = `Partie en cours\nJour ${state.day} · ${Math.round(state.money)}¢`;
        smCont.disabled = false;
      } else {
        smInfo.innerText = "Aucune sauvegarde trouvée — lance une nouvelle partie";
        smCont.disabled = true;
      }
      if(smMus) smMus.firstChild.nodeValue = disco.isOn && disco.isOn() ? '🔊 Musique : activée' : '🔈 Musique : coupée';
    };



    smCont.onclick = ()=>{
      const best = latestSave();
      if(!best){ closeMenu(); return; }
      try {
        state.scored = false;
        applySave(best.data);
        loaded = true;
        writeSave();
        renderShop(); updateHUD();
        try{ renderQuestPanel(); }catch(e){}
        log(`▶ Reprise : ${best.label} — jour ${state.day}, ${Math.round(state.money)}¢ en caisse.`);
      } catch(e){ log("⚠️ Impossible de charger cette sauvegarde."); }
      closeMenu();
    };

    smNew.onclick  = ()=>{ startNewGame(); loaded = false; closeMenu(); };
    smSc.onclick   = ()=>{ openScorePanel(); };
    const smSlots = document.getElementById('smSlots');
    if(smSlots) smSlots.onclick = ()=>openSlotPanel(()=>{ loaded = true; refreshMenu(); closeMenu(); });

    if(smMus) smMus.onclick = ()=>{ disco.toggle(); refreshMusicUI(); refreshMenu(); };
    if(smCred) smCred.onclick = ()=>{
      showEvent('CRÉDITS', "Cosmic Coin — simulation de boîte de nuit clandestine, été 1988. Conception, code et néons : toi et Lovable. Musique disco générée en temps réel. Merci de tenir la porte.");
    };

    refreshMenu();
    openMenu();
    const mmBtn = document.getElementById('menuBtn');
    if(mmBtn) mmBtn.onclick = ()=>{ refreshMenu(); openMenu(); };

    // sauvegarde manuelle : badge + ligne de journal, pour quitter l'esprit tranquille
    const saveNowBtn = document.getElementById('saveNowBtn');
    if(saveNowBtn) saveNowBtn.onclick = ()=>{
      writeSave(true);
      log("💾 Partie sauvegardée.");
    };

    // quitter le jeu : on enregistre, puis on ferme (ou on revient au menu si le navigateur refuse)
    const quitBtn = document.getElementById('quitBtn');
    if(quitBtn) quitBtn.onclick = ()=>{
      writeSave(true);
      state.paused = true;
      try { window.close(); } catch(e){}
      setTimeout(()=>{
        refreshMenu(); openMenu();
        log("💾 Partie sauvegardée — tu peux fermer la fenêtre.");
      }, 220);
    };
  }


  _raf = requestAnimationFrame(animate);
});


return () => {
  _disposed = true;
  cancelAnimationFrame(_raf);
  _winL.forEach(([t,f,o])=>window.removeEventListener(t,f,o));
  try { disco.dispose(); } catch(e) {}
  try { renderer.dispose(); } catch(e) {}
};
}
