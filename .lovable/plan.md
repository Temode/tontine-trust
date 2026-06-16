
# Intégration Djomy — Paiements Mobile Money

Objectif : remplacer la simulation actuelle par de vraies initiations de paiement via Djomy (flux *redirection vers portail*), tout en gardant la traçabilité dans `payments` / `ledger_entries`. Couverture : cotisations membre→groupe, frais de service, versement bénéficiaire, liens partageables.

## 1. Secrets & environnement

Ajout via le secrets tool (Lovable Cloud) :
- `DJOMY_CLIENT_ID`
- `DJOMY_CLIENT_SECRET`
- `DJOMY_ENV` = `sandbox` ou `prod` (switch — sandbox par défaut)
- `DJOMY_WEBHOOK_SECRET` (= `DJOMY_CLIENT_SECRET` ; séparé pour pouvoir tourner indépendamment)

Base URL résolue dans les edge functions :
- sandbox : `https://sandbox-api.djomy.africa`
- prod : `https://api.djomy.africa`

## 2. Migration SQL (`db/46_djomy_payments.sql`)

- Étendre l'enum `public.payment_provider` avec `djomy` (on garde `orange_money` / `mtn_money` pour stats par opérateur final, mais provider initial = `djomy` + colonne `payment_method`).
- Ajouter à `public.payments` :
  - `djomy_transaction_id text` (id retourné par Djomy)
  - `djomy_link_reference text` (si flow par lien)
  - `payment_method text` (`OM` / `MOMO` / `CARD` …)
  - `redirect_url text`
  - `payer_phone text`
  - `metadata jsonb`
  - index unique sur `djomy_transaction_id`.
- Nouvelle table `public.payment_links` (liens partageables) : `id`, `group_id`, `contribution_id` nullable, `purpose` (`contribution` | `service_fee` | `payout_refund` | `custom`), `amount`, `usage_type`, `djomy_reference`, `djomy_url`, `status`, `created_by`, `created_at`, `expires_at`, `metadata`. RLS : membre du groupe peut lire, organisateurs peuvent créer.
- Nouvelle table `public.djomy_webhook_events` (idempotence) : `event_id uuid PK`, `event_type`, `transaction_id`, `signature_valid bool`, `payload jsonb`, `received_at`.
- Toutes les nouvelles tables : `GRANT` pour `authenticated` / `service_role` + RLS conforme à la convention du projet.
- Nouveaux RPC SECURITY DEFINER :
  - `start_djomy_payment(_contribution_id uuid, _method text, _payer_phone text)` → insère un `payments` en `initiated`, renvoie l'id.
  - `apply_djomy_webhook(_payment_id uuid, _new_status text, _provider_ref text, _paid_amount bigint, _payment_method text)` → met à jour `payments`, et si `succeeded` appelle la logique existante de contribution settlement / ledger.

## 3. Edge Functions Supabase

