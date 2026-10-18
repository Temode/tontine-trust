# Publier Tontine Digitale sur Google Play et l'App Store

Identifiant de l'app : `com.tontinedigitale.app` — nom : « Tontine Digitale ».

## 1. Préparer le projet (une seule fois)
1. « Export to GitHub », puis `git pull` sur votre ordinateur.
2. `npm install`
3. `npx cap add android` et/ou `npx cap add ios`
4. `npx capacitor-assets generate --iconBackgroundColor '#FFFFFF' --splashBackgroundColor '#FFFFFF'` (icônes + écran de démarrage depuis `resources/`)
5. `npm run build && npx cap sync`

Tests en direct (version de développement) : `CAP_LIVE_RELOAD=1 npx cap sync`, puis `npx cap run android`. Sans cette variable, l'app embarque sa propre version (mode production).

## 2. Notifications push (Firebase)
1. Créez un projet sur console.firebase.google.com.
2. Ajoutez une app Android `com.tontinedigitale.app` → téléchargez `google-services.json` → placez-le dans `android/app/`.
3. Ajoutez une app iOS `com.tontinedigitale.app` → `GoogleService-Info.plist` dans `ios/App/App/` (via Xcode).
4. iPhone : dans Apple Developer, créez une clé APNs (.p8) et ajoutez-la dans Firebase → Paramètres → Cloud Messaging. Dans Xcode, activez « Push Notifications » et « Background Modes → Remote notifications ».
5. Dans Lovable, connectez « Firebase Cloud Messaging » (compte de service) pour que le serveur puisse envoyer.

## 3. Google Play
1. Compte Google Play Console (25 $ une fois).
2. Android Studio → Build → Generate Signed Bundle (AAB). Gardez précieusement la clé de signature.
3. Créez la fiche (captures, description, politique de confidentialité : https://tontinedigitale.com), envoyez l'AAB en test interne, puis en production.

## 4. App Store
1. Compte Apple Developer (99 $/an), Mac avec Xcode.
2. Xcode → Signing & Capabilities → votre équipe. Product → Archive → Distribute → App Store Connect.
3. Remplissez la fiche dans App Store Connect et soumettez à la revue.

Après chaque mise à jour : `git pull && npm run build && npx cap sync`, augmentez le numéro de version, puis renvoyez.
