# Refonte du TopBar — esprit "Paxefy / Billion-Dollar"

## Constat sur la capture actuelle

Le top de la page Accueil empile trop d'éléments hétérogènes sur une seule ligne (titre + sous-titre + recherche large + cloche + aide + CTA vert qui retourne sur 2 lignes + badge PARTICIPANT en majuscules + bouton logout). Résultat : ça ne respire pas, le CTA "Nouvelle tontine" casse en deux lignes, le badge `PARTICIPANT` ressemble à un tag de debug, la barre de recherche prend la place du titre. Ce n'est pas l'image d'une infrastructure financière sérieuse.

## Doctrine (ce qu'on vise)

Inspiration Paxefy / Stripe / Wise / Linear : **ultra-propre, beaucoup d'air, typographie confiante, une seule action primaire visible, hiérarchie claire**. Les couleurs Tontine Digitale (bleu sarcelle #0D7377 + or #E8AA14) restent intactes — on ne touche qu'à la composition, la densité et le rythme.

## Livrables

### 1. Fichier de doctrine `docs/DESIGN_DOCTRINE.md` (nouveau)

Court (≈ 1 page), pour que les prochaines itérations restent alignées. Sections :
- **L'effet "Billion-Dollar"** : on conçoit Tontine Digitale comme une infrastructure financière, pas comme une app locale. Référence Paxefy / Stripe / Wise.
- **Les 4 règles d'or** : (1) une seule action primaire par écran, (2) beaucoup d'air (padding généreux, jamais d'élément collé), (3) typographie hiérarchisée (display bold pour le titre, regular muted pour le contexte), (4) couleurs Tontine sarcelle + or, jamais d'autre accent.
- **Ce qu'on bannit** : CTA qui retournent à la ligne, badges ALL CAPS criards, barres de recherche qui dominent un titre, empilement d'icônes sans regroupement, ombres lourdes, gradients violets génériques.
- **Checklist avant de livrer une page** : 6-8 points (zéro scroll pour l'info clé, skeletons et pas spinners, montants en `tabular-nums`, espace ≥ gap-3 entre groupes d'icônes, etc.).

### 2. Refonte de `src/components/layout/TopBar.tsx`

Composition cible (desktop) :

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Bonjour, Moussa                          [search]  [🔔] [?]  [+ Nouvelle tontine]  │  ⋮ avatar│
│  Voici ce qui demande votre attention                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

Changements précis :
- **Hauteur** unifiée à `h-16` (64px), padding `px-8`, `gap-4` entre groupes.
- **Titre** : on garde `font-display` mais on passe à `text-[22px]` + `tracking-tight` ; sous-titre `text-[13px]` muted.
- **Recherche** : largeur fixe `w-64`, hauteur `h-9`, fond `bg-secondary/40`, focus ring sarcelle léger — elle ne doit jamais rivaliser avec le titre.
- **CTA "Nouvelle tontine"** : `h-9`, `px-4`, `whitespace-nowrap`, libellé raccourci à **"Nouvelle tontine"** sur ≥lg et **"Nouvelle"** sur md ; plus jamais de retour à la ligne. Ombre subtile `shadow-sm` (pas l'ombre lourde actuelle).
- **Icônes utilitaires** (cloche, aide) regroupées dans un cluster avec `gap-1`, séparées du CTA par `gap-3` et un `divider` vertical fin optionnel.
- **Rôle "PARTICIPANT"** : on supprime le badge ALL CAPS criard du TopBar. Le rôle reste accessible via le menu profil / sidebar. Si on veut le garder visible, on le remet en `text-[11px] text-muted-foreground` *sans* fond ni bordure, à côté du nom dans un futur menu avatar.
- **Logout** : déplacé dans un **menu avatar** (dropdown) avec initiales de l'utilisateur dans un cercle 32px — pas d'icône logout nue à côté du CTA principal (ça crée 2 actions concurrentes).
- **Bordure basse** : `border-b border-hairline` conservée, mais on retire le `backdrop-blur` qui n'apporte rien sur fond opaque et on passe à `bg-card`.

### 3. Mobile

- Sous `md` : titre seul + cluster `[🔔] [avatar]` à droite. Recherche masquée (déjà le cas). CTA "+" en bouton icône rond `h-9 w-9` à droite du titre, pas dans la barre d'icônes.

## Hors-scope (à faire dans des passes suivantes)

- La sidebar, le contenu de la page Accueil (déjà traité au tour précédent), les autres pages du menu, la palette, les polices, le backend, les routes. On ne touche **que** le TopBar et on ajoute **un seul** fichier `.md`.

## Détails techniques

- Fichiers modifiés : `src/components/layout/TopBar.tsx` uniquement.
- Fichiers créés : `docs/DESIGN_DOCTRINE.md`, et éventuellement `src/components/layout/UserMenu.tsx` pour isoler le dropdown avatar (utilise `@/components/ui/dropdown-menu` déjà présent).
- Pas de nouvelle dépendance, pas de migration DB, pas de changement de tokens couleurs.
- Vérification : après build, lancer Playwright sur `/` connecté pour capturer le nouveau TopBar et confirmer (a) que "Nouvelle tontine" tient sur une ligne à 1280px et 712px, (b) que le badge PARTICIPANT a disparu du TopBar, (c) que le menu avatar ouvre Déconnexion.
