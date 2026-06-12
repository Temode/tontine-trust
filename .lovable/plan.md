## Phase C — Opérations avancées

Livrée en **5 migrations SQL + UI dédiée + 1 edge function**. Toutes les RPC respectent la convention Phase A (`set_config('app.via_rpc','1', true)` quand mutation sensible, audit `log_audit`, guard via `has_admin_permission` ou `is_group_organizer`/`created_by`).

### C1 — Paiements externes (cash, virement, OM/MTN hors-app)
Fichiers : `db/35a_external_payments_enum_prelude.sql` + `db/35_external_payments.sql`

- Prelude COMMIT : ajout enum `payment_method_external` (`cash`, `bank_transfer`, `om_external`, `mtn_external`, `other`) et nouveaux `notification_kind` : `payment_confirmed_by_admin`, `payment_rejected_by_admin`.
- Table `external_payment_proofs` :
  ```
  id, contribution_id, group_id, member_id, amount,
  method payment_method_external, reference text, proof_url text, note text,
  status (pending|confirmed|rejected),
  recorded_by, recorded_at, reviewed_by, reviewed_at, reject_reason
  ```
  GRANTs + RLS (lecture : payeur + admins du groupe ; insert : payeur ou admin avec `can_confirm_payments`).
- RPC `submit_external_payment(_contribution_id, _amount, _method, _reference, _proof_url, _note)` — appelable par le payeur OU par admin.
- RPC `confirm_external_payment(_proof_id)` — guard `can_confirm_payments`, marque `contributions.status='confirmed'`, déclenche `recompute_reliability`, notif `payment_confirmed_by_admin`, audit.
- RPC `reject_external_payment(_proof_id, _reason)` — notif + audit.
- Storage bucket privé `payment-proofs` (chemins `{group_id}/{member_id}/{uuid}.ext`), policies RLS payeur + admins.

### C2 — Gestion des pénalités
Fichier : `db/36_penalty_management.sql`

- Colonnes ajoutées sur `late_penalties` : `waived_at, waived_by, waive_reason, adjusted_from numeric, adjusted_by, adjusted_at, adjust_reason`.
- Nouveaux `notification_kind` : `penalty_waived`, `penalty_adjusted` (prelude inclus).
- RPC `waive_penalty(_penalty_id, _reason)` — guard `can_waive_penalty`, met `amount=0`, audit + notif.
- RPC `adjust_penalty(_penalty_id, _new_amount, _reason)` — journalise l'ancien montant, audit + notif.
- Patch `apply_late_penalty` : skip si payeur `suspended` (déjà fait Phase B) **ET** si `groups.status='paused'` (Phase C3).

### C3 — Pause / reprise de cycle + report d'échéance
Fichiers : `db/37a_cycle_enum_prelude.sql` + `db/37_cycle_pause.sql`

- Prelude COMMIT : ajout `'paused'` à l'enum `group_status` ; nouveaux `notification_kind` : `cycle_paused`, `cycle_resumed`, `due_date_shifted`.
- Colonnes `groups` : `paused_at, paused_reason, paused_by, total_paused_days int default 0`.
- RPC `pause_cycle(_group_id, _reason)` — guard `can_pause_cycle` ou `created_by`, set status, notif all + audit. Le chat reste ouvert (à confirmer ci-dessous).
- RPC `resume_cycle(_group_id)` — calcule `days_paused = now() - paused_at`, décale automatiquement les `due_date` des tours non clôturés de ce nombre de jours, incrémente `total_paused_days`.
- RPC `shift_due_date(_turn_id, _new_date, _reason)` — guard organisateur ou `can_pause_cycle`, notif membres concernés.
- Patches policies INSERT (`contributions`, `turn_bids`, `turn_swaps`) : refuse si `groups.status='paused'`.
- Mini-trigger sur `groups` équivalent à A2 : bloque tout UPDATE direct de `status` hors RPC.

### C4 — Archivage du groupe
Fichier : `db/38_archive_group.sql`

- Nouveau `notification_kind` : `group_archived` (prelude inclus).
- Colonnes `groups` : `archived_at, archived_reason, archived_by`.
- RPC `archive_group(_group_id, _reason)` :
  - Guard : `created_by` strict OU `can_edit_settings`.
  - Refuse s'il reste des `contributions` non `confirmed/skipped` ou un `payout` non versé.
  - Set `groups.status='cancelled'`, remplit les colonnes archive.
  - Toutes les policies INSERT/UPDATE filtrent désormais `status not in ('cancelled')` → lecture historique préservée.
  - Notif `group_archived` à tous + audit.

