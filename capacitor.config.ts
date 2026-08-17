import type { CapacitorConfig } from "@capacitor/cli";
import brand from "./brand.config.json";

/**
 * Cosmic Coin — Android (Capacitor)
 *
 * Nom, couleurs et typo viennent de brand.config.json (source unique partagée
 * avec la PWA et l'app Electron).
 */
const config: CapacitorConfig = {
  appId: brand.appId,
  appName: brand.name,
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
      backgroundColor: `${brand.colors.background}ff`,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "small",
      spinnerColor: brand.colors.primary,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: brand.colors.background,
  },
};

export default config;
