import type { CapacitorConfig } from "@capacitor/cli";
import brand from "./brand.config.json";

/**
 * Android (Capacitor)
 *
 * L'application Android charge le bundle local construit dans dist.
 * Aucun serveur Lovable distant n'est nécessaire au démarrage.
 */
const config: CapacitorConfig = {
  appId: brand.appId,
  appName: brand.name,
  webDir: "dist",
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
