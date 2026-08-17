const { app, BrowserWindow } = require("electron");
const path = require("path");

// Source unique de vérité (partagée avec la PWA et Capacitor/Android)
const brand = require(path.join(__dirname, "..", "brand.config.json"));

const ICON = path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png");

app.setName(brand.name);

function createSplash() {
  const splash = new BrowserWindow({
    width: 620,
    height: 620,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: brand.colors.background,
    icon: ICON,
    show: true,
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.webContents.on("did-finish-load", () => {
    const c = brand.colors;
    const t = brand.typography;
    splash.webContents
      .executeJavaScript(
        `(() => {
           const r = document.documentElement.style;
           r.setProperty('--bg', ${JSON.stringify(c.background)});
           r.setProperty('--primary', ${JSON.stringify(c.primary)});
           r.setProperty('--accent', ${JSON.stringify(c.accent)});
           r.setProperty('--text', ${JSON.stringify(c.text)});
           r.setProperty('--display', ${JSON.stringify(t.display)});
           r.setProperty('--track', ${JSON.stringify(t.letterSpacing)});
           const n = document.getElementById('brandName');
           if (n) n.textContent = ${JSON.stringify(brand.name)};
           const g = document.getElementById('brandTagline');
           if (g) g.textContent = ${JSON.stringify(brand.tagline)};
           document.title = ${JSON.stringify(brand.name)};
         })()`,
      )
      .catch(() => {});
  });
  return splash;
}

function createWindow() {
  const splash = createSplash();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: brand.colors.background,
    title: brand.name,
    icon: ICON,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });


  win.removeMenu?.();
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  win.once("ready-to-show", () => {
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.destroy();
      win.show();
    }, 900);
  });
}

app.whenReady().then(() => {
  if (process.platform === "linux") app.commandLine.appendSwitch("enable-features", "WebGPU");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