Toutes les fonctions partagent un helper `_shared/djomy.ts` (HMAC SHA-256 sur `clientId` → `X-API-KEY: clientId:signature`, fetch `POST /v1/auth` pour Bearer, cache token en mémoire jusqu'à expiration).

- `djomy-init-payment` (auth user) — entrée : `contributionId` (ou `purpose` + `amount` + `groupId`), `payerPhone`, `allowedPaymentMethods?`. Étapes :
  1. Vérifie via Supabase que l'utilisateur est bien le membre lié à la contribution.
  2. RPC `start_djomy_payment` pour créer la ligne `payments` (status `initiated`).
  3. Appelle `POST /v1/payments/gateway` avec `merchantPaymentReference = payments.id`, `returnUrl`, `cancelUrl`, `metadata`.
  4. Stocke `djomy_transaction_id` + `redirect_url`, renvoie `{ redirectUrl, paymentId }`.
- `djomy-create-link` (auth user, organisateur) — `POST /v1/links` ; persiste dans `payment_links`. Retourne URL + référence (à partager via SMS/WhatsApp). Champ `sendSms` exposé.
- `djomy-payment-status` (auth user) — `GET /v1/payments/{transactionId}/status`, met à jour `payments` si divergence.
- `djomy-webhook` (public, **pas** d'auth JWT — `verify_jwt = false` dans `supabase/config.toml`) :
  1. Lit body brut, recalcule HMAC SHA-256 avec `DJOMY_WEBHOOK_SECRET`, compare à `X-Webhook-Signature` (`v1:...`).
  2. Idempotence : insère dans `djomy_webhook_events` (PK = `eventId`) ; si conflit → 200 OK no-op.
  3. Retrouve `payments.id` via `metadata.merchantPaymentReference` ou `djomy_transaction_id`.
  4. RPC `apply_djomy_webhook` → met à jour status + déclenche settlement contribution + ledger si `payment.success`.
  5. Notifications via la chaîne existante (réutilise `notifications.ts` API).

## 4. Frontend

- `src/lib/api/djomy.ts` : wrappers `initDjomyPayment`, `createDjomyLink`, `getDjomyStatus` via `supabase.functions.invoke`.
- `PaymentModal` (`src/components/payment/PaymentModal.tsx`) :
  - Étape `choose` : conserve choix opérateur (OM/MOMO) + input téléphone (préselectionné depuis profil), et bouton "Payer maintenant".
  - À la confirmation, appelle `initDjomyPayment` → redirige (`window.location.href = redirectUrl`) vers le portail Djomy.
  - Nouvelle page `src/pages/PaymentReturn.tsx` (`/payment/return`) : lit `?transactionId&status`, affiche état (succès / échec / en attente), polle `getDjomyStatus` toutes les 3 s pendant 30 s tant que `pending`, puis renvoie vers le groupe.
  - Page `cancel` : `/payment/cancel` simple.
- Page `GroupSettings` (organisateur) : section "Lien de paiement" pour générer un lien partageable (cotisation, frais, custom), affichage QR + bouton copier + bouton "Envoyer par SMS" (`sendSms=true`).
- Bandeau "Mode sandbox" visible si `DJOMY_ENV=sandbox` (drapeau exposé via fonction edge `djomy-config`).

## 5. Cas non couverts dans cette itération

- Versement au bénéficiaire : Djomy n'expose pas d'API payout dans la doc fournie. On enregistre les payouts manuellement (existant : `payouts.ts`) avec preuve, en attendant l'API disbursement.
- `confirmOTP` (paiement direct sans redirection) : non implémenté puisque le choix utilisateur est *redirection portail*.

## 6. Tests

- Edge function `djomy-webhook` : test unitaire HMAC + idempotence + transition `pending` → `success` (vitest dans `tests/`).
- E2E Playwright `tests/e2e/djomy-payment.spec.ts` (sandbox) : mock l'init avec un fixture, vérifie redirection + retour `success` met bien à jour `DuesCard`.
- Le CI E2E existant gate déjà sur RLS / audit / notifications ; on ajoute les specs Djomy au même workflow.

## 7. Détails techniques sécurité

- `clientSecret` ne quitte jamais l'edge function (jamais exposé au client).
- `X-API-KEY` recalculé à chaque requête sortante (pas de cache de signature).
- Bearer token Djomy mis en cache en mémoire process (max 1h, rafraîchi à expiration / 401).
- Webhook public, mais : vérif signature obligatoire, idempotence par `eventId`, RPC `SECURITY DEFINER` avec `search_path = public` et validation stricte du `payment_id`.
- Numéro de téléphone validé (format international, regex `^00\d{8,15}$`) avant envoi à Djomy.
- `returnUrl` / `cancelUrl` forcés en HTTPS et préfixés par le domaine de l'app (jamais issus du client).

## 8. Livrables / ordre d'exécution

1. `db/46_djomy_payments.sql` (schéma + RPC + grants + RLS).
2. Secrets Djomy (action utilisateur via dialog secrets).
3. Edge functions : `_shared/djomy.ts`, `djomy-init-payment`, `djomy-create-link`, `djomy-payment-status`, `djomy-webhook` (+ `supabase/config.toml` pour `verify_jwt = false` sur webhook).
4. `src/lib/api/djomy.ts` + refonte `PaymentModal` + pages `PaymentReturn` / `PaymentCancel` + route dans `App.tsx`.
5. UI "Lien partageable" dans `GroupSettings`.
6. Tests vitest + spec Playwright + ajout au workflow CI.
7. Configuration de l'URL webhook côté Espace marchand Djomy : `https://<project>.functions.supabase.co/djomy-webhook` (action manuelle utilisateur — j'expliquerai où coller l'URL).
