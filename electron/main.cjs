const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

// Source unique de vérité (partagée avec la PWA et Capacitor/Android)
const brand = require(path.join(__dirname, "..", "brand.config.json"));

const ICON = path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png");
const DIST_DIR = path.join(__dirname, "..", "dist");
let localServer = null;

app.setName(brand.name);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".bin": "application/octet-stream",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
  }[ext] || "application/octet-stream";
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const requested = urlPath === "/" ? "/index.html" : urlPath;
        const relative = requested.replace(/^\/+/, "");
        const filePath = path.resolve(DIST_DIR, relative);

        // Ne jamais permettre de sortir du dossier dist.
        if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        fs.stat(filePath, (statErr, stat) => {
          if (statErr || !stat.isFile()) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          res.writeHead(200, {
            "Content-Type": contentType(filePath),
            "Cache-Control": "no-cache",
          });
          fs.createReadStream(filePath).pipe(res);
        });
      } catch (err) {
        res.writeHead(500);
        res.end("Internal error");
      }
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      localServer = server;
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

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

async function createWindow() {
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

  // Important : le jeu charge ses GLB avec des URLs comme /models/xxx.glb.
  // En file:// ces URLs pointaient vers la racine du disque et tous les assets
  // disparaissaient. Un petit serveur local restaure exactement le comportement
  // HTTP attendu, sans aucune connexion Internet.
  const origin = await startLocalServer();
  await win.loadURL(`${origin}/index.html`);

  win.once("ready-to-show", () => {
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.destroy();
      win.show();
    }, 900);
  });
}

app.whenReady().then(() => {
  if (process.platform === "linux") app.commandLine.appendSwitch("enable-features", "WebGPU");
  createWindow().catch((err) => {
    console.error("Impossible de démarrer le jeu :", err);
    app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(() => app.quit());
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (localServer) {
    try { localServer.close(); } catch (_) {}
    localServer = null;
  }
});
