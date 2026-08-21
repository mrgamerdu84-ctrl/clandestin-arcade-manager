import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/game/cosmicCoin.ts');
let src = fs.readFileSync(file, 'utf8');

if (src.includes('ANDROID_PLAYABILITY_PATCH_V2')) {
  console.log('[android-playability] already applied');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const before = src;
  src = src.replace(search, replacement);
  if (src === before) throw new Error(`[android-playability] patch target not found: ${label}`);
}

replaceOnce(
  "export function startCosmicCoin(): () => void {",
  "export function startCosmicCoin(): () => void {\n/* ANDROID_PLAYABILITY_PATCH_V2 — mobile exposure/camera/touch safety */",
  'marker',
);

replaceOnce(
  "  if(!isFinite(brightness)) brightness = 1.25;\n  lightRender = localStorage.getItem('cc_lightrender') === '1';",
  "  if(!isFinite(brightness)) brightness = 1.25;\n  // Android: ignore old over-bright saved values that can wash the whole floor white.\n  if(isMobile) brightness = Math.max(0.72, Math.min(brightness, 0.92));\n  lightRender = localStorage.getItem('cc_lightrender') === '1';",
  'mobile brightness clamp',
);

replaceOnce(
  "renderer.toneMappingExposure = brightness;",
  "renderer.toneMappingExposure = isMobile ? Math.min(brightness, 0.92) : brightness;",
  'initial mobile exposure',
);

replaceOnce(
  "const ambientLight = new THREE.AmbientLight(0xb9a8dd, 1.15);",
  "const ambientLight = new THREE.AmbientLight(0xb9a8dd, isMobile ? 0.58 : 1.15);",
  'ambient mobile intensity',
);

replaceOnce(
  "const sun = new THREE.DirectionalLight(0xfff2d0, 1.0);",
  "const sun = new THREE.DirectionalLight(0xfff2d0, isMobile ? 0.62 : 1.0);",
  'sun mobile intensity',
);

replaceOnce(
  "const fillLight = new THREE.PointLight(0xff2e88, 0.6, 30);",
  "const fillLight = new THREE.PointLight(0xff2e88, isMobile ? 0.28 : 0.6, 30);",
  'pink fill mobile intensity',
);

replaceOnce(
  "const fillLight2 = new THREE.PointLight(0x20e6d0, 0.6, 30);",
  "const fillLight2 = new THREE.PointLight(0x20e6d0, isMobile ? 0.28 : 0.6, 30);",
  'cyan fill mobile intensity',
);

replaceOnce(
  "const orbit = {theta: Math.PI*0.25, phi: 1.0, radius: 16, target: new THREE.Vector3(0,0,0)};",
  "const orbit = {theta: Math.PI*0.25, phi: isMobile ? 0.92 : 1.0, radius: isMobile ? 11.4 : 16, target: new THREE.Vector3(0,0,0)};",
  'mobile camera framing',
);

replaceOnce(
  "function resize(){\n  const w = canvas.clientWidth, h = canvas.clientHeight;\n  renderer.setSize(w,h,false);\n  camera.aspect = w/h;\n  camera.updateProjectionMatrix();\n}",
  "function resize(){\n  const w = canvas.clientWidth, h = canvas.clientHeight;\n  renderer.setSize(w,h,false);\n  camera.aspect = w/h;\n  if(isMobile) camera.fov = h > w ? 38 : 40;\n  else camera.fov = 42;\n  camera.updateProjectionMatrix();\n}",
  'mobile portrait camera fov',
);

// On Android the old default enabled tap-to-place automatically. If an item stayed
// selected, tapLock could capture every finger drag and make the indoor camera feel frozen.
replaceOnce(
  "let tapPlace = (localStorage.getItem('cc_tapPlace') ?? (isCoarse?'1':'0')) === '1';",
  "let tapPlace = isMobile ? false : ((localStorage.getItem('cc_tapPlace') ?? (isCoarse?'1':'0')) === '1');",
  'mobile tap place default',
);

replaceOnce(
  "function tapLock(e){ return tapPlace && e.pointerType!=='mouse' && placingActive(); }",
  "function tapLock(e){\n  if(e.pointerType==='mouse') return false;\n  if(!tapPlace) return false;\n  // Never freeze one-finger orbit just because a shop item remains selected.\n  // Lock only while an object is actually being moved, or while editing the exterior.\n  try {\n    if(exteriorMode) return !!(hoodEdit && (hoodCarry || hoodMove || hoodErase));\n    return !!movingMachine;\n  } catch(err) { return false; }\n}",
  'mobile touch camera lock',
);

// Clamp later exposure writes too, not only the startup value.
src = src.replace(/renderer\.toneMappingExposure\s*=\s*brightness;/g,
  "renderer.toneMappingExposure = isMobile ? Math.min(brightness, 0.92) : brightness;");

fs.writeFileSync(file, src);
console.log('[android-playability] applied to src/game/cosmicCoin.ts');
