import fs from 'node:fs';
import path from 'node:path';

const shell = path.resolve('src/game/GameShell.tsx');
let src = fs.readFileSync(shell, 'utf8');
const marker = 'import "./platform-ui.css";';
if (!src.includes(marker)) {
  const anchor = 'import "./cosmic-coin.css";';
  if (!src.includes(anchor)) throw new Error('[platform-ui] GameShell CSS import not found');
  src = src.replace(anchor, `${anchor}\n${marker}`);
  fs.writeFileSync(shell, src);
  console.log('[platform-ui] responsive stylesheet linked');
} else {
  console.log('[platform-ui] already linked');
}
