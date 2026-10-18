# Icône d'onglet plus grande et plus nette

## Constat
Dans l'onglet, le sceau ne remplit qu'environ 60 % du carré : ses 12 pointes et ses 6 petits points deviennent flous à 16 px. Les icônes de Lovable et de Canva, elles, occupent tout le carré avec une forme pleine et très peu de détails.

## Ce qui sera fait
1. **Icône d'onglet dédiée**, conçue pour les petites tailles :
   - pastille bleu sarcelle pleine qui occupe tout le carré (le contour du sceau est simplifié en cercle, car les pointes ne se voient plus à 16 px) ;
   - le rond doré central et les points autour agrandis d'environ 40 %, avec des espaces plus larges pour rester nets ;
   - même couleurs (sarcelle #0D7377, or #E8AA14, blanc).
2. **Version PNG nette** (32 et 48 px, et 180 px pour l'écran d'accueil iPhone), tracée directement en pixels, sans réduction floue.
3. Le sceau complet reste le logo officiel partout ailleurs (menu, accueil, connexion, app mobile).
4. Vérification visuelle : capture de l'onglet à 16 et 32 px, comparée à l'icône actuelle.

## Détails techniques
- Nouveau `public/favicon.svg` (viewBox 32, cercle plein r=16, points redimensionnés) ; `favicon.png` 48 px et `apple-touch-icon.png` 180 px générés avec ImageMagick depuis ce SVG à haute densité.
- `index.html` : ajout de `sizes` sur les liens d'icône ; aucun autre fichier touché.
