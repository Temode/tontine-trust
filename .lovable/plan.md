# Plan P2 — Fonctionnalités de production (non bloquantes pour la démo, mais 100 % réelles)

Toutes les fonctionnalités ci-dessous sont **livrées en mode production** : vraies tables, vraies RPC sécurisées, vrais flux temps réel, vrais emails envoyés. Aucun placeholder.

Djomy (paiement réel) reste en P3, traité dans une passe dédiée.

## Décisions arrêtées

- **Emails** : Lovable Emails (infra intégrée, queue retry, DLQ, suppression bounces, unsubscribe one-click). Pas de Resend — solution native plus robuste pour un produit destiné au public.
- **Pondération avis dans score fiabilité** : 70 % comportement de paiement (existant) + 30 % moyenne des avis pairs. Permet à un membre ponctuel mais mal noté socialement de voir son score reflété, sans dénaturer le poids des actes de paiement.
- **Enchères** : modèle **prime à la hausse** (le membre qui veut passer plus tôt paie un bonus versé au pot commun, redistribué aux autres bénéficiaires). Plus aligné sur l'esprit tontine équitable que la baisse, et plus simple à auditer.
- **Ordre d'exécution** : préférences notifications → infra emails → swaps → enchères → avis.

## Périmètre

### P2.1 — Préférences de notification
- Table `notification_preferences (user_id, notif_type, channel, enabled)`, unique sur le triplet.
- Trigger de seed à la création du profil : tous canaux `in_app` activés, `email` activé sauf `chat_message`, `sms` désactivé (réservé Djomy/P3).
- RPC `update_notification_preferences(_payload jsonb)`.
- Helper SQL `should_notify(_user, _type, _channel) returns boolean` utilisé par tous les triggers/RPC d'envoi.
- Page `/parametres/notifications` (matrice type × canal, switches), lien depuis `Profile`.

### P2.2 — Infrastructure emails + templates transactionnels
- Setup infra email Lovable (queue pgmq, cron, DLQ, suppression, unsubscribe).
- Page app `/desabonnement` brandée (token validation).
- Templates React Email (charte bleu sarcelle / or) :
  - `invitation-groupe` (lien rejoindre)
  - `recu-cotisation` (montant, pénalité, hash, lien reçu)
  - `rappel-paiement` (J-3, J-1, J+1)
  - `versement-recu` (bénéficiaire reçoit la cagnotte)
  - `demande-adhesion-decision` (acceptée/refusée)
  - `cycle-demarre` (org lance le cycle)
- Câblage des triggers existants :
  - `record_mock_payment` → `recu-cotisation` (filtré par `should_notify`)
  - `release_payout` → `versement-recu`
  - Cron rappels P1 → `rappel-paiement`
  - Création invitation → `invitation-groupe`
  - `approve_member` / `reject_member` → `demande-adhesion-decision`
  - `start_cycle` → `cycle-demarre` (à tous les membres)

### P2.3 — Échange de tours entre membres
- Table `turn_swap_requests (id, group_id, from_turn_id, to_turn_id, from_user_id, to_user_id, status, reason, created_at, responded_at)`.
- RPC `request_turn_swap(_from_turn, _to_turn, _reason)` :
  - même groupe, tours `upcoming`, demandeur = bénéficiaire de `from_turn`.
  - respecte `swap_policy` (`none` refus, `with_consent` flux normal, `organizer_only` réservé org).
- RPC `respond_turn_swap(_request_id, _accept boolean)` :
  - si accepté → swap atomique `beneficiary_user_id` + `position`, log audit, notifs aux deux parties (in-app + email selon préférences).
- RPC `cancel_turn_swap(_request_id)`.
- UI onglet **Échanges** dans `GroupDetail` (entrantes/sortantes) + bouton "Proposer un échange" depuis la timeline de tours.

### P2.4 — Mode enchères réel
- Table `turn_bids (id, turn_id, bidder_user_id, amount, status, created_at)` avec contrainte `amount > 0`.
- RPC `place_bid(_turn_id, _amount)` :
  - groupe en `rotation_order='auction'`, tour `upcoming`, bidder membre actif, `_amount > max(current bids)`.
  - publie via Realtime sur le canal du tour.
- RPC `close_auction(_turn_id)` :
  - org-only, assigne `beneficiary_user_id` au plus haut bid, marque autres `lost`.
  - écrit ledger `auction_premium` (le bonus) + redistribution proportionnelle aux autres bénéficiaires futurs (ligne `auction_redistribution`).
  - log audit + notifs (gagnant, perdants).
- Ajustement `start_cycle` : si `auction`, laisse `beneficiary_user_id` null sur tous les tours.
- Composant `AuctionPanel` (liste bids temps réel via Realtime, formulaire enchérir, bouton clôturer org).

### P2.5 — Avis & commentaires post-cycle
- Table `member_reviews (id, group_id, cycle_id, reviewer_user_id, reviewed_user_id, rating 1-5, comment, created_at)` unique sur `(cycle_id, reviewer, reviewed)`.
- RPC `submit_review(_cycle_id, _reviewed_user, _rating, _comment)` : cycle `completed`, reviewer participant, pas d'auto-évaluation.
- Vue `member_review_summary (user_id, group_id, avg_rating, reviews_count)`.
- Refonte de la formule de fiabilité : `score = 0.7 * payment_score + 0.3 * (avg_rating * 20)`, recalcul nightly + à la soumission d'avis.
- UI section "Donner mon avis" sur `GroupDetail` quand cycle terminé + affichage `★ moyenne (n avis)` sur la fiche membre, à côté du badge fiabilité.

## Migrations

- `db/26_notification_preferences.sql`
- `db/27_turn_swaps.sql`
- `db/28_turn_bids_auction.sql`
- `db/29_member_reviews.sql`
- `db/30_reliability_score_v2.sql` (refonte formule)

## Edge functions & infra

- Setup Lovable Emails (infra + scaffold)
- 6 templates React Email
- Page `/desabonnement`
- Câblage des invocations `send-transactional-email` dans les RPC existantes (via `pg_net` depuis Postgres ou via wrappers côté front selon le déclencheur)

## Hors P2 (→ P3)

- Djomy réel (Orange/MTN Money) — passe dédiée avec credentials marchand.
- SMS — branché en même temps que Djomy.
- 2FA, KYC, Premium.

## Vérifications avant livraison

- Migrations exécutées dans l'ordre, sans erreur RLS/GRANT.
- Edge functions déployées, queue email tourne (vérif `email_send_log`).
- Email de test envoyé sur chaque template.
- Swap, enchère, avis testés bout-en-bout dans la preview.
- Audit log P1 capture les nouvelles actions (swap, bid, review).
