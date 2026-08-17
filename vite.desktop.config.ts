import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Build statique (SPA) utilisé uniquement pour les versions installables
// PC (Electron) et Android (Capacitor). Le site web reste sur TanStack Start.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(process.cwd(), "desktop/index.html") },
  },
});
