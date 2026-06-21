## Objectif

1. **Visite guidée** qui prend le nouvel utilisateur par la main en 5 étapes : logo + menu, Accueil, Mes tontines, Payer, cloche notifications.
2. **Passe de polish « niveau Paxefy »** sur les 4 pages membre clés, sans toucher aux couleurs (sarcelle #0D7377 + or #E8AA14 conservés).

## Partie 1 — Visite guidée

### Comportement
- **Auto-démarrage** à la première connexion (flag `localStorage: tt_tour_done_v1`).
- **Relançable** à tout moment via une icône « ? » discrète dans le TopBar (à côté de la cloche).
- 5 étapes, navigation Suivant / Précédent / Passer.
- L'utilisateur peut fermer à tout moment, le flag est posé.

### Étapes (sur n'importe quelle page authentifiée)

| # | Cible (élément) | Message |
|---|-----------------|---------|
| 1 | Logo + sidebar header | « Bienvenue sur Tontine Digital. Voici votre espace personnel. » |
| 2 | Lien `Accueil` (sidebar) | « Votre tableau de bord : ce que vous devez payer, votre prochain tour, vos tontines actives. » |
| 3 | Lien `Mes tontines` | « Toutes vos tontines, leurs membres, leurs cycles. » |
| 4 | Lien `Payer` | « Régler une cotisation en Orange Money, MTN Money ou carte, en quelques secondes. » |
| 5 | Cloche notifications (TopBar) | « Annonces, demandes d'adhésion, rappels — tout arrive ici. » |

### Choix technique
Composant **maison** basé sur shadcn `Popover` + un overlay SVG « spotlight » qui découpe un trou autour de la cible. Pas de dépendance externe (react-joyride, driver.js) — c'est ~200 lignes et ça reste 100 % cohérent avec le design system (radius, tokens, animations Tontine).

Fichiers à créer :
- `src/components/tour/GuidedTour.tsx` — orchestration, état, overlay
- `src/components/tour/TourStep.tsx` — popover stylé tokens Tontine
- `src/components/tour/useTour.ts` — hook avec `start()`, `stop()`, `hasSeen`
- `src/components/tour/steps.ts` — définition des 5 étapes (sélecteurs + textes)

Fichiers à modifier :
- `src/components/layout/AppShell.tsx` — monter `<GuidedTour />` + déclenchement auto
- `src/components/layout/TopBar.tsx` — bouton « ? » qui appelle `start()`
- `src/components/layout/DesktopSidebar.tsx` — `data-tour="nav-accueil"`, etc. sur les 3 liens
- `src/components/notifications/NotificationBell.tsx` — `data-tour="notifications"`

## Partie 2 — Polish « niveau Paxefy »

Périmètre : **4 pages membre clés** uniquement (Accueil, Mes tontines, Payer, Historique & reçus). Pas d'admin, pas de couleurs touchées.

### 2.1 En-têtes de page (TopBar enrichi)
Aujourd'hui le TopBar est plat : juste titre + sous-titre. Paxefy a des en-têtes denses qui contextualisent (chips de statut, fil d'Ariane sur les pages internes).

- Ajouter slot `breadcrumb?` (optionnel) au TopBar pour les pages de détail
- Ajouter slot `chips?` (optionnel) pour afficher des badges contextuels (ex. « 3 cotisations en attente » sur la page Payer)
- Renforcer la hiérarchie typographique : titre 24px bold + sous-titre 13px muted (déjà bon), ajouter une fine ligne de séparation `border-b border-hairline` (déjà là)

### 2.2 Cohérence des cartes
Audit rapide : aujourd'hui certaines cartes ont `rounded-xl border-hairline`, d'autres `rounded-lg shadow-sm`. Standardiser :

- **Toute carte de contenu** : `rounded-xl border border-hairline bg-card` (pas d'ombre, pattern Linear/Notion)
- **Carte cliquable / KPI actionnable** : ajout d'un `hover:border-primary/40 hover:shadow-primary-sm transition` pour signaler l'interactivité
- **Carte critique (paiement dû urgent)** : bordure gauche `border-l-4 border-l-destructive` au lieu d'un fond rouge agressif

Cibles : `SectionCard.tsx`, `KpiTile` (Dashboard), `ContributionRow` (Payer), `GroupRow` (Dashboard).

### 2.3 Empty states unifiés
Actuellement chaque page a son propre empty state. Créer un composant unique :

- `src/components/ui/EmptyState.tsx` avec : icône en cercle pastel, titre, description courte, CTA primaire + CTA secondaire optionnel
- Appliquer sur : `MyContributions` (dues vides + historique vide), `Dashboard` (préview tontines vide), `Receipts` (vide), `MyGroups` (déjà fait, harmoniser)

### 2.4 Détails « Paxefy-grade »
- Skeleton loaders au lieu de « Chargement… » texte brut (pages : Dashboard, MyContributions, MyGroups, Receipts)
- Format des montants : harmoniser sur `120 000 GNF` (espaces fines) partout via `formatGNF` (vérifier qu'aucun composant n'affiche `120000 GNF`)
- Format dates relatives : « il y a 3 jours » / « dans 5 jours » via `formatRelativeDays` partout
- Micro-animations : `animate-fade-in` à l'entrée de page (déjà partiellement là), `transition-colors` sur les liens sidebar (déjà là), `active:scale-95` sur boutons primaires

### 2.5 TopBar mobile
Aujourd'hui sur mobile (≤lg) le TopBar montre titre+sous-titre mais la zone droite est compressée. Réorganiser :
- Mobile : titre seul + 1 bouton icône action (Plus) + cloche + menu burger pour profil
- Desktop : version actuelle (search + action + cloche + profil + logout)

## Hors-scope (assumé)

- **Couleurs** : on garde sarcelle #0D7377 + or #E8AA14, aucune modification du token system
- **Typographie** : on garde la police actuelle (font-display + font-body déjà définis)
- **Pages admin** (`/admin/*`) : aucune modification
- **Backend / DB / Edge Functions** : aucune modification
- **Flux Djomy** : aucune modification

## Fichiers touchés (récap)

Création :
- `src/components/tour/GuidedTour.tsx`
- `src/components/tour/TourStep.tsx`
- `src/components/tour/useTour.ts`
- `src/components/tour/steps.ts`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/Skeleton.tsx` (si absent — vérifier shadcn)

Modification :
- `src/components/layout/AppShell.tsx`, `TopBar.tsx`, `DesktopSidebar.tsx`, `BottomNav.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/pages/Dashboard.tsx`, `MyContributions.tsx`, `MyGroups.tsx`, `Receipts.tsx`
- `src/components/dashboard/SectionCard.tsx`

## Validation

1. Premier login (vider localStorage) → tour démarre tout seul, les 5 étapes s'enchaînent sans bug, le spotlight cible bien chaque élément.
2. Clic sur « ? » dans TopBar → tour redémarre.
3. Capture comparative avant / après des 4 pages clés pour vérifier la cohérence.
4. Test responsive : tour s'adapte sur mobile (popover repositionné).
