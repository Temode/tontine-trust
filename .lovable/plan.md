## Audit doctrine — page « Mes tontines »

Confronté à `docs/DESIGN_DOCTRINE.md`, l'écran enfreint plusieurs règles d'or :

| # | Problème observé | Règle enfreinte |
|---|---|---|
| 1 | 4 KPI tiles alignés sans hiérarchie : aucun « hero » qui dit *où vous en êtes* | R1 — une seule action/info primaire ; R4 — info critique sans scroll |
| 2 | `StatusBadge` en `uppercase tracking-wider` (Actif, Votre tour, Inscription) | Bannis : « badges ALL CAPS criards » |
| 3 | Mini-badge rôle (Organisateur/Participant) aussi ALL CAPS dans grid + table | Idem |
| 4 | Toolbar : barre de recherche `h-10` qui domine, sélecteur de tri visible en permanence, toggle vue + export collés sans `gap-3` | « Barres de recherche qui dominent » ; « empilement d'icônes sans regroupement » |
| 5 | État chargement = texte nu « Chargement… » | Bannis : « spinners/texte au lieu de skeletons » |
| 6 | Erreur réseau : bouton « Réessayer » directement à côté du titre, pas de cluster | Hiérarchie / air |
| 7 | Pied de page « X groupes affichés · Données en direct… » mélange métrique + signature | Hiérarchie typographique |
| 8 | Vue par défaut = `table` dense → premier coup d'œil = grille de chiffres, pas une infrastructure calme | Esprit doctrine (« calme, autorité ») |
| 9 | Mobile 712px : KPI strip passe en 2×2 puis 1×4, toolbar wrap brouillon | Responsive doctrine |

## Refonte proposée (frontend uniquement, couleurs Tontine inchangées)

### 1. Hero portefeuille (remplace le KPI strip 4-tiles)
Bandeau identique en esprit au hero Dashboard :
- `rounded-2xl border border-hairline bg-card` + dégradé sarcelle très subtil + filet vertical `bg-primary`.
- Bloc gauche : libellé `Capital engagé restant`, montant XL `font-display tabular-nums` + suffixe `GNF` petit, sous-ligne « Réparti sur N tontines actives ».
- Bloc droit (CTA) : si `upcomingTurn` existe → **« Préparer ma cagnotte »** (primaire, `whitespace-nowrap`) avec ligne « Vous recevez ~X GNF dans Y j sur *Groupe* ». Sinon état serein avec `ShieldCheck` « Aucun tour imminent ».
- Bandeau métriques bas (3 colonnes `divide-x divide-hairline` desktop / `divide-y` mobile) :
  - **Portefeuille** — `N groupes` · `X actifs`
  - **Cagnottes en circulation** — montant compact GNF
  - **Score moyen** — `XX %` + petite barre primary

Le composant `GroupsKpiStrip` actuel est remplacé par `GroupsHero` (nouveau composant). On garde la fonction `computePortfolio` telle quelle, donc les valeurs restent synchronisées avec les vraies données.

### 2. Refonte `StatusBadge`
- Suppression de `uppercase tracking-wider`.
- Capitalisation naturelle (« Actif », « Votre tour », « Terminé », « En cours d'inscription »).
- Padding élargi (`px-2.5 py-1`), `text-[11px] font-medium`, pastille colorée conservée.

### 3. Badge rôle (grid + table)
Remplacement du mini-bloc ALL CAPS par un libellé discret `text-[11px] text-muted-foreground` préfixé d'une icône `Crown` (organisateur) ou `Users` (participant), sans fond bruyant.

### 4. Toolbar reconstruite
- Bloc unique `rounded-2xl border border-hairline bg-card shadow-sm` qui suit la doctrine.
- Ligne 1 : recherche compacte `h-9` à gauche `flex-1 max-w-md` (ne domine plus), à droite cluster `gap-3` : segmented filter (chips Tous/Actifs/Votre tour/En cours/Terminés), puis `gap-3` séparateur visuel `border-l border-hairline`, puis toggle vue (List/Grid) + bouton Exporter ghost.
- Sélecteur de tri rangé dans un `DropdownMenu` (icône `ArrowUpDown` + label « Trier ») au lieu d'être affiché en permanence — réduit le bruit visuel.
- Mobile : recherche pleine largeur en ligne 1, cluster filtres en ligne 2 scrollable, cluster vue/tri/export en ligne 3 aligné à droite.

### 5. États
- **Chargement** : 3 skeletons (`h-24` hero + `h-12` toolbar + `h-64` table/grid) en `bg-secondary/60 animate-pulse`.
- **Erreur** : carte `rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6` avec icône `AlertTriangle`, titre, description et CTA Réessayer en bouton secondaire (`border border-hairline`), pas en primary rouge.
- **Empty filtré** & **empty initial** : déjà couverts par `EmptyState`, on l'aligne sur le radius `rounded-2xl`.

### 6. Vue par défaut
Bascule par défaut sur `grid` (cartes calmes) plutôt que `table`. La table reste accessible en un clic. (Décision réversible si vous préférez garder la table par défaut.)

### 7. Pied de page
Une seule ligne discrète : `tabular-nums` pour le nombre, puis · `Données en direct` aligné à droite via `flex justify-between`, en `text-[11px] text-muted-foreground`.

### 8. Responsive 712px (tablette portrait)
- Hero : titre + montant restent visibles sans scroll, CTA passe `w-full` sous le bloc texte.
- Bandeau métriques : `grid-cols-1` avec `divide-y` puis `sm:grid-cols-3 sm:divide-x sm:divide-y-0`.
- Toolbar : recherche pleine largeur, cluster vue/tri à droite reste sur une ligne.

## Fichiers touchés

```
src/pages/MyGroups.tsx           # remplace KpiStrip → GroupsHero, skeletons, footer
src/components/groups/GroupsHero.tsx       # NOUVEAU — hero portefeuille doctrine
src/components/groups/GroupsKpiStrip.tsx   # SUPPRIMÉ (ou conservé non utilisé)
src/components/groups/GroupsToolbar.tsx    # refonte cluster + tri en dropdown
src/components/groups/StatusBadge.tsx      # suppression ALL CAPS
src/components/groups/GroupsGrid.tsx       # badge rôle nettoyé
src/components/groups/GroupsTable.tsx      # badge rôle nettoyé + entêtes calmes
src/components/groups/EmptyState.tsx       # rounded-2xl
```

Aucune modification de business logic, d'API ou de schéma. Les KPI restent calculés par `computePortfolio` à partir des vraies données `listMyGroups`.

## Validation

- Re-lecture de la checklist doctrine sur 1280×800 et 712×800 (Playwright screenshots).
- Vérifier qu'aucune classe couleur n'est hardcodée et que tous les montants utilisent `tabular-nums` + `formatGNF`.
