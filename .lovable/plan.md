## Lot A — Tests RLS E2E (fixture Supabase réaliste)

**Fixture SQL** `supabase/tests/fixtures/rls-quick-actions.sql` (exécutée via `psql` en début de suite, idempotente : `BEGIN; ... ROLLBACK;` ou cleanup ciblé) qui seed :

- 3 users (organisateur, membre, étranger) via `auth.admin.createUser` côté script.
- 1 groupe `tontine-rls-test` (monthly, 10 000 GNF, 5 membres).
- 4 invitations :
  - `valid-active` — `expires_at = now()+7d`, `uses_remaining = 5`.
  - `expired` — `expires_at = now()-1d`.
  - `exhausted` — `uses_remaining = 0`.
  - `revoked` — `revoked_at = now()`.
- 3 cotisations dues sur cycle courant (1 due, 1 en retard, 1 payée) pour vérifier `my_contributions_due`.

**Suite E2E** `tests/e2e/rls-quick-actions.spec.ts` (Vitest + `@supabase/supabase-js`, clients `anon` par utilisateur et `service_role` pour audit) :

| # | Scénario | Attendu |
|---|----------|---------|
| 1 | `consume_invitation('valid-active')` user externe | success, `uses_remaining -= 1` |
| 2 | Même code après épuisement | erreur `invitation_exhausted` |
| 3 | `consume_invitation('expired')` | erreur `invitation_expired` |
| 4 | `consume_invitation('revoked')` | erreur `invitation_revoked` |
| 5 | Code malformé (`ZZZZ-9999`) | erreur Zod côté client + 400 RPC |
| 6 | `create_group` montant 999 GNF / 75 000 001 GNF | reject (CHECK + Zod) |
| 7 | `create_group` fréquence inconnue | reject enum |
| 8 | `select * from my_contributions_due` user étranger | 0 ligne (RLS) |
| 9 | Org sélectionne invitations d'un autre groupe | 0 ligne |

Cleanup : `delete from auth.users where email like '%@rls.test'` en `afterAll` via service role.

CI : nouveau job `bun test tests/e2e/rls-quick-actions.spec.ts` dans le workflow GitHub Actions existant, conditionné à la présence des secrets `SUPABASE_SERVICE_ROLE_KEY` (sinon `skip`).

---

## Lot B — SMS Nimba (inspiré Paxefy)

**Pré-requis utilisateur (étape suivante via `add_secret`)** :
- `NIMBA_SERVICE_ID`
- `NIMBA_SECRET_TOKEN`
- `NIMBA_SENDER_NAME` (défaut `Tontine`)
- `SMS_ENABLED` (optionnel, `false` désactive)

**Helper partagé** `supabase/functions/_shared/nimbasms.ts` — port direct du module Paxefy (auth Basic, retry 3x sur 420/429/5xx, fire-and-forget `sendMessageBg`, `fmtSms` pour montants GNF). Sender par défaut `Tontine`.

**Normalisation numéros guinéens** dans `profiles.phone` : helper `normalizeGNPhone(raw)` qui produit `224XXXXXXXXX` (accepte `+224`, `00224`, `6XXXXXXXX`). Utilisé avant chaque envoi.

**Préférences utilisateur** : étendre `notification_preferences` (migration séparée) avec :
- `sms_turn_upcoming boolean default true`
- `sms_contribution_due boolean default true`
- `sms_payment_received boolean default false`

UI : ajouter une section "SMS" dans le panneau Rappels de `GroupDetail` (toggles par type, badge "Numéro non vérifié" si `profiles.phone` est vide).

**Edge functions** :

1. **`send-tontine-reminders`** (cron horaire — créée pour Lot 3 emails) — branche également l'envoi SMS pour chaque user dont la préférence est ON et le téléphone connu :
   - J-2 prochain tour → `Tontine: votre tour arrive le {date}. Montant collecté ≈ {fmtSms(amount)} GNF.`
   - J-1 cotisation due → `Tontine {group}: cotisation de {fmtSms(amount)} GNF due demain. Payez via l'app.`
2. **`send-payment-confirmation-sms`** (déclenchée par trigger `contributions` ou appelée depuis le webhook Djomy déjà existant) — SMS de confirmation au payeur et à l'organisateur si opt-in.

Toutes les fonctions :
- CORS standard, `verify_jwt = false` côté config si déclenché par cron / webhook, sinon `true`.
- Validation Zod du payload.
- Log dans `reminder_log` (déjà présent) avec `channel = 'sms'`, `provider_message_id`, `cost`.

**Tests Deno** `supabase/functions/_shared/nimbasms.test.ts` :
- credentials manquants → `{ success: false }`.
- `SMS_ENABLED=false` → court-circuit success.
- mock fetch 201/420/400 (retry vs no-retry).
- `fmtSms(1500000) === '1\u00A0500\u00A0000'`.

---

## Ordre d'exécution proposé

1. Lot A (fixture + 9 specs E2E + job CI) — autonome, aucune dépendance externe.
2. Lot B étape 1 : helper `nimbasms.ts` + tests Deno + migration `notification_preferences` + UI préférences SMS.
3. Lot B étape 2 : intégration dans `send-tontine-reminders` (cron) et `send-payment-confirmation-sms`. Demande des secrets Nimba via `add_secret` juste avant le déploiement.

---

## Questions avant de coder

1. **Lot A — env de test** : on cible la base Lovable Cloud actuelle (avec préfixe d'isolation `@rls.test` + cleanup), ou tu préfères que je documente la procédure pour une instance Supabase dédiée aux tests ?
2. **Lot B — opt-in SMS** : par défaut **ON** pour `turn_upcoming` et `contribution_due`, **OFF** pour `payment_received` — OK ou tout OFF par défaut (RGPD strict) ?
3. **Lot B — Sender ID** : `Tontine` (11 chars max alphanum Nimba) — OK ou autre nom ?