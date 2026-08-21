import './apply-android-playability.mjs';
import fs from 'node:fs';
import path from 'node:path';

const shell = path.resolve('src/game/GameShell.tsx');
let src = fs.readFileSync(shell, 'utf8');
const imports = [
  'import "./platform-ui.css";',
  'import "./mobile-interaction-hotfix.css";',
];

const anchor = 'import "./cosmic-coin.css";';
if (!src.includes(anchor)) throw new Error('[platform-ui] GameShell CSS import not found');

for (const marker of imports) {
  if (!src.includes(marker)) {
    src = src.replace(anchor, `${anchor}\n${marker}`);
  }
}

fs.writeFileSync(shell, src);
console.log('[platform-ui] responsive styles linked');
