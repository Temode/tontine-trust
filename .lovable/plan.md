## Objectif

1. Envoyer des **SMS de rappel automatiques en cas de retard** (pas seulement avant l'échéance), en mentionnant la pénalité encourue selon la config du groupe.
2. Garantir que **la pénalité s'applique réellement** quel que soit le canal de paiement.
3. **Audit du retard prolongé** : escalade automatique si le membre reste impayé plusieurs jours.

---

## Audit de l'existant

| Couche | État actuel | Problème |
|---|---|---|
| `enqueue_payment_reminders()` (db/21) — cron 08h UTC | Crée notifs in-app J-2 / J-1 / J0 / J+1 / J+3 | Ne mentionne pas la pénalité, pas d'escalade au-delà de J+3 |
| `send-tontine-reminders` (edge fn) | Envoie SMS J-2 (bénéficiaire) et J-1 (cotisation due) | **Aucun SMS en retard (J0, J+N)**, pas de mention de pénalité |
| `record_mock_payment` (db/17) | Calcule et fige `penalty_amount` au moment du paiement | OK |
| `apply_djomy_webhook` (db/46) | Confirme la contrib via Djomy | **BUG : ne calcule pas la pénalité** — paiements Orange Money / MoMo / carte échappent à la pénalité |
| `member_default_reports` | Signalement manuel par l'organisateur | Pas d'escalade automatique |

---

## Plan d'implémentation

### 1. Migration SQL (db/49)

**a. Corriger Djomy — appliquer la pénalité réelle**

Dans `apply_djomy_webhook`, avant l'`update contributions set status='confirmed'`, ajouter le même bloc que `record_mock_payment` :

- Lire `groups.late_penalty_percent` + `late_penalty_after_days`.
- Si `(current_date - turn.due_date) > grace`, calculer `penalty = amount * pct / 100`, écrire `contributions.penalty_amount`, et `append_ledger(... 'penalty' ...)`.
- Vérifier que le montant Djomy effectivement payé couvre `amount + penalty` (sinon laisser `status='submitted'` + notif litige).

**b. Étendre `enqueue_payment_reminders()` avec pénalité + nouveaux buckets**

- Buckets : `J-2, J-1, J0, J+1, J+3, J+7, J+14`.
- Calculer `expected_penalty` pour chaque bucket en retard et l'inclure dans `notifications.data` (utilisé par le SMS).
- À `J+7` : créer/raffraîchir automatiquement un `member_default_reports` (statut `auto_flagged`) si absent, pour que l'organisateur le voie.
- À `J+14` : marquer le membre `group_members.status = 'suspended_late'` (nouveau statut ou drapeau `is_late_suspended`) — bloque vote/enchères jusqu'au paiement.

**c. Vue helper `pending_reminders_view`**

Expose pour l'edge function : `contribution_id, payer_user_id, group_id, group_name, turn_number, due_date, amount, expected_penalty, days_late, bucket`. Évite la double logique métier dans Deno.

### 2. Edge function `send-tontine-reminders`

- Lire `pending_reminders_view` pour tous les buckets de retard du jour.
- Idempotence via `reminder_log` (table existante, clé `contribution_id + sent_on + bucket`).
- Format SMS pro (cohérent avec les SMS Tontine Digitale déjà en place — réf `TD…`, montants `9 000 GNF`) :

```
Tontine Digitale: cotisation tour #3 du groupe « Famille Alice »
en retard de 3 j. Montant 50 000 GNF + pénalité prévue 2 500 GNF (5%).
Réglez avant le 28/06 pour éviter une nouvelle majoration.
Réf TD260623.0800.A12345
```

- Respect des `notification_preferences` (kind `contribution_due`), opt-in par défaut.

### 3. UI — `src/pages/GroupSettings.tsx` & `MyContributions.tsx`

- Sur la page Paramètres → carte « Pénalités de retard » : ajouter une ligne d'aide indiquant les seuils d'escalade (`J+7 signalement organisateur`, `J+14 suspension`).
- Sur `MyContributions.tsx` (carte d'une cotisation en retard) : afficher `expected_penalty` + texte « En cas de paiement après J+N, pénalité de X GNF ». La donnée existe déjà dans la vue `my_contributions_due`.

### 4. Tests / vérification

- `psql` : créer une contribution simulée en retard et appeler `enqueue_payment_reminders()` → vérifier insertion notifs + flag défaut à J+7.
- `curl` sur `send-tontine-reminders?dry_run=true&date=…` pour valider les SMS générés à chaque bucket sans envoi réel.
- Replayer un webhook Djomy en retard → vérifier `contributions.penalty_amount > 0` et ledger `penalty`.

---

## Politique de retard proposée (à valider)

```text
J-2  SMS rappel échéance proche
J-1  SMS rappel échéance demain
J0   SMS échéance aujourd'hui (sans pénalité, dans le délai de grâce)
J+1..+grace  Aucun SMS (délai de grâce du groupe)
J+grace+1    SMS retard + pénalité commence à courir
J+3   2e SMS + notif organisateur
J+7   Signalement défaut automatique (statut auto_flagged)
J+14  Suspension automatique des droits du membre (vote, enchères)
J+30  L'organisateur peut déclencher exclusion via le flux défaut existant
```

Modifiable plus tard via des colonnes `groups.auto_flag_days` / `auto_suspend_days` (par défaut 7 / 14) — non incluses dans ce premier jet pour rester focalisé.