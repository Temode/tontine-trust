# Plan : Gestion administrateur des membres (4 phases)

Objectif : donner à l'organisateur (et aux co-organisateurs avec droits granulaires) un vrai panneau de gestion de ses membres, sécurisé, RGPD-compatible pour un SaaS public.

Livré en **4 phases successives**. À chaque phase, migration SQL + RPC + UI + tests rapides.

---

## Phase A — Sécurité critique (préalable bloquant)

Avant d'ajouter quoi que ce soit, on referme les 2 trous identifiés par l'audit.

**A1. Patch `recompute_reliability(_user_id)`**
- Ajouter guard : `auth.uid() = _user_id OR public.is_group_organizer_of_any_group_with(_user_id)` (helper à créer)
- `revoke execute ... from public`, regrant ciblé à `authenticated`

**A2. Verrouiller `group_members` contre UPDATE direct du `role` / `status`**
- Remplacer la RLS `gm_update_organizer` par une policy qui n'autorise QUE des colonnes neutres (ex: `payout_position`) — et encore, via RPC
- Toute mutation `role`/`status` doit passer par les RPC de la phase B
- Helper SQL : trigger `BEFORE UPDATE` qui rejette si `OLD.role <> NEW.role OR OLD.status <> NEW.status` et que la session n'est pas marquée par un RPC `SECURITY DEFINER` (via `current_setting('app.via_rpc', true)`)

**A3. Audit automatique sur invitations**
- Patcher `createInvitation` / `revokeInvitation` (`src/lib/api/invitations.ts`) pour appeler `log_audit('invitation_created' | 'invitation_revoked', ...)`

Livrable : `db/31_security_hardening.sql` + edits frontend.

---

## Phase B — Gestion des membres (cœur de la demande)

### B1. Statut `suspended` + suspension multi-effets

- Nouveau libellé enum : `alter type member_status add value 'suspended'`
- Colonnes : `suspended_at timestamptz`, `suspended_reason text`, `suspended_by uuid` sur `group_members`
- RPC `suspend_member(member_id, reason)` → set status, audit, notif
- RPC `reactivate_member(member_id)` → restaure `'active'`, audit, notif
- Effets bloqués (selon ta sélection) :
  - **Chat / enchères / swaps** : ajouter check `status = 'active'` dans les RPC `post_message`, `place_bid`, `request_turn_swap`, `respond_turn_swap`
  - **Accès lecture au groupe** : adapter RLS `group_select_member` pour exclure `'suspended'` (le membre voit le groupe en lecture minimale via une vue dédiée `my_suspended_groups` pour qu'il sache qu'il est suspendu)
  - **Saute son tour de rotation** : à la complétion d'un tour, `advance_cycle` saute le membre suspendu et marque son tour comme `'skipped_suspended'` (à reporter à la fin de la rotation)
  - **Suspend pénalités** : `apply_late_penalty` skip si payeur suspendu

### B2. `kick_member` (exclusion définitive)

- RPC `kick_member(member_id, reason)` :
  - Vérifie qu'aucune contribution due/payout en attente
  - Set `status='removed'`, redistribue la position de rotation (decal des positions > N de -1)
  - Audit + notif au membre
- UI : bouton dans la liste membres

### B3. Vrai système co-organisateur — permissions fines (tu as choisi cette option)

- Nouvelle table `group_admin_permissions` :
  ```
  group_id, member_id (group_members FK),
  can_approve_members, can_kick, can_suspend,
  can_edit_settings, can_invite, can_revoke_invites,
  can_manage_payments, can_manage_penalties,
  can_send_reminders, can_export_data,
  granted_by, granted_at
  ```
- Supprimer / déprécier `groups.co_organizers` (téléphones) — migration : convertir si match phone→user
- Helper SQL `has_admin_permission(group_id, user_id, permission_name)`
- Toutes les RPC admin l'utilisent au lieu de `is_group_organizer` (le créateur reste admin total)
- RPC `grant_admin_permission(member_id, perm, true|false)` réservée au `created_by`
- UI : panneau "Co-organisateurs" dans `GroupSettings` avec checkboxes par permission

### B4. Permissions fines par membre (au-delà du suspended)

- Table `member_permissions` :
  ```
  member_id PK, can_chat bool default true,
  can_bid bool default true, can_swap bool default true,
  can_invite bool default true
  ```
- Helpers + checks dans les RPC concernées
- UI : bouton "Permissions" par ligne membre (dialog avec switches)

### B5. `transfer_ownership(new_owner_member_id)`

