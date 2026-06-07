# Plan — Persistance wizard, Mes candidatures réelles, et suite du durcissement

## Objectifs
1. Persister en base les champs `visibility` et `co_organizers` (perdus actuellement à la création).
2. Brancher `ApplicationsList` sur les vraies candidatures (vue `my_groups_overview` enrichie).
3. Ajouter une section « Mes candidatures » dans `MyGroups` pour suivre le statut jusqu'à l'adhésion.
4. Poursuivre la sécurisation côté API et UI (suite Phase H).

---

## 1. Migration DB — `db/12_visibility_and_co_organizers.sql`

```text
- ENUM public.group_visibility ('private','link','directory')
- ALTER TABLE public.groups
    ADD COLUMN visibility group_visibility NOT NULL DEFAULT 'private',
    ADD COLUMN co_organizers text[] NOT NULL DEFAULT '{}';
- Recréer la vue my_groups_overview pour exposer:
    visibility, my_status (déjà présent), my_role, organizer_name
- GRANT SELECT sur la vue à authenticated (idempotent).
```

Idempotent (`add column if not exists`, `create or replace view`).

## 2. Types & API
- `src/lib/api/types.ts` :
  - `DbGroup` ajoute `visibility`, `co_organizers`.
  - `DbGroupOverview` ajoute `visibility`, `my_status: 'active'|'pending'|null`, `my_role`.
  - `overviewToTontine` mappe `my_status='pending'` → `status='pending'`.
- `src/lib/api/groups.ts` :
  - `createGroup` envoie `visibility` (depuis `draft.visibility`) et `co_organizers` (depuis `draft.coOrganizerPhones`).
  - Nouvelle fonction `listMyApplications()` → filtre overview où `my_status='pending'` et `is_organizer=false`.

## 3. Section « Mes candidatures » dans `MyGroups`
- `src/pages/MyGroups.tsx` :
  - Récupère via `useQuery(['applications','mine'], listMyApplications)`.
  - Affiche `<ApplicationsList>` au-dessus de la grille principale quand la liste n'est pas vide.
  - Bouton « Retirer la candidature » → RPC `leave_group` (existant) ou DELETE sur `group_members` (status='pending', user_id=auth.uid()).
- `src/components/join-group/ApplicationsList.tsx` : déjà prêt visuellement, juste consommer les vraies données. Adapter mapping `DbGroupOverview` → `JoinApplication` (helper `overviewToApplication`).

## 4. Wizard `StepInvitations` / `CreateGroup`
- `types.ts` du wizard expose déjà `visibility` et `coOrganizerPhones` — vérifier qu'ils remontent jusqu'à `createGroup(draft)`.
- Validation Zod (`group.ts`) : ajouter règles MSISDN guinéen sur `coOrganizerPhones`.

## 5. Suite Phase H (continuation du travail en cours)
- `IssuedConfirmation` (dans `CreateGroup`) : intégrer `ShareSheet` (QR + WhatsApp) déjà créé à la place du bloc « Lien d'invitation » actuel.
- `JoinGroup` : confirmer que `?code=` ne déclenche plus l'auto-join (déjà fait via `ConfirmJoinDialog`) et que la redirection post-`pending` pointe sur `/groupes` → la nouvelle section sera donc visible.
- Petit empty state mis à jour dans `MyGroups` quand l'utilisateur n'a que des candidatures en attente.

## Fichiers
- **Nouveau** : `db/12_visibility_and_co_organizers.sql`
- **Édités** :
  - `src/lib/api/types.ts`
  - `src/lib/api/groups.ts`
  - `src/lib/validation/group.ts`
  - `src/pages/MyGroups.tsx`
  - `src/pages/CreateGroup.tsx` (IssuedConfirmation + ShareSheet)
  - `src/components/create-group/StepInvitations.tsx` (validation MSISDN)
  - `src/components/join-group/ApplicationsList.tsx` (signature props si besoin)

## Hors périmètre
- Intégration réelle Orange/MTN, KYC, signature cryptographique, edge function de rate-limit (laissés en backlog).
- Refonte visuelle autre que l'ajout de la section Candidatures.

## Validation
1. Migration exécutée → colonnes `visibility` + `co_organizers` présentes.
2. Alice crée un groupe « privé sur lien » avec 2 co-organisateurs → valeurs persistées (vérif via inspection ligne `groups`).
3. Bob saisit le code → `ConfirmJoinDialog` → status `pending` → redirigé sur `/groupes`.
4. `/groupes` affiche la section « Mes candidatures » avec le groupe d'Alice en « En attente ».
5. Alice approuve depuis l'écran organisateur → la candidature disparaît de la liste de Bob et le groupe apparaît en actif.
