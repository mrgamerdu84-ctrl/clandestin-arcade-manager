// @ts-nocheck
/* Cosmic Coin — salle d'arcade clandestine (moteur 3D, procédural, sans modèle externe) */
import * as THREE from "three";

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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function makeSprite(text, color){
  const cvs = document.createElement('canvas'); cvs.width=128; cvs.height=48;
  const c = cvs.getContext('2d');
  c.font='bold 28px monospace'; c.fillStyle=color; c.textAlign='center';
  c.fillText(text,64,34);
  const tex = new THREE.CanvasTexture(cvs);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}));
  sp.scale.set(1.6,0.6,1);
  return sp;
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
scene.fog = new THREE.Fog(0x0d0618, isMobile?16:22, isMobile?34:46);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

// ambient + directional light
const ambientLight = new THREE.AmbientLight(0x8877aa, 0.9);
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
// unified mouse + touch handling via Pointer Events (supports 1-finger rotate, 2-finger pinch zoom)
const pointers = new Map(); // pointerId -> {x,y}
let dragging=false, dragMoved=false;
let pinchStartDist=0, pinchStartRadius=0;

function pointerDist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

canvas.addEventListener('pointerdown', e=>{
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  dragMoved=false;
  if(pointers.size===1){
    dragging=true;
  } else if(pointers.size===2){
    dragging=false;
    const pts=[...pointers.values()];
    pinchStartDist = pointerDist(pts[0],pts[1]);
    pinchStartRadius = orbit.radius;
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
      orbit.radius = Math.min(30, Math.max(7, pinchStartRadius * (pinchStartDist/d)));
      updateCamera();
    }
    dragMoved=true;
    return;
  }
  if(dragging && pointers.size===1){
    orbit.theta -= dx*0.006;
    orbit.phi = Math.min(1.45, Math.max(0.35, orbit.phi - dy*0.006));
    if(Math.abs(dx)+Math.abs(dy) > 3) dragMoved = true;
    updateCamera();
  }
});
function releasePointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size===0){ dragging=false; pinchStartDist=0; }
  else if(pointers.size===1){
    dragging=true;
    const [id,pt]=[...pointers.entries()][0];
    pointers.set(id,pt);
    pinchStartDist=0;
  }
}
addWin('pointerup', releasePointer);
addWin('pointercancel', releasePointer);
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  orbit.radius = Math.min(30, Math.max(7, orbit.radius + e.deltaY*0.01));
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
const MODEL_TEMPLATES = {}; // always empty now — kept only so old lookups (MODEL_TEMPLATES[x]) fail safely
const GLB_KEY_MAP = {
  arcade:'ARCADE', pinball:'PINBALL', claw:'CLAW', vending:'VENDING', ticket:'TICKET',
  airhockey:'AIRHOCKEY', basket:'BASKET', dance:'DANCE', gambling:'GAMBLING', wheel:'WHEEL',
  prizes:'PRIZES', cashregister:'CASHREGISTER',
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

function preloadModels(onDone){
  // Fully procedural now — no external model files to fetch, so nothing can
  // ever fail to load. Kept as a function (with a tiny cosmetic delay) so the
  // loading screen still reads naturally.
  setTimeout(onDone, 300);
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
    return wrapper;
  }
  const fn = BUILDERS[defId] || BUILDERS['arcade'];
  return fn();
}

/* ---------- character (real model, with procedural fallback) ---------- */
function buildCharacter(shirtColor){
  if(MODEL_TEMPLATES.CUSTOMER){
    const wrapper = group();
    const clone = MODEL_TEMPLATES.CUSTOMER.clone(true);
    clone.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } });
    wrapper.add(clone);
    fitHeight(clone, 1.3);
    return wrapper;
  }
  const g = group();
  const legs = cyl(0.16,0.18,0.5, PAL.black,10); legs.position.y=0.25; g.add(legs);
  const body = cyl(0.2,0.24,0.55, shirtColor,10); body.position.y=0.75; g.add(body);
  const head = sphere(0.17, '#f2c9a0'); head.position.y=1.15; g.add(head);
  const hair = sphere(0.18, '#3b2a20'); hair.position.y=1.22; hair.scale.set(1,0.7,1); g.add(hair);
  g.userData.bodyMesh = body;
  return g;
}

/* ============================================================
   ROOM / STAGE CONSTRUCTION
   ============================================================ */
