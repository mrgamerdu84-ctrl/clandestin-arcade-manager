# Cosmic Coin — build Android (Capacitor + Gradle)

Le dossier natif `android/` est généré par Capacitor (il n'est pas versionné ici).

## En local

```bash
bun add @capacitor/core @capacitor/android
bun add -d @capacitor/cli
bun run build
bunx cap add android      # une seule fois
bunx cap sync android
cd android && ./gradlew assembleDebug
```

APK : `android/app/build/outputs/apk/debug/app-debug.apk`

Ouvrir dans Android Studio : `bunx cap open android`

## Signature release (Gradle)

Après `cap add android`, ajoute dans `android/app/build.gradle`, dans `android { }` :

```gradle
signingConfigs {
    release {
        storeFile file("release.keystore")
        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
        keyAlias System.getenv("ANDROID_KEY_ALIAS")
        keyPassword System.getenv("ANDROID_KEY_PASSWORD")
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

Créer la clé :

```bash
keytool -genkey -v -keystore release.keystore -alias cosmiccoin \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore   # -> secret ANDROID_KEYSTORE_BASE64
```

## CI (GitHub Actions)

Workflow : `.github/workflows/android.yml`

- Push sur `main` → APK debug en artefact.
- Lancement manuel avec `release: true` → APK + AAB signés.

Secrets requis pour la release :
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Variable repo optionnelle : `CAP_SERVER_URL` (URL publiée du jeu chargée par le WebView).

## Icône & écran de démarrage

Les sources sont dans `resources/` :
- `resources/icon.png` (1024×1024) — icône de l'app
- `resources/splash.png` / `resources/splash-dark.png` (2732×2732) — écran de démarrage

Génération des densités Android :

```bash
bun add -d @capacitor/assets @capacitor/splash-screen
bunx capacitor-assets generate --android
bunx cap sync android
```

La config du splash (durée, couleur `#07060f`, plein écran) est dans `capacitor.config.ts`.
