## Phase B — Gestion des membres (cœur admin)

Phase A est appliquée. On enchaîne avec la gestion des membres complète. Cette phase est livrée en **2 migrations SQL + 1 dialogue UI** pour rester digestible.

### B1 — Statut `suspended` + RPC
Fichier : `db/32_suspended_status.sql`

- Ajoute la valeur `'suspended'` à l'enum `member_status` (prelude COMMIT obligatoire, vu le pattern utilisé en 27a/28a/29a → on splitte : `db/32a_suspended_enum_prelude.sql` puis `db/32_suspended_status.sql`).
- Colonnes ajoutées sur `group_members` :
  - `suspended_at timestamptz`
  - `suspended_reason text`
  - `suspended_by uuid` (FK profiles)
- RPC `suspend_member(_member_id uuid, _reason text)` :
  - Guard : `is_group_organizer` OU permission `can_suspend_member` (cf. B3).
  - `set_config('app.via_rpc','1', true)` puis `status='suspended'`.
  - Notif `member_suspended` + `log_audit`.
- RPC `reactivate_member(_member_id uuid)` : symétrique → `status='active'`.
- **Effets transverses** (policies/triggers existants à patcher) :
  - `group_messages` INSERT : refuse si membre suspendu.
  - `turn_bids` INSERT : refuse si suspendu.
  - `turn_swaps` INSERT : refuse si suspendu.
  - `groups` SELECT policy : un suspendu ne voit plus le groupe (lecture bloquée).
  - `apply_late_penalty` : skip si payeur suspendu.
  - `advance_rotation` / sélection prochain bénéficiaire : saute les `suspended`.
- Nouvelles valeurs `notification_kind` : `member_suspended`, `member_reactivated`, `member_kicked`, `permissions_changed`, `ownership_transferred` (prelude COMMIT inclus dans `32a`).

### B2 — Exclusion définitive
Inclus dans `db/32_suspended_status.sql` :

- RPC `kick_member(_member_id uuid, _reason text)` :
  - Guard organisateur ou permission `can_kick_member`.
  - Marque `status='removed'`, libère `position`, recompacte les positions actives.
  - Redistribue les tours `upcoming` non encore tirés (recalcul `payout_position`).
  - Notif `member_kicked` au membre + `log_audit`.

### B3 — Co-organisateurs avec permissions fines
Fichier : `db/33_admin_permissions.sql`

- Table `group_admin_permissions` :
  ```
  group_id uuid, user_id uuid,
  can_approve_members bool, can_suspend_member bool, can_kick_member bool,
  can_edit_settings bool, can_manage_invitations bool,
  can_confirm_payments bool, can_waive_penalty bool,
  can_send_announcements bool, can_pause_cycle bool,
  granted_by uuid, granted_at timestamptz,
  PRIMARY KEY (group_id, user_id)
  ```
- GRANTs + RLS : seul `created_by` du groupe lit/écrit (helper `is_group_owner`).
- Helper `has_admin_permission(_group uuid, _user uuid, _perm text) returns bool` (SECURITY DEFINER).
- RPC `grant_admin_permissions(_group, _user, _perms jsonb)` et `revoke_admin_permissions` — réservées au `created_by`.
- Notif `permissions_changed` + audit.
- `groups.co_organizers` (text[] de téléphones) marqué **deprecated** dans un commentaire SQL — non supprimé pour ne pas casser l'UI existante (sera nettoyé après migration des données en Phase C).

### B4 — Permissions fines par membre
Fichier : `db/34_member_permissions.sql`

- Ajout sur `group_members` :
  - `can_chat bool default true`
  - `can_bid bool default true`
  - `can_swap bool default true`
  - `can_invite bool default false`
- RPC `set_member_permissions(_member_id, _perms jsonb)` — guard organisateur ou `can_suspend_member`.
- Patch policies INSERT de `group_messages` / `turn_bids` / `turn_swaps` pour vérifier la flag.
- Notif `permissions_changed` + audit.

### B5 — Transfert de propriété
Inclus dans `db/33_admin_permissions.sql` :

- RPC `transfer_ownership(_group_id, _new_owner_user_id)` :
  - Guard : `auth.uid() = groups.created_by` strict.
  - `groups.created_by = new`, l'ancien devient `organisateur` (membre actif) + ligne `group_admin_permissions` pleine.
  - Le nouveau garde le rôle `organisateur`.
  - Notif `ownership_transferred` aux deux parties + audit.

### B6 — UI « Gestion des membres »
Côté frontend (aucun backend additionnel) :

- Nouveau composant `src/components/group/MembersAdminPanel.tsx` injecté dans `GroupSettings.tsx` (nouvel onglet/section « Membres ») :
  - Liste des membres : nom, score fiabilité, rôle, statut (badge `active` / `pending` / `suspended` / `removed`), position rotation.
  - Actions par ligne (menu kebab) : Suspendre · Réactiver · Exclure · Permissions… · Promouvoir co-organisateur · Transférer la propriété.
  - Dialogues `AlertDialog` pour les actions destructives avec champ « raison ».
  - Dialogue `PermissionsDialog` (switches) pour `member_permissions` et `admin_permissions`.
- Nouveaux helpers API :
  - `src/lib/api/members.ts` : `suspendMember`, `reactivateMember`, `kickMember`, `setMemberPermissions`, `transferOwnership`.
  - `src/lib/api/adminPermissions.ts` : `listAdminPermissions`, `grantAdminPermissions`, `revokeAdminPermissions`.
- Hook `useAdminCapabilities(groupId)` qui combine `is_group_owner` + `group_admin_permissions` pour afficher/masquer les actions.
- Labels d'audit ajoutés dans `src/lib/api/audit.ts` : `member_suspended`, `member_reactivated`, `member_kicked`, `permissions_changed`, `ownership_transferred`.

### Ordre d'exécution demandé
1. `db/32a_suspended_enum_prelude.sql` (COMMIT enum)
2. `db/32_suspended_status.sql` (suspend/reactivate/kick + effets)
3. `db/33_admin_permissions.sql` (co-orgs granulaires + transfer)
4. `db/34_member_permissions.sql` (permissions par membre)
5. Code frontend (livré dans le même tour)

### Points techniques

- Pattern enum prelude identique à `27a/28a/29a` pour éviter l'erreur 55P04 rencontrée précédemment.
- Toutes les RPC mutant `role`/`status` appellent `set_config('app.via_rpc','1', true)` (Phase A2).
- Aucune policy ne référence sa propre table → on passe par `has_admin_permission` SECURITY DEFINER (cf. règle RLS).
- GRANTs explicites sur chaque nouvelle table (`authenticated` + `service_role`).
- Pas de suppression de colonne existante → zéro risque de régression sur les écrans actuels.

### Hors scope (Phase C/D)
Confirmation de paiement externe, gestion pénalités, pause/reprise cycle, archivage, rappels manuels, exports CSV/PDF, RGPD (suppression compte, TTL audit, consentement, masquage téléphones).
