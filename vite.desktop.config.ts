import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Build statique (SPA) utilisé uniquement pour les versions installables
// PC (Electron) et Android (Capacitor). Le site web reste sur TanStack Start.
export default defineConfig({
  root: "desktop",
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  publicDir: path.resolve(process.cwd(), "public"),
  build: {
    outDir: path.resolve(process.cwd(), "dist"),
    emptyOutDir: true,
  },
});
