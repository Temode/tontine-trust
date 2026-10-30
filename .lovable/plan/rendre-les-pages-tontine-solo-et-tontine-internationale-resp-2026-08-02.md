# Rendre les pages Tontine Solo et Tontine Internationale responsives

## Constat de l'audit

**Formulaire Solo (`CreateSoloDialog`)**
- La modale n'a aucune hauteur maximale ni défilement : le contenu (2 sélecteurs de mode, nom, description, cotisation, fréquence, date, prévisualisation, alertes, CTA plan) dépasse largement l'écran d'un mobile. Le pied de page avec « Créer » devient inatteignable.
- `grid-cols-2` figé pour les deux cartes de mode et pour le couple Cotisation / Fréquence : à 360 px les libellés se serrent et se coupent.
- La grille de prévisualisation `grid-cols-2` avec valeurs alignées à droite écrase les libellés longs (« Échéances estimées », « Épargne projetée »).

**Page Solo**
- L'en-tête `flex items-start justify-between` colle le bouton « Nouvelle » au titre sur petit écran, sans repli en colonne.
- Le pied de modale garde les boutons sur une ligne étroite.

**Page Internationale**
- Pas de `TopBar` ni de padding vertical adapté, en-tête non contraint.
- Cartes de l'annuaire : bloc statistique `grid-cols-2` serré, badge « places » qui peut passer à la ligne de façon désordonnée.
- Modale de candidature : même absence de hauteur max/défilement, liste des membres + prévisualisation + alertes + zone de texte dépassent l'écran.
- La grille de prévisualisation souffre du même problème `grid-cols-2`.

## Ce qui sera fait

1. **Modales scrollables** : appliquer sur les deux `DialogContent` une largeur fluide (`w-[calc(100%-2rem)]`), une hauteur bornée (`max-h-[90dvh]`) et un corps défilant, en gardant l'en-tête et le pied visibles. Pas de modification du composant `ui/dialog` partagé, uniquement des classes locales pour ne rien casser ailleurs.
2. **Formulaire Solo adaptatif** : cartes de mode en pile sur mobile puis 2 colonnes dès `sm`; Cotisation / Fréquence en pile sur mobile; date d'échéance pleine largeur; boutons du pied en pleine largeur empilés sur mobile.
3. **Blocs de prévisualisation** : passage à une liste en pile sur mobile (libellé au-dessus de la valeur, alignement à gauche) et retour à deux colonnes dès `sm`, avec `break-words` pour les montants.
4. **En-têtes de page** : repli en colonne sur mobile (titre puis bouton pleine largeur) pour Solo; conteneur, paddings et taille de titre responsives pour Internationale.
5. **Cartes de l'annuaire international** : titre tronqué proprement, badge non compressible, bloc statistique lisible sur petits écrans, bouton pleine largeur conservé.
6. **Vérification visuelle** : captures Playwright des deux pages et des deux modales en 360 px, 768 px et 1280 px pour confirmer l'absence de débordement horizontal et l'accessibilité des boutons d'action.

## Détails techniques

- Fichiers touchés : `src/pages/Solo.tsx`, `src/pages/International.tsx` uniquement.
- Aucune logique métier, requête ou validation modifiée : uniquement des classes Tailwind et le découpage du contenu de modale en zone défilante.
- Les `data-testid` existants (`solo-alerts`, `intl-alerts`, `intl-preview`) sont conservés pour ne pas casser les tests E2E.
