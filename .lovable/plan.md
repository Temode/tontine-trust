## Audit SMS — état actuel et lacunes

### Déjà couverts par SMS (triggers Postgres + edge functions)
| Évènement | Source | Destinataire |
|---|---|---|
| `contribution_confirmed` | trigger `sms_on_contribution_confirmed` → `send-tontine-sms` | Payeur + relance autres pending |
| `turn_paid` (cagnotte versée) | trigger `sms_on_turn_paid` → `send-tontine-sms` | Bénéficiaire |
| `payout_hold_extended` | edge `send-tontine-sms` | Bénéficiaire |
| `cycle_completed` | trigger `sms_on_turn_paid` (dernier tour) | Organisateur + co-organisateurs |
| `turn_upcoming_j2` (rappel tour) | cron `send-tontine-reminders` | Bénéficiaire |
| `contribution_due` (J-2/J-1/J0) | cron | Membres pending |
| `contribution_late` (J+1, J+3, J+7, J+14) | trigger + cron 15 min (livré au tour précédent) | Membres en retard |

### Lacunes critiques (à corriger — financier/sécurité)
| Évènement | Destinataire | Priorité |
|---|---|---|
| **`withdrawal_requested`** — demande de retrait créée | **Demandeur** (« Votre demande de retrait de X GNF est enregistrée, Réf. WR-… ») + **super-admins / admins financiers** (« Nouvelle demande de retrait à valider ») | **P0** — manquant aujourd'hui |
| **`withdrawal_processing`** — passage en cours de traitement | Demandeur | P0 |
| **`withdrawal_paid`** — retrait effectivement versé | Demandeur (montant + canal + ref) | P0 |
| **`withdrawal_failed` / `withdrawal_cancelled`** | Demandeur (raison) | P0 |
| **`payment_confirmed_by_admin`** (validation manuelle d'un paiement externe) | Payeur | P0 |
| **`payment_rejected_by_admin`** | Payeur (raison) | P0 |
| **`penalty_adjusted` / `penalty_waived`** | Membre concerné | P1 |

### Lacunes opérationnelles (P1 — opt-in défaut ON pour les SMS structurants)
| Évènement | Destinataire |
|---|---|
| `cycle_started` (un nouveau cycle démarre) | Tous les membres |
| `cycle_paused` / `cycle_resumed` | Tous les membres |
| `due_date_shifted` (échéance déplacée par l'organisateur) | Membres impactés |
| `member_joined` | Organisateur |
| `invitation_received` (avec lien d'invitation) | Invité (numéro saisi par l'organisateur) |
| `member_suspended` / `member_reactivated` / `member_kicked` | Membre concerné |
| `ownership_transferred` | Ancien + nouveau propriétaire |
| `group_deletion_requested` / `_pending_admin` / `_approved` / `_refused` | Tous les membres du groupe |
| `defaulter_reported` / `_resolved` | Membre signalé |
| `payment_pause_request_approved` / `_rejected` | Demandeur |
| `dispute_raised` / `_resolved` | Parties prenantes |

### Hors SMS (rester in-app uniquement)
`reliability_changed`, `announcement`, `chat`, `auction_outbid/won/lost/closed`, `swap_*`, `review_received`, `phone_visibility_changed`, `account_deleted`, `receipt_ready`, `permissions_changed` — bruit SMS trop élevé pour l'utilité ; restent en push/in-app.

---

## Plan d'implémentation

Approche unifiée : **brancher tous les évènements manquants sur l'edge `send-tontine-sms`** (déjà sécurisé via `X-Internal-Token`, déjà au sender `Tontine`), via de nouveaux triggers Postgres qui appellent `enqueue_tontine_sms(_kind, _payload)`.

### Migration `db/49_sms_coverage_audit.sql`

**1. Étendre `send-tontine-sms/index.ts`** avec les nouveaux `kind` :
- `withdrawal_requested` → 2 envois (demandeur + N admins financiers, identifiés via `has_role(..., 'super_admin')`)
- `withdrawal_status_changed` (générique : `processing|paid|failed|cancelled`)
- `payment_admin_decision` (`confirmed|rejected`, message paramétré)
- `penalty_adjusted` / `penalty_waived`
- `cycle_started` (boucle membres)
- `cycle_paused` / `cycle_resumed`
- `due_date_shifted`
- `member_lifecycle` (`joined|suspended|reactivated|kicked`)
- `ownership_transferred`
- `group_deletion_event` (`requested|pending_admin|approved|refused`)
- `defaulter_event` (`reported|resolved`)
- `payment_pause_decision` (`approved|rejected`)
- `dispute_event` (`raised|resolved`)
- `invitation_sent` (numéro brut depuis `invitations.phone`)

Chaque branche utilise `sendOne()` existant → respecte `notification_preferences` SMS + idempotence via `sms_logs`.

**2. Triggers Postgres**
- `withdrawal_requests` (`AFTER INSERT` + `AFTER UPDATE OF status`) → `enqueue_tontine_sms('withdrawal_requested' | 'withdrawal_status_changed', ...)`
- `payments` (`AFTER UPDATE` quand `status` passe `pending → confirmed|rejected` par un admin)
- `cycles` (`AFTER INSERT` quand status = `active`)
- `groups` (`AFTER UPDATE OF status` pour pause/reprise/archive)
- `turns` (`AFTER UPDATE OF due_date`)
- `group_members` (`AFTER UPDATE OF status` pour suspended/kicked/reactivated)
- `group_deletion_requests` (`AFTER INSERT` + `UPDATE OF status`)
- `member_default_reports` (`AFTER INSERT` + `UPDATE`)
- `payment_pause_requests` (`AFTER UPDATE OF status`)
- `contribution_disputes` (`AFTER INSERT` + `UPDATE`)
- `invitations` (`AFTER INSERT` quand `phone` renseigné)
- `member_admin_actions` (déjà existant) — instrumenter l'envoi SMS pour `ownership_transferred`

**3. Préférences par défaut**
Mise à jour de `seed_notification_preferences()` : SMS **ON par défaut** pour la liste « critiques » suivante (les autres restent OFF, l'utilisateur peut activer) :
```
withdrawal_requested, withdrawal_status_changed (mappé sur 4 types existants),
payment_confirmed_by_admin, payment_rejected_by_admin,
penalty_adjusted, penalty_waived,
cycle_started, cycle_paused, cycle_resumed, due_date_shifted,
group_deletion_requested, group_deletion_approved, group_deletion_refused,
member_suspended, member_kicked,
ownership_transferred,
payment_pause_request_approved, payment_pause_request_rejected,
dispute_raised, dispute_resolved
```
(les choix existants des utilisateurs sont préservés — un `ON CONFLICT DO NOTHING` reste en place.)

**4. Page « Préférences de notifications »** (`src/pages/NotificationPreferences.tsx`)
- Regrouper visuellement les types en 3 sections : **Critique** (verrouillé ON recommandé), **Important**, **Discret**. Pas de changement de logique métier — juste lisibilité.

### Tests
- `tests/e2e/sms-coverage.spec.ts` — pour chaque évènement critique, déclencher l'action (ex. `request_withdrawal`, validation admin d'un paiement, suspension membre) puis vérifier qu'une ligne `sms_logs` est créée avec le bon `kind` et `status='sent'|'skipped'` cohérent avec les préférences.

### Hors périmètre
- Pas de refonte de l'edge function `send-tontine-sms` (on ajoute des branches).
- Pas de re-envoi rétroactif pour les évènements passés.
- Aucune modification des préférences existantes des utilisateurs (RGPD).
- Pas de SMS pour `chat`, `auction_*`, `swap_*`, `review_*`, `announcement`, `reliability_changed` — restent in-app/push.

### Impact attendu
Après déploiement : chaque demande de retrait, validation/refus de paiement, démarrage de cycle, suspension de membre, etc. déclenche un SMS dans les secondes via le trigger Postgres, sans cron à attendre. Cohérent avec les préférences utilisateur et journalisé dans `sms_logs`.
