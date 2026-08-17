import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Cosmic Coin — Android (Capacitor)
 *
 * L'app est rendue côté serveur (TanStack Start), donc le shell Android charge
 * directement le site publié au lieu d'un bundle statique.
 * Remplace `server.url` par ton URL publiée (ou ton domaine perso).
 */
const config: CapacitorConfig = {
  appId: "app.lovable.cosmiccoin",
  appName: "Cosmic Coin",
  webDir: "public",
  server: {
    url: process.env["CAP_SERVER_URL"] ?? "https://8581d91b-588d-45ac-8445-54604eed2926.lovableproject.com",
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#07060fff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "small",
      spinnerColor: "#ff2d95",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#07060f",
  },
};

export default config;
