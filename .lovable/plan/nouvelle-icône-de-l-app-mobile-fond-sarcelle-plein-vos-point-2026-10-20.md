# Nouvelle icône de l'app mobile : fond sarcelle plein + vos points

## Ce qui sera fait
1. **Icône de l'app (Android + iPhone)** : fond plein bleu sarcelle #0D7377 sur tout le carré, avec vos points (fichier « Points du centre ») posés au centre.
   - Les points occupent la zone que le téléphone ne coupe jamais (environ 62 % du carré), donc ils paraîtront grands, comme les icônes Canva ou Lovable, sans être rognés par le cercle ou le carré arrondi du téléphone.
   - Couleurs gardées telles quelles : or #E8AA14 et blanc #F2F3F5.
2. **Écran de démarrage** : même fond sarcelle avec les points au centre, pour que l'ouverture de l'app soit harmonieuse avec l'icône.
3. **Vérification** : rendu de l'icône découpée en cercle, en carré arrondi et en carré, à taille réelle d'écran d'accueil, avant de vous la montrer.
4. Le logo du site, du menu et l'icône d'onglet ne changent pas.

## Ce que vous ferez ensuite (sur votre PC)
`git pull`, `npm run build`, `npx @capacitor/assets generate --iconBackgroundColor '#0D7377' --splashBackgroundColor '#0D7377'`, `npx cap sync android`, désinstaller l'ancienne app, puis ▶ dans Android Studio.

## Détails techniques
- SVG source copié dans `resources/points.svg` (viewBox 106x122).
- ImageMagick à haute densité : `icon-background.png` 1024 plein #0D7377 ; `icon-foreground.png` 1024 transparent, points hauts d'environ 62 % (zone sûre adaptive icon) ; `icon-only.png` 1024 = fond + points à ~70 % ; `splash.png` / `splash-dark.png` 2732 fond #0D7377, points ~22 % de largeur.
- `capacitor.config.ts` : `backgroundColor` et `SplashScreen.backgroundColor` passés à #0D7377 ; `docs/PUBLICATION_MOBILE.md` mis à jour avec la nouvelle commande.
