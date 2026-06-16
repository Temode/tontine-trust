
## Constat (audit live)

J'ai sondé l'état réel via Playwright connecté en Alice puis en Bob :

1. **"0 membres" sur Famille Alice — faux positif** : la fiche groupe (`/groupes/:id`), le panneau d'admin (`/membres`), les paramètres (`/parametres`) et le dashboard affichent tous correctement **3 participants** pour Famille Alice (Alice, Bob, Hadja). Donnée DB OK (`my_groups_overview.members_count = 3`).  
   Le seul endroit qui affiche un compteur trompeur lié à ce groupe est la page **Co-organisateurs** :  
   *« Tous les membres actifs sont déjà co-organisateurs »* alors que la même page indique *« 0 co-organisateur »*. La condition `promotables.length === 0` est vraie dès qu'il n'y a aucun membre actif **non-owner et non-déjà-admin** : copy à corriger.  
   → Si tu vois "0 membres" ailleurs précis, capture l'URL/écran exact, sinon je traite le seul faux compteur trouvé.

2. **Migration `db/44_fk_turns_profiles.sql` — pas effective** : l'API renvoie encore `400 PGRST200 — Searched for FK 'turns_beneficiary_user_id_fkey'… no matches… 'Perhaps you meant cycles instead of profiles'`. Soit le fichier n'a pas tourné côté Supabase, soit le **cache de schéma PostgREST** ne l'a pas rechargé. Plutôt que de redépendre du FK, on rend le front **insensible** à l'embed et on republie un `NOTIFY pgrst, 'reload schema'`.

3. **Dashboard membre — manques identifiés** côté Bob : les KPI sont là (Groupes / Prochain tour / À payer), mais :
   - aucune **liste actionnable** des cotisations dues (juste un total) ;
   - aucune **annonce récente** ni **notification non lue** visible ;
   - les cartes "Mes groupes" affichent un cosmétique cassé : `VOTRE TOUR #0 —` quand aucun tour n'est encore assigné au membre ;
   - pas d'accès rapide aux **prochains bénéficiaires** des groupes où Bob participe.

---

## Plan d'action

### Étape 1 — Page Co-organisateurs : copy + UX (cible bug #1)
`src/pages/GroupCoOrganizers.tsx`
- Remplacer le message unique `Tous les membres actifs sont déjà co-organisateurs` par 3 cas distincts :
  - **Aucun membre actif** (uniquement le propriétaire) → *"Aucun membre éligible. Invitez d'abord des participants au groupe."* + bouton "Inviter des membres" (→ `/groupes/:id`).
  - **Tous les membres actifs sont déjà co-organisateurs** → texte actuel conservé.
  - **Sinon** → le `Select` normal.
- Calcul : utiliser `members.length` (actifs hors owner) pour distinguer les deux premiers cas.

### Étape 2 — Robustesse Rotation (cible bug #2)
`src/lib/api/turns.ts`
- Réécrire `listGroupTurns` en **2 requêtes** (sans embed FK) :
  1. `select id,group_id,cycle_id,turn_number,due_date,payout_amount,status,beneficiary_user_id from turns where group_id=…`
  2. `select id,full_name from profiles where id in (…uniques…)` puis mapper côté JS.
- Idem pour `getNextTurnForGroup` / `listMyNextTurns` si elles dépendent de l'embed (déjà via vue `next_turn_per_group`, donc à laisser).

`db/45_reload_postgrest.sql` (nouveau, idempotent)
- `notify pgrst, 'reload schema';` + ré-exécution défensive de la création de la contrainte (idempotent comme dans 44) pour que le redémarrage du cache prenne le FK même si 44 n'a pas été appliqué.
- À exécuter via le bouton "Run migration" de Lovable Cloud.

### Étape 3 — Dashboard membre enrichi (cible besoin #3)
`src/pages/Dashboard.tsx` (+ 2 petits composants neufs `src/components/dashboard/`)
- **Carte "À payer"** : remplacer la KPI passive par une liste de 1 à 3 cotisations dues (`listMyContributionsDue`) avec montant, groupe, échéance, bouton "Régler" (link `/cotisations`). Si aucune due → message "Vous êtes à jour".
- **Carte "Prochaines échéances"** : top 3 `listMyNextTurns` (groupe, bénéficiaire, date) — utile pour les membres non-organisateurs aussi.
- **Carte "Annonces récentes"** : 3 dernières annonces via un nouvel helper `listMyRecentAnnouncements(limit=3)` sur la table `group_announcements` filtrée par groupes où je suis participant actif. Si vide, on masque la carte.
- **GroupRow** (`src/components/dashboard/GroupRow.tsx`) : ne plus afficher la mention `VOTRE TOUR #0 —` quand `yourTurn === 0` ; remplacer par `—` discret ou masquer la pastille.

### Étape 4 — Vérification end-to-end (lecture seule)
- Re-run du probe Playwright (Alice + Bob) :
  - Co-organisateurs Famille Alice : message contextualisé OK.
  - Rotation Famille Alice : plus aucun 400 dans le réseau, tour #N rendu avec nom bénéficiaire.
  - Dashboard Bob : liste des dues, prochaines échéances, annonces visibles ; plus de `#0 —` cassé.
- Capture d'écrans dans `/tmp/browser/audit_v2/`.

---

## Détails techniques

```text
turns embed (avant)               turns embed (après)
─────────────────                 ───────────────────
.select("…,beneficiary:           1) .select("…,beneficiary_user_id") 
   profiles!turns_…_fkey(         2) .from("profiles")
   full_name)")                       .select("id,full_name")
                                      .in("id", uniqueIds)
                                  3) merge { ...turn, beneficiary_name }
```

```text
GroupCoOrganizers — promotables logic
─────────────────────────────────────
const activeNonOwner = members.filter(m=>m.user_id !== grp.created_by)
if (activeNonOwner.length === 0)        → "Aucun membre éligible"
else if (promotables.length === 0)      → "Déjà tous co-organisateurs"
else                                    → <Select>
```

```text
Dashboard (nouvelle structure)
──────────────────────────────
[ KPI strip × 3 ]
┌─ Mes groupes (2/3) ─┐  ┌─ Score de fiabilité ─┐
│ ...                 │  │                       │
└─────────────────────┘  └───────────────────────┘
┌─ À payer (liste actionnable) ┐ ┌─ Prochaines échéances ┐
│ • cotis groupe X – 50k – Régler │ • Tour #3 – 12 sept   │
└──────────────────────────────┘  └───────────────────────┘
┌─ Annonces récentes (si non vide) ──────────────────────┐
│ • Famille Alice : "Réunion demain 9h"                  │
└────────────────────────────────────────────────────────┘
```

### Fichiers
- **Édités** : `src/pages/GroupCoOrganizers.tsx`, `src/lib/api/turns.ts`, `src/pages/Dashboard.tsx`, `src/components/dashboard/GroupRow.tsx`.
- **Créés** : `src/components/dashboard/DuesCard.tsx`, `src/components/dashboard/UpcomingTurnsCard.tsx`, `src/components/dashboard/RecentAnnouncementsCard.tsx`, `src/lib/api/announcements.ts` (ajout `listMyRecentAnnouncements`), `db/45_reload_postgrest.sql`.

### Hors scope
- Pas de changement RLS ni de RPC.
- Pas de modification du module paiements ni du wizard de création.
- Si tu confirmes qu'un autre écran montre vraiment "0 membres", je l'ajoute en étape 1bis.
