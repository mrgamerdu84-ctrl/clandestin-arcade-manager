const { app, BrowserWindow } = require("electron");
const path = require("path");

const ICON = path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png");

function createSplash() {
  const splash = new BrowserWindow({
    width: 620,
    height: 620,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: "#07060f",
    icon: ICON,
    show: true,
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

function createWindow() {
  const splash = createSplash();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#07060f",
    title: "Cosmic Coin",
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
