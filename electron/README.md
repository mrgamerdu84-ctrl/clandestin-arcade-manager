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

## Télécharger la version PC (GitHub Actions)

1. Pousse le projet sur GitHub (bouton GitHub dans Lovable).
2. Onglet **Actions** → workflow **PC (Electron)** → **Run workflow** (ou attends le push sur `main`).
3. À la fin du job, section **Artifacts** : télécharge
   - `Cosmic-Coin-Windows-x64.zip` (Windows — dézipper puis lancer `Cosmic Coin.exe`)
   - `Cosmic-Coin-Linux-x64.zip`
   - `Cosmic-Coin-macOS-arm64.zip`

## Construire en local

```bash
npm install --save-dev electron @electron/packager
npm run electron        # lancer en dev
npm run electron:pack   # empaqueter pour la plateforme courante
```
