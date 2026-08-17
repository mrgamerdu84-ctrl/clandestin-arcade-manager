/**
 * Génère public/manifest.webmanifest à partir de brand.config.json
 * (source unique de vérité : nom, couleurs, typo).
 *   bun scripts/sync-brand.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const b = JSON.parse(readFileSync(new URL("../brand.config.json", import.meta.url), "utf8"));

const manifest = {
  name: b.fullName,
  short_name: b.shortName,
  description: b.description,
  id: "/",
  start_url: "/",
  display: "fullscreen",
  orientation: "any",
  background_color: b.colors.background,
  theme_color: b.colors.background,
  icons: [
    { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

writeFileSync(
  new URL("../public/manifest.webmanifest", import.meta.url),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("manifest.webmanifest synchronisé avec brand.config.json");
