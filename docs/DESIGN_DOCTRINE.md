# Doctrine de design — Tontine Digitale

> "Ça ne sonne pas comme une application locale, ça sonne comme une infrastructure."

On conçoit Tontine Digitale comme une **infrastructure financière** (Paxefy, Stripe, Wise, Linear), pas comme une app de quartier. Chaque écran doit dégager calme, autorité et clarté.

## Identité immuable

- **Couleurs** : bleu sarcelle `#0D7377` (primary) + or `#E8AA14` (accent). Aucune autre couleur d'accent. Pas de violet/indigo génériques.
- **Typo** : `font-display` (bold, tracking-tight) pour les titres, sans-serif neutre pour le corps. Montants toujours en `tabular-nums` (`.num`).
- **Ton** : direct, rassurant, orienté action. Pas de jargon, pas d'emoji décoratif dans l'UI.

## Les 4 règles d'or

1. **Une seule action primaire visible par écran.** Tout le reste est secondaire (ghost / icon button) ou caché dans un menu.
2. **Beaucoup d'air.** Padding généreux (`px-6`/`px-8`, `py-4`/`py-6`), `gap-3` minimum entre clusters d'icônes, jamais d'éléments collés.
3. **Hiérarchie typographique stricte.** Display bold pour le titre, `text-sm text-muted-foreground` pour le contexte. Une seule taille de titre par section.
4. **Zéro scroll pour l'info critique.** Ce que l'utilisateur doit faire *maintenant* est au-dessus de la ligne de flottaison.

## Ce qu'on bannit

- CTA qui retournent à la ligne (toujours `whitespace-nowrap`, libellé court).
- Badges ALL CAPS criards à côté d'un nom (ressemble à un tag de debug).
- Barres de recherche qui dominent visuellement un titre.
- Empilement d'icônes utilitaires sans regroupement ni séparation.
- Ombres lourdes, gradients violets/indigo, bordures épaisses.
- Spinners au lieu de skeletons.
- Boutons logout/destructifs nus à côté d'un CTA principal — toujours derrière un menu avatar.

## Checklist avant de livrer une page

- [ ] Une seule action primaire visible.
- [ ] L'info critique est visible sans scroll au viewport cible (1280×800 et 712×800).
- [ ] Tous les CTA principaux tiennent sur une ligne.
- [ ] Montants en `tabular-nums`, formatés avec `formatGNF` + unité séparée.
- [ ] Skeletons (pas de spinner) pendant le chargement.
- [ ] Empty states avec icône, titre, description et 1-2 CTA.
- [ ] Cluster d'icônes utilitaires séparé du CTA principal par `gap-3` minimum.
- [ ] Aucune couleur hardcodée — uniquement tokens sémantiques.
- [ ] Vérifié responsive à 712px de large.

## Patterns de référence

- **TopBar** : titre + sous-titre à gauche ; recherche compacte (`w-64`, `h-9`) ; cluster icônes (`gap-1`) ; CTA primaire ; menu avatar avec initiales. Hauteur fixe `h-16`.
- **Cartes de cotisation (`DueCard`)** : accent latéral coloré selon l'urgence, montant XL, date relative, un seul CTA "Payer maintenant".
- **KPI tiles** : icône dans badge `bg-primary-50`, label uppercase tracking-wider, valeur en display bold, hint discret.
- **Empty states** : composant `EmptyState` réutilisable, jamais de texte nu "Aucun résultat".