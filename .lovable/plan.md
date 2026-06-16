## Objectif

Rejouer le test E2E Djomy maintenant que (a) le projet est publié, (b) la migration `db/46` corrigée doit être exécutée, et (c) le webhook Djomy est configuré. Confirmer que le paiement initié par Bob est tracé côté DB et reflété dans le dashboard.

## Pré-requis à confirmer avant lancement

1. Migration `db/46_djomy_payments.sql` exécutée avec succès dans le SQL Editor (sans l'erreur `memberships`).
2. Les 3 secrets Djomy sont bien présents côté edge functions : `DJOMY_CLIENT_ID`, `DJOMY_CLIENT_SECRET`, `DJOMY_ENV` (sandbox).

Je vérifierai (1) via `psql` (présence de la fonction `start_djomy_payment` et des colonnes `djomy_transaction_id`), et (2) via `fetch_secrets`.

## Scénario E2E (Playwright headless, sandbox dev `localhost:8080`)

Script `/tmp/browser/djomy-e2e-v2/pay.py` :

1. **Bob** (`bob@test.local`) login → `/cotisations`
2. Cliquer "Payer via Djomy" sur la ligne Famille Alice
3. Modale Djomy : laisser OM, saisir `620000002`, cliquer "Continuer vers Djomy"
4. Capturer le réseau : POST `…/djomy-init-payment` doit renvoyer 200 + `{ redirectUrl, transactionId, paymentId }`
5. Capturer la redirection vers `sandbox-api.djomy.africa` (screenshot, ne pas finaliser le paiement)
6. **Vérification DB côté Lovable** via `psql` :
   - `payments` row pour Bob avec `provider='djomy'`, `status in ('initiated','pending')`, `djomy_transaction_id not null`, `redirect_url not null`
7. **Simuler le webhook succès** : POST direct sur `…/djomy-webhook` avec un payload Djomy signé HMAC (clé `DJOMY_CLIENT_SECRET`) + status `SUCCESS` pour le `transactionId` créé.
   - Vérifier 200, idempotence (rejouer 2x → un seul ledger row).
8. **Vérification post-webhook DB** :
   - `payments.status = 'succeeded'`, `settled_at not null`
   - `contributions.status = 'confirmed'`, `confirmed_at not null`
   - 1 ligne dans `ledger_entries` (`kind='contribution_in'`, montant 500 000)
   - Notification générée si tour complet
9. **Alice** (`alice@test.local`) login → `/groupes/<famille-alice>` → onglet historique paiements (ou `my_payments_history` côté Bob) → screenshot confirmant la cotisation `succeeded`.
10. **Dashboard Bob** : recharger `/dashboard` → confirmer que "À payer" reflète le paiement (KPI mis à jour, échéance disparue ou marquée payée).

## Livrables

- Tableau récap (étape / statut / capture / requête réseau).
- Captures numérotées sous `/tmp/browser/djomy-e2e-v2/screenshots/`.
- État final DB (extrait SQL : payment + contribution + ledger).
- Confirmation explicite du verdict : ✅ paiement reflété dans le dashboard / 🔴 sinon, avec la cause exacte.
- Différentiel UX vs rapport précédent (M1/M2/M3 résolus ou non).

## Détails techniques

- Chromium headless, viewport 1280×1800, session pré-mintée via `LOVABLE_BROWSER_SUPABASE_SESSION_JSON` (1 session par utilisateur — relancer le script pour Alice).
- Aucun secret loggé en clair.
- Si l'edge fn renvoie encore 404 → on s'arrête, on documente, et on indique que le déploiement n'est pas effectif (le bouton Publish doit avoir été cliqué après la dernière édition des fonctions).
- Si la signature HMAC du webhook simulé est rejetée → on inspecte `_shared/djomy.ts` pour vérifier la convention (`clientId:signature`, sha256 sur le body brut) et on ajuste le payload de test.

## Hors-scope

- Paiement réel sur le portail Djomy sandbox (nécessite interaction humaine sur leur UI).
- Corrections de code (sauf si on découvre un bug bloquant — on les listera, sans patcher dans ce passage).