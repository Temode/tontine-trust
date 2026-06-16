## Contexte

- Cloud backend neuf : 16 migrations rejouées (init → 16). Tables clés OK (`groups`, `payments`, `contributions`, `ledger_entries`, `user_roles`…), **mais pas encore** `djomy_webhook_events` ni les RPC `start_djomy_payment` / `apply_djomy_webhook`.
- Secrets Djomy déjà présents côté Cloud : `DJOMY_CLIENT_ID`, `DJOMY_CLIENT_SECRET`, `DJOMY_ENV`, `DJOMY_WEBHOOK_SECRET`. ✅
- Edge functions présentes dans le code (`djomy-init-payment`, `djomy-payment-status`, `djomy-webhook`, `delete-account`) mais pas encore déployées sur ce nouveau backend.

## Plan

### Étape 1 — Rejouer les migrations restantes (`db/17` → `db/46`)

Application séquentielle via `supabase--migration`, en respectant les préludes d'enum (`32a`, `35a`, `40a` exécutés AVANT leur migration principale). Ordre :

```
17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31
→ 32a → 32 → 33 → 34 → 35a → 35 → 36 → 37 → 38 → 39 → 40a → 40 → 41 → 42 → 43 → 44 → 45 → 46
```

Regroupement en ~5 batches pour limiter les approvals. Si une migration échoue, on s'arrête, on diagnostique (souvent : dépendance manquante ou enum non préludé), on corrige, on reprend.

Vérifications à la fin :
- `supabase--read_query` : présence de `djomy_webhook_events`, `start_djomy_payment`, `attach_djomy_reference`, `apply_djomy_webhook`, colonnes `payments.djomy_transaction_id` / `payments.redirect_url`.
- `supabase--linter` pour repérer toute table sans RLS / GRANT manquant.

### Étape 2 — Déployer les edge functions Djomy

- `supabase--deploy_edge_functions` avec `["djomy-init-payment","djomy-payment-status","djomy-webhook","delete-account"]`.
- Smoke test `supabase--curl_edge_functions` sur `/djomy-init-payment` (sans auth → 401 attendu, pas 404) pour confirmer que le routage marche.

### Étape 3 — Préparer les comptes de test

Via `supabase--insert` / RPC :
- Créer `bob@test.local` et `alice@test.local` (signup côté script ou seed direct).
- Alice crée le groupe "Famille Alice" (500 000 XOF mensuel, 4 places) via `create_group_with_invitation`.
- Bob rejoint via le code.
- Démarrer le cycle (rotation programmée) pour qu'une cotisation Bob → tour Alice soit due.

### Étape 4 — Relancer le test E2E Djomy (Playwright)

Réutilise `/tmp/browser/djomy-e2e-v2/pay.py` (script du dernier plan), avec session pré-mintée via `LOVABLE_BROWSER_SUPABASE_SESSION_JSON` :

1. Bob login → `/cotisations` → "Payer via Djomy" → modale OM `620000002` → "Continuer".
2. Capture réseau : `POST /djomy-init-payment` doit renvoyer 200 + `redirectUrl`, `transactionId`, `paymentId`.
3. Screenshot de la redirection vers `sandbox-api.djomy.africa` (sans finaliser).
4. Vérif DB : `payments` row `provider='djomy'`, `status in ('initiated','pending')`, `djomy_transaction_id not null`.
5. Simuler le webhook succès : `POST /djomy-webhook` avec payload signé HMAC SHA-256 (clé = `DJOMY_WEBHOOK_SECRET`, header `X-Djomy-Signature` selon `_shared/djomy.ts`), status `SUCCESS`. Rejouer 2× → idempotent.
6. Vérif post-webhook : `payments.status='succeeded'`, `contributions.status='confirmed'`, 1 `ledger_entries` (`kind='contribution_in'`, 500 000), notification générée.
7. Bob `/dashboard` rechargé → KPI "À payer" mis à jour, échéance disparue/marquée payée. Alice `/dashboard` → tour visible avec cotisation reçue.

### Étape 5 — Livrable final

- Tableau récap étape / statut / capture / requête réseau.
- Captures `/tmp/browser/djomy-e2e-v2/screenshots/*`.
- Extrait SQL final (payment + contribution + ledger).
- Verdict explicite ✅/🔴 avec cause si échec.

## Hors-scope

- Paiement réel sur le portail Djomy sandbox (interaction humaine requise).
- Corrections de code applicatif — on documente sans patcher dans ce passage, sauf bug bloquant le flux (à valider avec toi avant patch).

## Question avant exécution

Confirme simplement "**go**" et j'enchaîne : batches de migrations 17→46, déploiement des 4 edge functions, puis test E2E complet d'une traite.