const CELL = 2;
const STAGES = [
  {name:"SALLE D'ARCADE", cols:6, rows:5, unlockRep:0, cost:0, theme:'arcade'},
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
  const base1 = casino ? '#3a1020' : '#241238';
  const base2 = casino ? '#4a1830' : '#2c1548';
  const accent = casino ? '#c9a04a' : '#6b4e9e';
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

function buildRoom(stageIdx){
  while(roomGroup.children.length) roomGroup.remove(roomGroup.children[0]);
  const st = STAGES[stageIdx];
  const cols=st.cols, rows=st.rows;
  const casino = st.theme==='casino';
  const floorA = casino ? '#4a1830' : PAL.floorA;
  const floorB = casino ? '#3a1226' : PAL.floorB;
  const wallCol = casino ? PAL.casinoWallDark : PAL.wallDark;
  const stripeCol = casino ? PAL.casinoGold : PAL.wallOrange;
  const stripeCol2 = casino ? PAL.casinoRed : PAL.wallPurple;
  const wallTint = casino ? '#ffb27a' : '#ffffff';

  // carpet floor — a single woven-pattern plane instead of flat tiles, for a
  // proper casino/arcade carpet look instead of bare colored squares
  const carpetTex = makeCarpetTexture(casino);
  carpetTex.repeat.set(cols, rows);
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(cols*CELL, rows*CELL),
    new THREE.MeshStandardMaterial({map:carpetTex, roughness:0.88, metalness:0.05})
  );
  floorPlane.rotation.x = -Math.PI/2;
  floorPlane.receiveShadow = true;
  roomGroup.add(floorPlane);
  // outer walls (skip a gap on west wall middle for the door)
  const wallH = 2.4;
  const doorRow = Math.floor(rows/2);
  function wallSeg(px,pz,rotY,len){
    if(MODEL_TEMPLATES.WALL){
      const obj = MODEL_TEMPLATES.WALL.clone(true);
      obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
      fitHeight(obj, wallH);
      if(casino) tintObject(obj, wallTint);
      const wrap = group(); wrap.add(obj);
      wrap.position.set(px,0,pz); wrap.rotation.y=rotY;
      roomGroup.add(wrap);
      return;
    }
    const g = group();
    const base = box(len,wallH,0.25, wallCol); base.position.y=wallH/2; g.add(base);
    const stripe = box(len,0.5,0.27, stripeCol); stripe.position.y=wallH*0.32; g.add(stripe);
    const stripe2 = box(len,0.3,0.28, stripeCol2); stripe2.position.y=wallH*0.15; g.add(stripe2);
    g.position.set(px,0,pz); g.rotation.y=rotY;
    roomGroup.add(g);
  }
  // north & south walls
  for(let x=0;x<cols;x++){
    const pN = cellToWorld(x,0,cols,rows);
    wallSeg(pN.x, pN.z-CELL/2, 0, CELL);
    const pS = cellToWorld(x,rows-1,cols,rows);
    wallSeg(pS.x, pS.z+CELL/2, Math.PI, CELL);
  }
  // east & west walls (skip door cell on west)
  for(let z=0;z<rows;z++){
    const pE = cellToWorld(cols-1,z,cols,rows);
    wallSeg(pE.x+CELL/2, pE.z, Math.PI/2, CELL);
    if(z!==doorRow){
      const pW = cellToWorld(0,z,cols,rows);
      wallSeg(pW.x-CELL/2, pW.z, -Math.PI/2, CELL);
    }
  }
  // posters along the north wall (the one without a door), for a decorated look
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
  // columns at corners for bigger stages
  if(stageIdx>0){
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
  // neon sign
  const signText = casino ? "CASINO" : (stageIdx===1 ? "ARCADE" : "COSMIC");
  const signSprite = makeSprite(signText, casino?'#ffd23f':'#ff2e88');
  const northMid = cellToWorld(cols/2-0.5,0,cols,rows);
  signSprite.position.set(northMid.x, wallH+0.6, northMid.z-CELL/2);
  signSprite.scale.set(3,1.1,1);
  roomGroup.add(signSprite);
  const signGlow = new THREE.PointLight(casino?0xffd23f:0xff2e88, 1.1, 8, 2);
  signGlow.position.set(northMid.x, wallH+0.4, northMid.z-CELL/2+0.6);
  roomGroup.add(signGlow);
  const signHalo = makeGlowSprite(casino?'#ffd23f':'#ff2e88', 3.4);
  signHalo.position.copy(signSprite.position);
  roomGroup.add(signHalo);
  roomGroup.userData.signHalo = signHalo;

  // door — a proper detailed doorway (frame, glass panels, handles, canopy)
  const doorP = cellToWorld(0,doorRow,cols,rows);
  const doorway = buildDoorway(casino, wallH*0.82);
  doorway.position.set(doorP.x-CELL/2, 0, doorP.z);
  doorway.rotation.y = -Math.PI/2;
  roomGroup.add(doorway);

  scene.fog.color.set(casino?0x1a0812:0x0d0618);
  scene.background.set(casino?0x1a0812:0x0d0618);

  orbit.target.set(0,0.5,0);
  orbit.radius = 7 + Math.max(cols,rows)*0.9;
  updateCamera();

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
const pedestrians = [];
const cars = [];

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
};


function placeExt(parentGroup, key, spec, x, z, rotY){
  let obj;
  if(MODEL_TEMPLATES[key]){
    obj = MODEL_TEMPLATES[key].clone(true);
    obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    if(spec.mode==='footprint') fitFootprint(obj, spec.target); else fitHeight(obj, spec.target);
  } else if(EXT_BUILDERS[key]){
    obj = EXT_BUILDERS[key]();
  } else return null;
  const wrap = group(); wrap.add(obj);
  wrap.position.set(x,0,z); wrap.rotation.y = rotY||0;
  parentGroup.add(wrap);
  return wrap;
}

// static street dressing — built once, independent of the arcade's stage/size
function buildExteriorStreet(maxSpan){
  while(exteriorStreetGroup.children.length) exteriorStreetGroup.remove(exteriorStreetGroup.children[0]);
  pedestrians.length = 0;
  cars.length = 0;

  const sidewalkX = -8;
  const roadX = -10.6;
  const roadLaneOffset = 0.55; // two lanes, cars keep to their side
  const houseX = -15.5;
  const zMin = -maxSpan, zMax = maxSpan;

  // road strip
  for(let z=zMin; z<=zMax; z+=2.3){
    placeExt(exteriorStreetGroup, 'ROAD_STRAIGHT', {mode:'footprint',target:2.3}, roadX, z, Math.PI/2);
  }
  // sidewalk (flat light strip, procedural — no dedicated sidewalk-only model chosen)
  const walk = box(2.6, 0.08, (zMax-zMin)+4, '#5c5568');
  walk.position.set(sidewalkX, 0.04, 0);
  walk.receiveShadow = true;
  exteriorStreetGroup.add(walk);

  // streetlights along the sidewalk — the bulb always glows (emissive material),
  // but real dynamic point lights are thinned out (and skipped on mobile) since
  // each active light is expensive to render every frame
  let slIndex = 0;
  for(let z=zMin; z<=zMax; z+=4.8){
    const lightWrap = placeExt(exteriorStreetGroup, 'STREETLIGHT', {mode:'height',target:2.3}, sidewalkX-1.1, z, 0);
    if(lightWrap){
      if(!isMobile && slIndex%2===0){
        const glow = new THREE.PointLight(0xffdd99, 0.9, 6, 2);
        glow.position.set(sidewalkX-1.1, 2.15, z);
        exteriorStreetGroup.add(glow);
      }
      const halo = makeGlowSprite('#ffdd99', 0.9);
      halo.position.set(sidewalkX-1.1, 2.15, z);
      exteriorStreetGroup.add(halo);
    }
    slIndex++;
  }
  // houses + trees + fences across the street
  const houseKeys = ['HOUSE_A','HOUSE_E','HOUSE_J'];
  let hi = 0;
  for(let z=zMin; z<=zMax; z+=3.4){
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
    placeExt(exteriorStreetGroup, 'PLANTER', {mode:'height',target:0.55}, sidewalkX+1.0, z, 0);
  }

  // four pedestrians strolling the sidewalk, varied pace and lane
  const pedRoster = [['PED_MALE',-0.55],['PED_FEMALE',-0.15],['PED_MALE2',0.25],['PED_FEMALE2',0.65]];
  pedRoster.forEach(([key,laneOffset],i)=>{
    const startZ = zMin + 2 + i*((zMax-zMin-4)/pedRoster.length);
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'height',target:1.3}, sidewalkX+laneOffset, startZ, 0);
    if(wrap){
      pedestrians.push({wrap, z:startZ, dir: i%2===0?1:-1, speed: 0.45+Math.random()*0.35, zMin: zMin+1, zMax: zMax-1});
    }
  });

  // a handful of cars driving up and down the road, each in its own lane direction
  const carRoster = ['CAR_SEDAN','CAR_TAXI','CAR_HATCH','CAR_SUV'];
  for(let i=0;i<4;i++){
    const key = carRoster[i % carRoster.length];
    const dir = i%2===0 ? 1 : -1;
    const laneX = roadX + (dir>0 ? roadLaneOffset : -roadLaneOffset);
    const startZ = zMin + (i/4)*(zMax-zMin);
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'footprint',target:1.05}, laneX, startZ, dir>0?0:Math.PI);
    if(wrap){
      cars.push({wrap, z:startZ, dir, speed: 2.6+Math.random()*1.4, zMin:zMin-2, zMax:zMax+2, x:laneX});
    }
  }

  /* ---------- sol du quartier ---------- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, (zMax-zMin)+30),
    new THREE.MeshStandardMaterial({color:'#221d2e', roughness:0.95})
  );
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; ground.receiveShadow = true;
  exteriorStreetGroup.add(ground);

  /* ---------- trottoir devant l'arcade + file d'attente ---------- */
  const queueX = -6.4;
  for(let i=0;i<5;i++){
    const key = ['PED_MALE','PED_FEMALE','PED_MALE2','PED_FEMALE2'][i%4];
    const wrap = placeExt(exteriorStreetGroup, key, {mode:'height',target:1.3}, queueX + (i%2?0.35:-0.2), -2.6 + i*0.85, Math.PI/2);
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

  /* ---------- ruelle arrière (côté est) : porte de service clandestine ---------- */
  const alleyX = 7.4;
  const alleyFloor = box(3.4, 0.06, (zMax-zMin)*0.8, '#1d1a26');
  alleyFloor.position.set(alleyX, 0.03, 0); alleyFloor.receiveShadow = true;
  exteriorStreetGroup.add(alleyFloor);
  // mur du fond de la ruelle, avec graffitis néon
  const alleyWall = box(0.35, 4.2, (zMax-zMin)*0.8, '#241f31');
  alleyWall.position.set(alleyX+1.9, 2.1, 0);
  exteriorStreetGroup.add(alleyWall);
  ['#ff2e88','#2fd4c8','#ffd23f'].forEach((c,i)=>{
    const tag = box(0.04, 0.9, 1.6, c, {emissive:new THREE.Color(c).getHex(), emissiveIntensity:0.5});
    tag.position.set(alleyX+1.7, 1.5+ (i%2)*0.9, -5 + i*4.5);
    exteriorStreetGroup.add(tag);
  });
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
  const alleyLight = makeGlowSprite('#2fd4c8', 1.6);
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
    const halo = makeGlowSprite(shopColors[i], 1.8);
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

  /* ---------- voiture de patrouille (visible quand la suspicion monte) ---------- */
  const patrol = placeExt(exteriorStreetGroup, 'CAR_POLICE', {mode:'footprint',target:1.05}, roadX - roadLaneOffset, zMax, Math.PI);
  if(patrol){
    patrolCar = {wrap:patrol, z:zMax, dir:-1, speed:2.2, zMin:zMin-2, zMax:zMax+2};
    patrol.visible = false;
  }
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
  const roof = box(w+0.3, 0.2, d+0.3, casino?'#3a1420':'#1c1330');
  roof.position.set(0, bodyH+0.3, 0);
  exteriorBuildingGroup.add(roof);
  const parapet = box(w+0.34, 0.16, d+0.34, casino?PAL.casinoGold:PAL.purple);
  parapet.position.set(0, bodyH+0.44, 0);
  exteriorBuildingGroup.add(parapet);

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

  // a proper detailed entrance doorway instead of a flat marker
  const doorway = buildDoorway(casino, 2.15);
  doorway.position.set(-w/2, 0.2, doorZ);
  doorway.rotation.y = -Math.PI/2;
  exteriorBuildingGroup.add(doorway);
  // small canopy roof jutting out over the entrance
  const doorCanopy = box(0.5, 0.08, 1.3, casino?PAL.casinoGold:PAL.pink);
  doorCanopy.position.set(-w/2-0.3, 2.55, doorZ);
  exteriorBuildingGroup.add(doorCanopy);
  const canopyPoleA = cyl(0.03,0.03,0.5,'#333333'); canopyPoleA.position.set(-w/2-0.5,2.3,doorZ-0.55); exteriorBuildingGroup.add(canopyPoleA);
  const canopyPoleB = cyl(0.03,0.03,0.5,'#333333'); canopyPoleB.position.set(-w/2-0.5,2.3,doorZ+0.55); exteriorBuildingGroup.add(canopyPoleB);

  // big neon sign, visible from the street
  const signText = casino ? "CASINO" : (stageIdx===1 ? "ARCADE" : "COSMIC COIN");
  const sign = makeSprite(signText, casino?'#ffd23f':'#ff2e88');
  sign.position.set(-w/2-0.6, bodyH*0.75+0.2, 0);
  sign.scale.set(3.6,1.3,1);
  exteriorBuildingGroup.add(sign);
  const signGlow = new THREE.PointLight(casino?0xffd23f:0xff2e88, 1.4, 10, 2);
  signGlow.position.set(-w/2-0.8, bodyH*0.75+0.2, 0);
  exteriorBuildingGroup.add(signGlow);
  const signHalo = makeGlowSprite(casino?'#ffd23f':'#ff2e88', 4.2);
  signHalo.position.copy(sign.position);
  exteriorBuildingGroup.add(signHalo);
  exteriorBuildingGroup.userData.signHalo = signHalo;

  // warm porch light over the door
  const doorGlow = new THREE.PointLight(0xffd9a0, 0.8, 4, 2);
  doorGlow.position.set(-w/2-0.4, 2.0, doorZ);
  exteriorBuildingGroup.add(doorGlow);
  const doorHalo = makeGlowSprite('#ffd9a0', 1.4);
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
    const {cols,rows} = state.dims;
    // look at the building itself (not a point out past it in the road),
    // with the camera pulled due west so the street reads as foreground
    orbit.target.set(0, 1.4, 0);
    orbit.theta = -Math.PI/2; orbit.phi = 1.2;
    orbit.radius = 15 + Math.max(cols,rows)*1.1;
    // dusk sky so the streetlights and neon signs read clearly as a "living city at night"
    scene.background.set(0x0e1230);
    scene.fog.color.set(0x0e1230);
    btn.innerText = '🏠 INTÉRIEUR';
    closeMachineMenu();
  } else {
    orbit.theta = interiorCamSave.theta; orbit.phi = interiorCamSave.phi;
    orbit.radius = interiorCamSave.radius; orbit.target.copy(interiorCamSave.target);
    if(interiorCamSave.bg) scene.background.copy(interiorCamSave.bg);
    if(interiorCamSave.fog) scene.fog.color.copy(interiorCamSave.fog);
    btn.innerText = '🏙️ EXTÉRIEUR';
  }
  updateCamera();
}
document.getElementById('exteriorBtn').onclick = ()=> setExteriorMode(!exteriorMode);

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
];
const DECOR = [
  {id:'trash', name:'Poubelle', color:PAL.chrome, price:20, repBoost:0.2, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'poster', name:'Affiche rétro', color:PAL.pink, price:30, repBoost:0.4, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'plant', name:'Plante verte', color:PAL.green, price:40, repBoost:0.5, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'cashregister', name:'Caisse enregistreuse', color:PAL.red, price:50, repBoost:0.5, repReq:0, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'bench', name:"Banc d'attente", color:PAL.orange, price:55, repBoost:0.6, repReq:1, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'neon', name:'Enseigne néon', color:PAL.pink, price:80, repBoost:0.8, repReq:2, stageReq:0, earn:[0,0], time:0, passive:true, decor:true},
  {id:'statue', name:'Statue dorée', color:PAL.casinoGold||'#e8b64a', price:150, repBoost:1.2, repReq:0, stageReq:2, earn:[0,0], time:0, passive:true, decor:true},
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
    money:170, rep:0, day:1, debt:400, paused:false, stage:0,
    grid:null, dims:null, machines:[], customers:[], selected:null,
    staff:{tech:false,host:false,security:false},
    logMsgs:[], dayTimer:0, dayLength:26000, spawnTimer:0, spawnEvery:2400, won:false,
    // ---- couche clandestine ----
    backroom:false, suspicion:0, hidden:false, busts:0, raid:null, raidsSurvived:0,
    lookout:false, launderDay:-1, bribeDay:-99, gameOver:false, illegalEarned:0,
  };
}
let state = freshState();

