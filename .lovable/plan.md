# Phase B — Persistance groupes, membres & invitations

Objectif : connecter le wizard de création, la liste « Mes groupes », le détail groupe et l'écran « Rejoindre » à la vraie BDD (tables créées en Phase A). Aucune donnée mock ne subsiste pour ces écrans.

## Périmètre

1. **Création de groupe** (`/creer-groupe`)
2. **Mes groupes** (`/groupes`)
3. **Détail groupe** (`/groupes/:id`) — onglet membres + invitations
4. **Rejoindre un groupe** (`/rejoindre`) via code

Les paiements, cycles, rotations, notifications, dashboard KPIs restent en mock (phases C–F).

## 1. Couche d'accès données

Nouveau dossier `src/lib/api/` :

- `groups.ts`
  - `listMyGroups()` → `from('my_groups_overview').select('*')`
  - `getGroup(id)` → groupe + rôle courant + compte membres
  - `createGroup(draft)` → insert dans `groups` (mapping `GroupDraft` → colonnes BDD : `name`, `description`, `category`, `contribution_amount`, `frequency`, `max_members`, `rotation_order_kind`, `late_penalty_percent`, `late_penalty_after_days`, `created_by = auth.uid()`). Le trigger `on_group_created` insère automatiquement l'organisateur dans `group_members`.
- `members.ts`
  - `listGroupMembers(groupId)` join `group_members` + `profiles`
- `invitations.ts`
  - `createInvitation(groupId, { maxUses, expiresAt })` → insert `invitations` (code généré côté SQL via default, ou côté JS si la colonne l'exige)
  - `listGroupInvitations(groupId)`
  - `revokeInvitation(id)`
  - `joinWithCode(code)` → `rpc('join_group_with_code', { _code: code })`

Toutes les fonctions retournent `{ data, error }` et laissent l'UI gérer les toasts.

## 2. React Query

- Installer/utiliser `@tanstack/react-query` (déjà présent via shadcn template normalement — à vérifier, sinon ajouter).
- Clés : `['groups','mine']`, `['group', id]`, `['group', id, 'members']`, `['group', id, 'invitations']`.
- Invalidation après création/join/revocation.

## 3. UI — modifications

### CreateGroup (`src/pages/CreateGroup.tsx`)
- Remplacer le `setTimeout` mock par `await createGroup(draft)`.
- En succès : récupérer l'`id` du groupe, créer une première invitation avec le `inviteCode` saisi (ou code généré par la BDD), naviguer vers `/groupes/:id` ou afficher l'écran `IssuedConfirmation` avec le vrai code.
- Gérer erreurs (toast destructive).

### MyGroups (`src/pages/MyGroups.tsx`)
- Remplacer `mock-data` par `useQuery(['groups','mine'], listMyGroups)`.
- Adapter `GroupsTable`/`GroupsGrid` aux nouveaux champs (mapping vers le type UI existant `Group`). Conserver les KPI strip en mock pour cette phase (libellé « démo »).
- État vide → CTA « Créer un groupe » / « Rejoindre ».

### GroupDetail (`src/pages/GroupDetail.tsx`)
- Charger `getGroup(id)` + `listGroupMembers(id)`.
- Si l'utilisateur est organisateur : afficher panneau invitations (liste + bouton « Nouveau code »).
- Sinon : masquer.

### JoinGroup (`src/pages/JoinGroup.tsx`) + `CodeEntryHero`
- Brancher le champ code sur `joinWithCode(code)`. En succès → toast + navigation vers `/groupes/:groupId`.
- Mapper les erreurs RPC : `invalid_code`, `expired`, `full`, `already_member`.

### InviteMembers (`src/pages/InviteMembers.tsx`)
- Sélecteur de groupe alimenté par `listMyGroups()` filtré sur `is_organizer = true`.
- Tableau invitations = `listGroupInvitations(groupId)`. Bouton « Nouveau code » → `createInvitation`. Bouton « Révoquer » → `revokeInvitation`.

## 4. Types

Ajouter `src/lib/api/types.ts` avec les interfaces DB (snake_case) et un adapter vers les types UI (`src/lib/types.ts`) pour ne pas casser les composants existants.

## 5. Garde-fous

- `ProtectedRoute` déjà en place sur ces routes — RAS.
- RLS Phase A garantit l'isolation : pas de logique d'autorisation côté client.
- Les erreurs Supabase remontent en toasts ; pas de `console.log` laissé.

## 6. Hors périmètre (phases suivantes)

- C : cycles + rotation auto
- D : contributions + paiements simulés
- E : versement et clôture de tour
- F : notifications BDD
- G : landing publique

## Validation attendue

Après merge :
1. Créer un groupe via le wizard → apparaît dans `/groupes`.
2. Copier le code → autre compte → `/rejoindre` → succès, le groupe apparaît pour les deux.
3. Organisateur voit la liste membres + invitations ; membre simple ne voit que les membres.
4. Aucune erreur 401/403 dans le réseau.

Dis « go phase B » pour que je lance l'implémentation.