- Réservé au `created_by`
- Met à jour `groups.created_by`, bascule l'ancien en `role='organisateur'` + toutes permissions
- Confirmation 2 étapes + audit

### B6. UI "Gestion des membres" (refonte de `GroupSettings` onglet Membres)

- Liste avec : nom, statut (badge), score, role, actions (Suspendre/Réactiver/Exclure/Permissions/Promouvoir co-organisateur)
- Filtres : actifs / suspendus / removed
- Modal de confirmation pour actions destructives + champ raison

Livrable : `db/32_suspended_status.sql`, `db/33_admin_permissions.sql`, `db/34_member_permissions.sql`, `db/35_ownership_transfer.sql`, nouvelles RPC, composants `MemberManagementPanel.tsx`, `AdminPermissionsDialog.tsx`, `MemberPermissionsDialog.tsx`.

---

## Phase C — Opérations avancées (utiles SaaS public)

**C1.** RPC `confirm_external_payment(member_id, amount, method, proof_url)` — pour cash/virement hors-app (audit + notif)
**C2.** RPC `waive_penalty(contribution_id, reason)` + `adjust_penalty(contribution_id, new_amount, reason)`
**C3.** RPC `pause_cycle(reason)` / `resume_cycle()` + statut `groups.status='paused'` (nouvelle valeur enum) + RPC `shift_due_date(turn_id, new_date)`
**C4.** RPC `archive_group(reason)` → statut `'cancelled'` propre, garde l'historique, bloque toute écriture future
**C5.** RPC `send_manual_reminder(member_id, channel, message?)` — appelable par l'organisateur, rate-limité (1/24h par couple)
**C6.** Vue `group_payments_history` (SECURITY DEFINER) + page "Historique" dans `GroupSettings`
**C7.** Export CSV (membres + paiements) côté client + export PDF récap groupe via edge function

Livrable : `db/36_external_payments.sql`, `db/37_penalty_management.sql`, `db/38_cycle_pause.sql`, `db/39_archive_group.sql`, `db/40_manual_reminders.sql`, edge function `export-group-pdf`.

---

## Phase D — RGPD / Conformité publique

**D1.** RPC `delete_account()` → anonymise `profiles` (`phone_number='', display_name='Utilisateur supprimé'`), garde les écritures comptables pseudonymisées, supprime `notifications_*`, `notification_prefs`. Soft-delete pour audit légal.
**D2.** TTL `audit_log` : job pg_cron mensuel qui purge > 6 ans, archive optionnelle vers stockage
**D3.** Consentement explicite à `join_group_with_code` : nouveau paramètre `_accepted_terms_version text`, insert dans `group_consent_log(member_id, terms_version, accepted_at, ip_hash)`
**D4.** Masquage téléphone par défaut : nouvelle colonne `profiles.phone_visible_in_groups bool default false`, opt-in dans Profil + masque `+221••••••67` dans `listGroupMembers` quand non opt-in

Livrable : `db/41_rgpd_delete_account.sql`, `db/42_audit_ttl.sql`, `db/43_consent_log.sql`, `db/44_phone_privacy.sql`, page "Confidentialité" dans Profil, page "Supprimer mon compte".

---

## Détails techniques

**Convention RPC SECURITY DEFINER** :
```sql
create or replace function public.X(...) returns ...
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  -- check permission via has_admin_permission ou is_group_organizer
  -- set app.via_rpc='1' pour passer le trigger de B1.A2
  perform set_config('app.via_rpc','1', true);
  -- ... mutation ...
  perform public.log_audit(...);
end$$;
```

**Notifications** : réutiliser `enqueue_notification` (`db/26`) avec nouveaux `notification_kind` : `member_suspended`, `member_reactivated`, `member_kicked`, `admin_role_granted`, `ownership_transferred`, `payment_confirmed_by_admin`, `penalty_waived`, `cycle_paused`, `group_archived`.

**Tests post-phase** : pour chaque phase, smoke test manuel (créer un 2e compte test, suspendre, vérifier blocages).

---

## Ordre d'exécution proposé

```text
Phase A  ──▶  Phase B  ──▶  Phase C  ──▶  Phase D
 (safety)     (member mgmt)   (ops)         (RGPD)
  1 mig         5 mig          5 mig         4 mig
  ~30 min       ~2-3 h         ~2 h          ~1.5 h
```

Je commence par la **Phase A** dès validation, puis enchaîne directement sur la **Phase B** dans la même livraison (les deux sont liées : B dépend des helpers de A). Phases C et D livrées séparément ensuite.
