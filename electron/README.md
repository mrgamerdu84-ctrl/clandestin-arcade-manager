# Cosmic Coin — version PC (Electron)

## Lancer

```bash
npm install --save-dev electron @electron/packager
npm run electron
```

## Empaqueter

```bash
npm run electron:pack            # plateforme courante
npx @electron/packager . "Cosmic Coin" --platform=win32 --arch=x64 --icon=electron/icon.ico --out=electron-release --overwrite
npx @electron/packager . "Cosmic Coin" --platform=darwin --arch=x64 --icon=electron/icon.png --out=electron-release --overwrite
```

## Identité visuelle

- `electron/icon.ico` (Windows) et `electron/icon.png` (Linux/macOS) — même pièce néon que l'icône Android et le favicon.
- `electron/splash.html` + `electron/splash.jpg` — fenêtre de démarrage affichée pendant le chargement du jeu, identique à l'écran de chargement web/Android.

Note : `vite.config.ts` doit avoir `base: './'` pour un rendu correct en `file://`.
