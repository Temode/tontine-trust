# Intégrer le logo officiel (forme sceau) partout

## Réponse : une app mobile peut-elle avoir cette forme ?
Oui, mais pas telle quelle. Android et iPhone découpent toujours l'icône dans leur propre forme (cercle, carré arrondi selon le téléphone). La solution des grandes marques : poser le sceau bleu au centre d'un fond blanc (votre préférence), avec une marge de sécurité. Le sceau reste entier et reconnaissable, quelle que soit la découpe.

## Ce qui sera fait
1. **Site web** : le sceau remplace l'ancien logo dans le menu, l'en-tête, la page d'accueil et la connexion.
2. **Onglet du navigateur** : nouvelle petite icône à partir du sceau (l'ancienne est supprimée).
3. **Icône iPhone / écran d'accueil web** : sceau centré sur fond blanc.
4. **App mobile (Android + iPhone)** : fichiers sources des icônes et de l'écran de démarrage refaits (sceau centré, fond blanc, marge de 30 % pour qu'aucune pointe ne soit coupée).
5. **Écran de démarrage** : fond blanc + sceau au centre ; réglage de couleur de fond mis à jour.

## Ce que vous ferez ensuite (sur votre PC)
`git pull`, `npm run build`, `npx @capacitor/assets generate --iconBackgroundColor '#FFFFFF' --splashBackgroundColor '#FFFFFF'`, `npx cap sync android`, désinstaller l'ancienne app puis ▶ dans Android Studio.

## Détails techniques
- Copie du SVG dans `public/favicon.svg` ; PNG 64 px `public/favicon.png`, `apple-touch-icon.png` 180 px fond blanc ; suppression de `public/favicon.ico` et mise à jour de `index.html`.
- `Logo.tsx` rend le SVG officiel (asset importé) au lieu des cercles dessinés ; vérifier les appelants qui le posent sur un fond sarcelle (MobileMenu, TopBar, Sidebar) et passer leur pastille en fond blanc.
- `resources/` régénéré via ImageMagick : `icon-only.png` 1024, `icon-foreground.png` (sceau à ~60 %), `icon-background.png` blanc, `splash.png`/`splash-dark.png` 2732.
- `capacitor.config.ts` : backgroundColor du splash en blanc ; mise à jour de `docs/PUBLICATION_MOBILE.md`.
