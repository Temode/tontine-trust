## Phase D — RGPD / Conformité publique

Dernière phase. Met l'app en conformité RGPD pour exploitation SaaS publique : droit à l'effacement, rétention auditable, consentement traçable, minimisation des données personnelles.

Livrée en **4 migrations SQL + 2 pages UI + patches API**. Toutes les RPC suivent la convention Phase A (`set_config('app.via_rpc','1', true)` si mutation sensible, `log_audit`, guards explicites).

---

### D1 — Suppression de compte (droit à l'effacement)
Fichier : `db/40_rgpd_delete_account.sql`

- Nouveau `notification_kind` : `account_deleted` (prelude inclus dans le même fichier via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` + COMMIT séparé pattern 32a/35a → fichier `db/40a_rgpd_enum_prelude.sql`).
- Colonnes `profiles` : `deleted_at timestamptz`, `deletion_reason text`.
- RPC `delete_account(_reason text default null)` :
  - Guard : `auth.uid()` obligatoire.
  - Refuse si l'utilisateur est `created_by` d'un groupe `status in ('active','collecting','paused')` avec encore des membres actifs → message demandant `transfer_ownership` ou `archive_group` d'abord.
  - Anonymise `profiles` : `full_name='Utilisateur supprimé'`, `phone_number=null`, `avatar_url=null`, `email_obscured=true`, `deleted_at=now()`.
  - Purge : `notifications`, `notification_prefs`, `manual_reminders_log` (où `recipient_id=uid` ou `sender_id=uid`), `member_reviews` (auteur uniquement → `reviewer_id` mis à null, texte anonymisé).
  - Conservation pseudonymisée : `contributions`, `payouts`, `external_payment_proofs`, `late_penalties`, `audit_log`, `group_members` (status → `'removed'` via `set_config('app.via_rpc','1')`), `turns`.
  - Audit `account_deleted` côté global (group_id null).
  - Marque `auth.users.banned_until = 'infinity'` via `service_role` pour empêcher reconnexion (note : nécessite trigger sur `auth.users` ou appel edge function — choix : edge function `delete-account` qui fait le ban après la RPC).
- Edge function `supabase/functions/delete-account/index.ts` :
  - Vérifie JWT, appelle `delete_account` RPC, puis `auth.admin.deleteUser(uid)` avec `service_role`.

### D2 — TTL & purge de l'audit log
Fichier : `db/41_audit_ttl.sql`

- Activation `pg_cron` (si pas déjà fait : `create extension if not exists pg_cron;`).
- Fonction `purge_audit_log()` SECURITY DEFINER :
  - Supprime `audit_log where created_at < now() - interval '6 years'`.
  - Insère un compte total purgé dans `audit_log_purge_history(id, purged_at, rows_deleted)`.
- Cron mensuel : `select cron.schedule('audit-ttl-monthly', '0 3 1 * *', $$select public.purge_audit_log()$$);`.
- Pas d'archivage automatique vers stockage en Phase D (hors scope) → noté dans `.lovable/plan.md`.

### D3 — Consentement versionné
Fichier : `db/42_consent_log.sql`

- Table `group_consent_log` :
  ```
  id, member_id, user_id, group_id, terms_version text,
  accepted_at timestamptz default now(), ip_hash text
  ```
  + index `(user_id, group_id, terms_version)`.
- Table globale `app_terms_versions(version text pk, content text, published_at timestamptz)` pour traçabilité.
- Patch RPC `join_group_with_code(_code, _accepted_terms_version text default null)` :
  - Si `_accepted_terms_version` null → raise `TERMS_REQUIRED`.
  - Insert `group_consent_log` après création/réactivation du `group_member`.
  - `ip_hash` = `encode(digest(coalesce(current_setting('request.headers',true)::jsonb->>'x-forwarded-for',''),'sha256'),'hex')`.
- GRANTs + RLS : lecture uniquement par l'utilisateur lui-même + organisateur du groupe.

### D4 — Masquage téléphone par défaut
Fichier : `db/43_phone_privacy.sql`

- Colonne `profiles.phone_visible_in_groups bool default false`.
- Helper SQL `mask_phone(_phone text) returns text` : `substring(phone,1,4) || '••••••' || right(phone,2)`.
- Patch `listGroupMembers` côté frontend → migration utilise une vue `group_members_view` SECURITY DEFINER qui applique le masquage si `phone_visible_in_groups=false` ET caller ≠ organisateur du groupe ET caller ≠ user lui-même.
- Frontend : page Profil → switch "Afficher mon numéro de téléphone aux membres de mes groupes" + appel `update_phone_visibility(_visible bool)`.

---

### Frontend
- **`src/pages/PrivacySettings.tsx`** (nouvelle) : switch téléphone, lien export données (réutilise C6/C7), lien suppression compte.
- **`src/pages/DeleteAccount.tsx`** (nouvelle) : écran de confirmation 2 étapes (saisir mot de passe + checkbox "je comprends que c'est irréversible"), appelle l'edge function `delete-account`.
- **`src/components/profile/PhoneVisibilityToggle.tsx`**.
- **`src/components/join-group/TermsAcceptanceCheckbox.tsx`** : checkbox obligatoire avant `joinGroupWithCode` + lien vers les CGU versionnées.
- Patch `src/lib/api/invitations.ts` : `joinGroupWithCode` accepte un nouveau param `acceptedTermsVersion`, envoyé à la RPC.
- Patch `src/pages/Profile.tsx` : lien vers "Confidentialité" et "Supprimer mon compte".
- Nouveau helper API `src/lib/api/privacy.ts` : `updatePhoneVisibility`, `deleteAccount`.
- Labels d'audit ajoutés à `src/lib/api/audit.ts` : `account_deleted`, `terms_accepted`, `phone_visibility_changed`.

---

### Ordre d'exécution
```text
1. db/40a_rgpd_enum_prelude.sql
2. db/40_rgpd_delete_account.sql
3. db/41_audit_ttl.sql
4. db/42_consent_log.sql
5. db/43_phone_privacy.sql
6. Edge function delete-account
7. Frontend (pages Privacy + DeleteAccount + TermsAcceptance)
```

---

### Points techniques
- Pattern enum prelude COMMIT identique à 27a/28a/29a/32a/35a → évite l'erreur 22P02.
- `pg_cron` doit être activé dans le projet Supabase (extension dispo par défaut).
- L'edge function `delete-account` est obligatoire car la RPC ne peut pas appeler `auth.admin.deleteUser` (limite Postgres). JWT vérifié côté Deno + `service_role` pour le ban.
- Vue `group_members_view` : aucune policy ne référence sa propre table → pas de récursion RLS.
- Conservation : RGPD article 17 prévoit qu'on garde les écritures comptables (obligation légale française : 10 ans). On pseudonymise au lieu de supprimer.
- Aucun `DROP COLUMN` → zéro régression UI.

---

### Hors scope (livré plus tard si besoin)
- Archivage chiffré de l'audit avant purge (vers bucket privé).
- DPA / sous-traitants : page statique CGU à éditer manuellement.
- Export complet RGPD "donne-moi toutes mes données" (JSON exhaustif) → réutilise la logique de C7 mais ajoute les tables annexes.

---

### Une question avant d'implémenter
Pour la **suppression de compte**, deux options :

1. **Bloquante stricte** : si l'utilisateur est `created_by` d'un groupe encore actif, on refuse la suppression et on lui demande de transférer ou archiver d'abord (approche choisie ci-dessus).
2. **Cascade automatique** : à la suppression, on archive automatiquement tous ses groupes encore actifs (`archive_group` interne) et on notifie les membres.

L'option 1 est plus prudente (l'utilisateur garde le contrôle) mais peut frustrer (il doit faire 2-3 étapes avant). L'option 2 est plus fluide mais peut surprendre les membres. Tu préfères laquelle ?
