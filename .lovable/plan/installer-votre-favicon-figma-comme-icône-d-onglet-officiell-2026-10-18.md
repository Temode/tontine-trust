# Installer votre favicon Figma comme icône d'onglet officielle

## Ce qui sera fait
1. Votre fichier (sceau 32 × 32, couleurs officielles) remplace l'icône d'onglet actuelle (la pastille ronde simplifiée).
2. Versions PNG nettes générées à partir de votre fichier : 48 px (anciens navigateurs) et 180 px sur fond blanc (écran d'accueil iPhone).
3. Le logo du menu, de l'accueil, de la connexion et de l'app mobile ne change pas.
4. Vérification : rendu à 16, 32 et 48 px pour contrôler la netteté.

## Détails techniques
- Copie de `user-uploads://favicon.svg` vers `public/favicon.svg` (sans modification).
- `public/favicon.png` (48 px) et `public/apple-touch-icon.png` (180 px, fond blanc, marge) régénérés avec ImageMagick haute densité.
- `index.html` déjà correct, aucun changement.
