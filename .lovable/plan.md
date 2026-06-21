## Objectif

Réécrire `src/pages/MyContributions.tsx` (route `/payer`) pour atteindre le niveau "infrastructure financière" défini dans `docs/DESIGN_DOCTRINE.md` — calme, autorité, clarté, zéro scroll pour l'info critique. Aucun changement de logique métier, de schéma, ou d'API : uniquement présentation, hiérarchie et composition.

## Diagnostic de l'écran actuel

- Hero bleu/or correct mais générique (trois tuiles équivalentes → aucune action primaire visible).
- Barre de filtres dense, sans titre, dominée par la recherche — viole la règle "une seule action primaire" et "hiérarchie typo stricte".
- Trois sections empilées (Récap / À régler / Historique) toutes au même poids visuel → l'utilisateur ne voit pas *quoi payer maintenant*.
- Ligne de cotisation à régler : CTA "Payer via Djomy" en bas à droite, petit, secondaire visuellement par rapport au montant.
- `DueCard` existe déjà dans le dashboard avec l'accent latéral d'urgence (pattern de référence de la doctrine) mais n'est pas utilisé ici.

## Direction de redesign (les 4 règles d'or appliquées)

### 1. Hero "Cockpit de paiement" — une seule action primaire
Refondre le hero en cockpit asymétrique 2/3 + 1/3 :
- **Colonne gauche (focus)** : libellé `À régler maintenant` (uppercase tracking-wider, opacity 75), montant XXL display bold en `num` + unité GNF séparée, sous-ligne `{n} cotisations · {n} en retard` discrète. CTA primaire **unique** "Payer la plus urgente" (whitespace-nowrap, déclenche `DjomyPaymentModal` sur la prochaine échéance) + lien ghost "Tout voir".
- **Colonne droite** : mini-timeline verticale des 3 prochaines échéances (date compacte + nom tontine tronqué + montant en `tabular-nums`), rien de cliquable hormis chevron discret.
- Halo accent or très diffus en arrière-plan (déjà présent), pas de gradient violet. Aucune tuile KPI redondante : les compteurs "En retard / Payées" descendent dans une bande KPI fine sous le hero.

### 2. Bande KPI minimale (pattern doctrine)
Trois KPI tiles plates inline sous le hero : `Total dû`, `En retard`, `Payées ce cycle`. Icône dans `bg-primary-50`, label uppercase tracking-wider, valeur display bold, hint discret. Pas de fond coloré, juste `border-hairline`.

### 3. Filtres dégonflés
- Les filtres ne dominent plus : barre compacte alignée à droite (`h-9`, `w-64` recherche, deux selects `h-9` étroits), aucun fond `card/80`, juste un séparateur. Titre de section "Cotisations" à gauche.
- Filtre statut par segmented control (Tous / À régler / Retard / Payées) à la place des selects pour les statuts → plus lisible, une seule décision.

### 4. Section "À régler" en cartes DueCard
Remplacer la liste plate par une grille responsive de `DueCard` (composant déjà utilisé dans le dashboard) :
- Accent latéral coloré selon urgence (retard = `destructive`, ≤3j = `warning`, sinon `primary`).
- Montant XL, date relative ("dans 2 jours", "il y a 4 jours"), nom tontine, tour, bénéficiaire.
- Un seul CTA "Payer maintenant" pleine largeur en bas de carte (whitespace-nowrap).
- Grille `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, `gap-4`.
- Si plus de 6 cartes : pagination "Voir tout (n)" plutôt que scroll infini.

### 5. Récapitulatif par tontine → repli secondaire
Le récap par tontine devient une carte unique, repliée par défaut (`<details>` ou Accordion shadcn), titre "Vue par tontine ({n})". Reste accessible mais ne concurrence plus l'action principale.

### 6. Historique
Garder la liste actuelle (pattern propre) mais :
- Titre `Historique des paiements` + sous-titre date du dernier paiement.
- Limite affichée 10 (au lieu de 50) + bouton ghost "Voir tout l'historique" → route `/recus` (déjà existante).
- Montants en `tabular-nums`, séparateur de groupe en `divide-border/60` (déjà OK).

### 7. États vides & chargement
- Skeletons (jamais de spinner) pour hero, KPI, cartes — formes proches du rendu final (carte avec accent latéral fantôme).
- Empty state "À régler" = composant `EmptyState` avec icône `ShieldCheck`, titre "Vous êtes à jour", description "Aucune cotisation en attente.", CTA secondaire "Voir mes tontines".

## Détails de mise en œuvre (technique)

- Fichier touché : **uniquement** `src/pages/MyContributions.tsx`. Aucune modification d'API, de hook, de modèle, ou d'edge function.
- Réutiliser :
  - `DueCard` (`src/components/dashboard/DueCard.tsx`) pour les cartes à régler.
  - `EmptyState` (`src/components/ui/EmptyState.tsx`).
  - `SectionCard` pour les sections secondaires.
  - `formatGNF`, `formatRelativeDays` (déjà importés).
  - Tokens sémantiques existants (`primary`, `accent`, `destructive`, `warning`, `success`, `hairline`, `primary-50`, `primary-700`) — zéro couleur hardcodée.
- Ajouter un Accordion shadcn si le récap passe en repli (`@/components/ui/accordion`).
- Segmented control = simple groupe de boutons stylé (pas de nouveau composant), aria-pressed correct.
- `DjomyPaymentModal` ouvert : 
  - depuis le CTA hero (= `dues[0]` triée par `due_date asc` puis `days_to_due asc`).
  - depuis chaque `DueCard`.
- Vérifier rendu à 1280×800 et 712×800 (cibles doctrine) avec Playwright après implémentation : capture avant/après, contrôle qu'aucun CTA ne wrap, que l'info critique tient au-dessus de la ligne de flottaison.

## Checklist doctrine avant livraison

- [ ] Une seule action primaire visible (CTA hero "Payer la plus urgente").
- [ ] Info critique (montant dû + CTA) visible sans scroll à 1280×800 et 712×800.
- [ ] Tous les CTA sur une ligne, `whitespace-nowrap`.
- [ ] Montants en `tabular-nums` + `formatGNF` + unité séparée.
- [ ] Skeletons, pas de spinner.
- [ ] Empty states via `EmptyState`.
- [ ] Cluster filtres séparé du CTA principal (`gap-3` minimum).
- [ ] Aucune couleur hardcodée — tokens uniquement.
- [ ] Responsive vérifié à 712px.

## Hors scope

- Pas de changement du flux Djomy ni du modal de paiement.
- Pas de nouvelle table, edge function ou migration.
- Pas de modification de `Dashboard`, `Receipts`, ou des composants partagés (sauf import).