### C5 — Rappels manuels + historique paiements
Fichier : `db/39_manual_reminders_and_history.sql`

- Nouveau `notification_kind` : `manual_reminder` (prelude inclus).
- Table `manual_reminders_log(id, group_id, sender_id, recipient_id, channel, message, created_at)` + index `(sender_id, recipient_id, created_at)`.
- RPC `send_manual_reminder(_member_id, _channel, _message)` :
  - Guard organisateur ou `can_send_announcements`.
  - Rate limit : refuse si un envoi `(sender, recipient)` < 24 h.
  - Crée une notification in-app (channels SMS/WhatsApp restent à câbler en Phase ultérieure — payload stocké).
- Vue `group_payments_history` (SECURITY DEFINER) agrégeant `contributions` + `external_payment_proofs` + `late_penalties` + `payouts`, lecture réservée aux membres du groupe.
- Vue `member_payments_history` (`_member_id`) pour la page profil membre.

### C6 — Exports
Frontend pour CSV (aucun backend) :

- Helper `src/lib/export/csv.ts` — génération CSV côté client (membres, paiements, audit) en `Blob` + download.
- Boutons "Exporter CSV" dans `MembersAdminPanel`, `PaymentsHistoryPanel`, `AuditLog`.

PDF via edge function :

- `supabase/functions/export-group-pdf/index.ts` — utilise `pdfkit` (Deno npm). Guard : JWT validé en code + check `is_group_organizer`. Stocke le PDF dans bucket privé `group-exports`, retourne signed URL 1 h.
- Helper `src/lib/api/exports.ts` : `exportGroupPdf(groupId)`.

### C7 — UI : nouveaux onglets dans `GroupSettings`
- **Paiements** :
  - `ExternalPaymentsPanel.tsx` — file d'attente des preuves à valider (admin) + soumission preuve (membre, upload vers bucket).
  - `PaymentsHistoryPanel.tsx` — table filtrable + export CSV.
- **Pénalités** : `PenaltiesPanel.tsx` — liste, actions waive/adjust avec dialogues raison.
- **Cycle** : `CycleAdminPanel.tsx` — boutons Pause / Reprendre / Archiver + `ShiftDueDateDialog.tsx`.
- **Rappels** : `ManualReminderDialog.tsx` accessible depuis `MembersAdminPanel` (action par ligne).
- Bouton "Exporter PDF" dans la barre d'actions du groupe.

### Nouveaux helpers API
- `src/lib/api/externalPayments.ts`, `src/lib/api/penalties.ts`, `src/lib/api/cycleAdmin.ts`, `src/lib/api/reminders.ts`, `src/lib/api/paymentsHistory.ts`, `src/lib/api/exports.ts`.
- Labels d'audit ajoutés dans `src/lib/api/audit.ts` : `external_payment_submitted`, `external_payment_confirmed`, `external_payment_rejected`, `penalty_waived`, `penalty_adjusted`, `cycle_paused`, `cycle_resumed`, `due_date_shifted`, `group_archived`, `manual_reminder_sent`.

### Ordre d'exécution
1. `db/35a_external_payments_enum_prelude.sql`
2. `db/35_external_payments.sql`
3. `db/36_penalty_management.sql`
4. `db/37a_cycle_enum_prelude.sql`
5. `db/37_cycle_pause.sql`
6. `db/38_archive_group.sql`
7. `db/39_manual_reminders_and_history.sql`
8. Frontend + edge function (livrés dans le même tour)

### Points techniques
- Pattern enum prelude COMMIT identique à 27a/28a/29a/32a — évite l'erreur 22P02 rencontrée précédemment (toute insertion utilisant un nouveau littéral enum passe par `EXECUTE format(...)` dynamique).
- Toutes les RPC mutant `groups.status` ou `contributions.status` passent `set_config('app.via_rpc','1', true)`.
- Aucune policy ne référence sa propre table → `has_admin_permission` + helpers SECURITY DEFINER.
- Buckets `payment-proofs` et `group-exports` : créés via `storage.create_bucket(..., public=>false)` avec policies RLS dédiées.
- Rate-limit rappels : check SQL `count(*) ... where created_at > now() - interval '24 hours'`.
- Pas de suppression de colonne existante → zéro régression UI.

### Hors scope (Phase D)
RGPD : `delete_account`, TTL `audit_log`, consentement versionné, masquage téléphone opt-in.

### Une question avant d'implémenter
Pendant une **pause de cycle**, faut-il aussi **bloquer le chat** et les **annonces**, ou seulement les flux financiers (contributions, enchères, swaps) ? Par défaut je laisse le chat et les annonces ouverts pour permettre la coordination entre membres pendant la pause.
