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