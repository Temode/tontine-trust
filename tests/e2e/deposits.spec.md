# Chantier 2 — Scénarios E2E « Cautions »

Trois scénarios Playwright (à exécuter via `python3 tests/e2e/run_deposits.py`).

## Scénario A — Membre rejoint après démarrage
1. Connexion en tant que membre B (qui n'est pas encore dans le groupe G en cours).
2. POST `join_group_with_code` avec un code valide de G (qui a `deposit_required=true`, `deposit_months=1`, `new_member_lock_last_third=true`).
3. Aller sur `/groupes/:id`.
4. **Attendu :** bandeau orange « Caution requise » + badge « Position N / N » dans le dernier tiers + badge « Retrait verrouillé ».

## Scénario B — Tentative de dépôt qui échoue
1. En tant que membre B sur `/groupes/:id/caution`.
2. Cliquer « Déposer la caution » avec un numéro Mobile Money simulé en échec côté webhook (`status=failed`).
3. **Attendu :** timeline montre l'étape « Échec / annulation » active, le verrou caution reste affiché sur GroupDetail, le bouton « Réessayer le paiement » apparaît.
4. Tester ensuite que `request_withdrawal` renvoie l'erreur traduite « Caution requise … ».

## Scénario C — Caution validée en retard (régularisation admin)
1. En tant qu'admin sur `/admin/cautions`, filtrer « En attente ».
2. Localiser la ligne du membre B → « Forcer » → choisir « Validé (paid) » → motif ≥ 10 caractères → Confirmer.
3. **Attendu :** statut passe à « Validé », `group_members.deposit_status='paid'`, et une entrée `deposit_forced` apparaît dans `audit_log`.
4. Connexion membre B → `/groupes/:id` : badge devient « Caution validée », et `request_withdrawal` ne déclenche plus `DEPOSIT_REQUIRED`.

## Exécution
Les scripts attendent les variables d'environnement Lovable :
- `LOVABLE_BROWSER_SUPABASE_STORAGE_KEY`
- `LOVABLE_BROWSER_SUPABASE_SESSION_JSON`

Et un code d'invitation valide passé en argument : `--invite-code XXXXXX --group-id <uuid>`.

## Scénario D — Idempotence du webhook Djomy
1. Récupérer un `eventId` Djomy fictif (UUID v4) et signer le payload avec `DJOMY_WEBHOOK_SECRET` (HMAC-SHA256).
2. `POST` deux fois le même payload (`payment.success`, `metadata.purpose='deposit'`, `merchantPaymentReference=<deposit_id>`) sur `…/functions/v1/djomy-webhook`.
3. **Attendu, 1er appel :** `{ ok:true, depositId, status:"succeeded", transitioned:"paid" }` + 1 SMS envoyé (vérifier `sms_logs.kind='deposit_paid'`).
4. **Attendu, 2e appel :** `{ ok:true, ignored:"already_processed" }` — aucune nouvelle ligne dans `sms_logs`, `member_deposits.paid_at` inchangé.
5. Variante : rejouer un `payment.failed` après un `payment.success` déjà traité → le second événement est ignoré (eventId différent mais l'idempotence interne RPC `apply_deposit_webhook` refuse de descendre depuis `paid`).

## Scénario E — SMS de notification caution
1. Démarrer un dépôt (Scénario B) puis simuler un `payment.success` signé.
2. **Attendu :** SMS reçu sur le numéro du profil, contenu « caution de X GNF validée ».
3. Désactiver dans `notification_preferences` le canal `sms` pour `notif_type='deposit_status'`.
4. Rejouer un échec → **aucun SMS** envoyé, mais `member_deposits.status='failed'` mis à jour.