function initGrid(){
  const dims = buildRoom(state.stage);
  state.dims = dims;
  state.grid = Array.from({length:dims.rows},()=>Array(dims.cols).fill(null));
  buildExteriorBuilding(state.stage, dims.cols, dims.rows);
}

/* ---------- shop UI ---------- */
function renderItemInto(container, def){
  const stageLocked = state.stage < def.stageReq;
  const repLocked = state.rep < def.repReq;
  const backLocked = !!def.illegal && !state.backroom;
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

function renderExpandBox(){
  const box = document.getElementById('expandText');
  const btn = document.getElementById('expandBtn');
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
  state.money -= next.cost;
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
  if(state.money < def.price){ log("Pas assez de jetons pour cet achat."); return; }
  state.money -= def.price;
  const mesh = buildMachineMesh(def.id);
  const p = cellToWorld(gx,gz,cols,rows);
  const jitter = 0.08;
  mesh.position.set(p.x+(Math.random()*2-1)*jitter, 0, p.z+(Math.random()*2-1)*jitter);
  mesh.rotation.y = Math.floor(Math.random()*4)*(Math.PI/2);
  machinesGroup.add(mesh);
  const machine = {x:gx,z:gz,def,mesh,busy:false,broken:false};
  mesh.userData.machine = machine;
  state.grid[gz][gx]=machine;
  state.machines.push(machine);
  if(def.decor){
    state.rep = Math.min(30, state.rep + (def.repBoost||0));
    log(`Décoration ajoutée : ${def.name} (+${def.repBoost}★ réputation).`);
  } else {
    log(`Nouvelle machine installée : ${def.name}.`);
  }
  state.selected=null;
  renderShop();
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

  const menuW = 190, menuH = 130;
  let left = clientX + 10, top = clientY + 10;
  if(left + menuW > window.innerWidth) left = clientX - menuW - 10;
  if(top + menuH > window.innerHeight) top = clientY - menuH - 10;
  machineMenuEl.style.left = Math.max(6,left)+'px';
  machineMenuEl.style.top = Math.max(6,top)+'px';
  machineMenuEl.classList.add('open');
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
document.getElementById('mmSell').onclick = ()=>{
  if(!menuMachine || menuMachine.busy) return;
  const m = menuMachine;
  const refund = Math.round(m.def.price*0.5);
  state.money += refund;
  machinesGroup.remove(m.mesh);
  state.grid[m.z][m.x] = null;
  const idx = state.machines.indexOf(m);
  if(idx>-1) state.machines.splice(idx,1);
  log(`Machine vendue : ${m.def.name} (+${refund}¢).`);
  closeMachineMenu();
  renderShop();
};

/* ---------- customers ---------- */
const SHIRT_COLORS=[0xffb4a2,0xe5989b,0xb5838d,0x6d6875,0xffcdb2,0x83c5be,0xf4a261];
function spawnCustomer(){
  const free = state.machines.filter(m=>!m.busy && !m.broken && !m.def.passive && !(m.def.illegal && state.hidden));
  if(free.length===0) return;
  const target = free[Math.floor(Math.random()*free.length)];
  target.busy = true;
  const mesh = buildCharacter(SHIRT_COLORS[Math.floor(Math.random()*SHIRT_COLORS.length)]);
  const {cols,rows,doorRow} = state.dims;
  const doorP = cellToWorld(0,doorRow,cols,rows);
  mesh.position.set(doorP.x-CELL, 0, doorP.z);
  customersGroup.add(mesh);
  const targetP = target.mesh.position.clone();
  state.customers.push({mesh,target,targetPos:targetP,doorPos:new THREE.Vector3(doorP.x-CELL,0,doorP.z),phase:'in',playTimer:0});
}

function updateCustomers(dt){
  for(let i=state.customers.length-1;i>=0;i--){
    const c = state.customers[i];
    if(c.phase==='in'){
      const dir = new THREE.Vector3().subVectors(c.targetPos,c.mesh.position); dir.y=0;
      const dist = dir.length();
      if(dist<0.15){ c.phase='playing'; c.playTimer=0; }
      else{ dir.normalize(); c.mesh.position.addScaledVector(dir, (1.6*dt/1000)); c.mesh.lookAt(c.targetPos.x,0,c.targetPos.z); }
    } else if(c.phase==='playing'){
      c.mesh.position.y = Math.sin(performance.now()/150)*0.03+0.0;
      c.playTimer += dt;
      if(c.playTimer >= c.target.def.time){
        const [lo,hi]=c.target.def.earn;
        const ticketCounters = state.machines.filter(m=>m.def.id==='ticket').length;
        const ticketMult = 1 + Math.min(0.4, ticketCounters*0.08); // +8%/counter, capped +40%
        let gain = Math.round((lo+Math.random()*(hi-lo)) * ticketMult);
        if(c.target.def.illegal){
          gain = Math.round(gain * 2.3);
          state.illegalEarned += gain;
          state.suspicion = Math.min(100, state.suspicion + (state.lookout?0.45:0.75));
          state.rep = Math.min(30, state.rep + 0.05);
        } else {
          state.rep = Math.min(30,state.rep+0.15);
        }
        state.money += gain;
        spawnFloatText(c.mesh.position, `+${gain}¢`);
        c.target.busy=false;
        c.phase='out';
      }
    } else if(c.phase==='out'){
      c.mesh.position.y = 0;
      const dir = new THREE.Vector3().subVectors(c.doorPos,c.mesh.position); dir.y=0;
      const dist = dir.length();
      if(dist<0.2){ customersGroup.remove(c.mesh); state.customers.splice(i,1); continue; }
      dir.normalize(); c.mesh.position.addScaledVector(dir,(1.8*dt/1000)); c.mesh.lookAt(c.doorPos.x,0,c.doorPos.z);
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
  state.hidden = on;
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
      state.money -= BACKROOM_COST;
      state.backroom = true;
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
      state.money -= LAUNDER_COST; state.launderDay = state.day;
      state.suspicion = Math.max(0, state.suspicion-18);
      log("Recettes passées dans les jetons d'arcade. La compta redevient présentable.");
      renderBackroom();
    }));

  box.appendChild(backAction("Pot-de-vin à l'inspecteur", state.day-state.bribeDay<3?"L'inspecteur se fait discret (3 jours).":"-40 suspicion, risque légal.", BRIBE_COST,
    state.money>=BRIBE_COST && state.day-state.bribeDay>=3, ()=>{
      state.money -= BRIBE_COST; state.bribeDay = state.day;
      state.suspicion = Math.max(0, state.suspicion-40);
      log("Une enveloppe change de main dans l'arrière-cour. Silence acheté.");
      renderBackroom();
    }));

  if(!state.lookout){
    box.appendChild(backAction("Engager un guetteur", "Prévient plus tôt et ralentit la suspicion.", LOOKOUT_COST, state.money>=LOOKOUT_COST, ()=>{
      state.money -= LOOKOUT_COST; state.lookout = true;
      log("Momo prend son poste devant la porte. Il siffle deux fois quand ça sent le bleu.");
      renderBackroom();
    }));
  }
}

/* ---------- descentes de police ---------- */
function startRaid(){
  const warn = state.lookout ? 22000 : 13000;
  state.raid = {timer:warn, total:warn};
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
    log("Contrôle terminé : rien à signaler. Les flics repartent bredouilles.");
    showEvent("RIEN À SIGNALER", "Deux agents traversent la salle, tapotent une borne, repartent. Derrière le faux mur, personne n'ose respirer. Suspicion en forte baisse.");
  } else {
    const fine = Math.min(state.money, 120 + exposed.length*40);
    state.money -= fine;
    state.rep = Math.max(0, state.rep-2);
    state.busts += 1;
    state.suspicion = 45;
    const seized = exposed[Math.floor(Math.random()*exposed.length)];
    machinesGroup.remove(seized.mesh);
    state.grid[seized.z][seized.x] = null;
    const idx = state.machines.indexOf(seized); if(idx>-1) state.machines.splice(idx,1);
    log(`Descente ratée : -${Math.round(fine)}¢ d'amende, ${seized.def.name} saisie.`);
    if(state.busts>=3){
      state.gameOver = true;
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
  if(state.debt>0){
    const payment = Math.min(state.debt, 20+state.rep*3);
    if(state.money>=payment){ state.money-=payment; state.debt-=payment; log(`Jour ${state.day} — Remboursement banque : -${Math.round(payment)}¢.`); }
    else log(`Jour ${state.day} — Pas assez pour rembourser la banque ce jour-ci...`);
  }
  if(state.debt<=0 && !state.won){
    state.won=true;
    showEvent("DETTE REMBOURSÉE 🎉", state.illegalEarned>500
      ? "La banque est remboursée — avec l'argent de l'arrière-salle. Le Cosmic Coin est à toi, et la moitié du quartier sait déjà pour la porte du fond. Continue : empire clandestin ou blanchiment total, à toi de voir."
      : "La banque est remboursée, jeton par jeton, à la loyale. Rosa serait fière. Rien ne t'empêche maintenant de rouvrir la porte du fond… ou de la murer pour de bon.");
  }
  // suspicion : décroît les nuits calmes, monte si la salle secrète tourne à découvert
  if(state.backroom){
    const active = illegalMachines().length;
    if(active===0 || state.hidden) state.suspicion = Math.max(0, state.suspicion-4);
    else state.suspicion = Math.min(100, state.suspicion + 1 + active*0.6);
  }
  // rumeurs et descentes
  if(state.backroom && !state.raid && !state.gameOver && state.day>2){
    const chance = state.suspicion/210 + (illegalMachines().length && !state.hidden ? 0.04 : 0);
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
  renderExpandBox();
  renderBackroom();
}

/* ---------- events modal ---------- */
function showEvent(title,text){
  state.paused=true;
  document.getElementById('eventTitle').innerText=title;
  document.getElementById('eventText').innerText=text;
  document.getElementById('eventModal').style.display='flex';
}
document.getElementById('closeEventBtn').onclick=()=>{ document.getElementById('eventModal').style.display='none'; state.paused=!state.gameOver?false:true; };
document.getElementById('closeStoryBtn').onclick=()=>{ document.getElementById('storyModal').style.display='none'; };

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
addWin('orientationchange', ()=>setTimeout(resize,300));

document.getElementById('pauseBtn').onclick=()=>{
  state.paused=!state.paused;
  document.getElementById('pauseBtn').innerText = state.paused?'▶ Reprendre':'⏸ Pause';
};
document.getElementById('resetBtn').onclick=()=>{
  state.machines.forEach(m=>machinesGroup.remove(m.mesh));
  state.customers.forEach(c=>customersGroup.remove(c.mesh));
  floaters.forEach(f=>scene.remove(f.sp));
  floaters.length=0;
  closeMachineMenu();
  state = freshState();
  document.getElementById('raidBanner').classList.remove('on');
  initGrid();
  document.getElementById('stageLabel').innerText = STAGES[state.stage].name;
  document.getElementById('storyModal').style.display='flex';
  document.getElementById('pauseBtn').innerText='⏸ Pause';
  renderShop(); updateHUD();
  log("Nouvelle partie lancée. Bonne chance avec le Cosmic Coin !");
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
  const phase = state.dayTimer/state.dayLength;
  const angle = phase*Math.PI*2 - Math.PI/2;
  const sunHeight = Math.sin(angle);
  const dayFactor = Math.max(0, sunHeight);
  const nightFactor = Math.max(0, -sunHeight);

  sun.intensity = 0.35 + dayFactor*0.85;
  ambientLight.intensity = 0.5 + dayFactor*0.55;

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
}

function animate(ts){
  if(_disposed) return;
  if(lastTime===null) lastTime=ts;
  const dt = Math.min(80, ts-lastTime); lastTime=ts;
  if(canvas.clientWidth && (renderer.domElement.width!==canvas.clientWidth*renderer.getPixelRatio())) resize();

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
    state.dayTimer+=dt;
    updateDayNight();
    if(state.dayTimer>=state.dayLength){ state.dayTimer=0; newDay(); }
    updateHUD();
  }
  if(exteriorMode){
    pedestrians.forEach(p=>{
      p.z += p.dir*p.speed*dt/1000;
      if(p.z>p.zMax){ p.z=p.zMax; p.dir=-1; p.wrap.rotation.y=Math.PI; }
      if(p.z<p.zMin){ p.z=p.zMin; p.dir=1; p.wrap.rotation.y=0; }
      p.wrap.position.z = p.z;
    });
    cars.forEach(c=>{
      c.z += c.dir*c.speed*dt/1000;
      if(c.dir>0 && c.z>c.zMax) c.z = c.zMin;
      if(c.dir<0 && c.z<c.zMin) c.z = c.zMax;
      c.wrap.position.z = c.z;
    });
  }
  renderer.render(scene,camera);
  _raf = requestAnimationFrame(animate);
}

/* ---------- hook de debug (dev uniquement) ---------- */
if(import.meta.env && import.meta.env.DEV){
  window.__cosmicCoin = {
    get state(){ return state; },
    startRaid, resolveRaid, setHidden, log, renderShop, updateHUD,
  };
}

/* ---------- init ---------- */
preloadModels(()=>{
  document.getElementById('loadModal').style.display='none';
  document.getElementById('storyModal').style.display='flex';
  resize();
  initGrid();
  buildExteriorStreet(16);
  updateCamera();
  renderShop();
  updateHUD();
  log("Bienvenue au Cosmic Coin. Achète ta première borne — la porte du fond attendra ce soir.");
  _raf = requestAnimationFrame(animate);
});


return () => {
  _disposed = true;
  cancelAnimationFrame(_raf);
  _winL.forEach(([t,f,o])=>window.removeEventListener(t,f,o));
  try { renderer.dispose(); } catch(e) {}
};
}
