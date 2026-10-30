# E2E — Chantier 4 : Pénalité de rétention majorée

Scénarios fonctionnels couvrant la détection J+1, la majoration de rétention,
le blocage du retrait, l'idempotence des notifications et les outils admin.

## Pré-requis

- Groupe `G` actif, fréquence hebdomadaire, 4 membres : Alice, Bob, Chris, Dave.
- Cycle en cours, tour #1 ouvert (bénéficiaire = Alice).
- Tous les membres ont une caution `paid` et un contrat signé.
- Numéros rattachés à un compte Nimba SMS valide.

## Scénario 1 — Détection automatique du retard J+1

1. Bob laisse sa cotisation `pending`. Échéance = `J`.
2. À `J+1`, le job `enqueue_payment_reminders` s'exécute.
3. Attendu :
   - `group_members{Bob}.was_late_in_cycle = true`.
   - `group_members{Bob}.was_late_at_turn_number` contient `1`.
   - Une notification `contribution_due` bucket `J+1` est créée pour Bob.

## Scénario 2 — Bénéficiaire en retard → rétention majorée

1. Bob règle sa cotisation à `J+2` (statut `confirmed`).
2. Tour #2 démarre. Le bénéficiaire de #2 est Bob.
3. Toutes les cotisations du tour #2 sont confirmées → `auto_close_turn`.
4. Attendu :
   - `turns{2}.payout_hold_until = paid_at + 14 jours` (7 std + 7 pénalité).
   - Une seule ligne dans `payout_hold_notifications_log` pour ce tour.
   - Notification `payout_hold_extended` insérée pour Bob.
   - SMS Nimba déclenché (vérifier `sms_logs.kind = 'payout_hold_extended'`).

## Scénario 3 — Blocage du retrait + message utilisateur

1. Bob ouvre `MyBalance` : carte « Fonds en attente de libération » visible.
2. Bob tente `request_withdrawal(group_id, amount)`.
3. Attendu :
   - RPC échoue avec `PAYOUT_LOCKED_UNTIL:<iso>`.
   - `WithdrawDialog` affiche « Fonds bloqués jusqu'au … ».
   - Aucun `withdrawal_requests` créé.

## Scénario 4 — Idempotence du webhook / re-exécution de job

1. Re-jouer manuellement le passage à `paid` du tour 2.
2. Attendu :
   - `payout_hold_notifications_log` contient toujours une seule ligne pour ce
     `turn_id`.
   - Aucun nouveau SMS `payout_hold_extended` dans `sms_logs`.
   - Pas de doublons dans `notifications`.

## Scénario 5 — Resend admin

1. Super-admin ouvre `/admin/retentions`, filtre « En cours uniquement ».
2. Clique « Renvoyer la notif » sur le tour #2 de Bob.
3. Attendu :
   - RPC `admin_resend_payout_hold_notice` retourne `true`.
   - `resend_count` incrémenté, `last_sent_at` mis à jour.
   - Nouveau `notifications` + `sms_logs` créés.
   - Entrée `audit_log` action `admin_resend_payout_hold_notice`.

## Scénario 6 — Reset au nouveau cycle

1. Cycle terminé → `start_cycle(group_id)` par l'organisateur.
2. Attendu :
   - `was_late_in_cycle = false` pour tous les membres.
   - `was_late_at_turn_number IS NULL`.
   - Les tours suivants utilisent la rétention standard tant qu'aucun retard.

## Scénario 7 — Historique côté membre

1. Alice (bénéficiaire d'un tour libéré) ouvre `MyBalance`.
2. Attendu : section « Historique des rétentions » avec badge « Libéré » et
   date de libération.
3. Sur `GroupDetail`, la même section filtrée au groupe courant.