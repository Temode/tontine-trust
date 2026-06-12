## P2.4 — Enchères réelles + P2.5 — Avis post-cycle

Deux migrations, deux composants UI, intégration dans `GroupDetail`. Tout en production, sans placeholder.

---

### P2.4 — Mode enchères (prime à la hausse)

**Migration `db/28_turn_bids_auction.sql`**

- Table `turn_bids` :
  - `id uuid pk`, `turn_id uuid fk turns`, `bidder_user_id uuid fk profiles`
  - `amount numeric check (amount > 0)`, `status text check in ('active','won','lost','cancelled') default 'active'`
  - `created_at timestamptz default now()`
  - Index `(turn_id, amount desc)`, unique partiel `(turn_id, bidder_user_id) where status='active'` (un bid actif par membre par tour).
- GRANT `select, insert, update` à `authenticated`, `all` à `service_role`.
- RLS :
  - SELECT : membres actifs du groupe du tour.
  - INSERT/UPDATE : via RPC uniquement (policy `using (false)` côté direct, RPC en `security definer`).
- RPC `place_bid(_turn_id uuid, _amount numeric)` :
  - Vérifs : groupe `rotation_order='auction'`, tour `upcoming`, bidder membre actif non-suspendu, `_amount > coalesce(max(amount) filter active, 0)`, `_amount >= group.contribution_amount` (plancher = cotisation).
  - Upsert : si le bidder a déjà un bid actif, on l'update ; sinon insert.
  - Notif in-app aux autres enchérisseurs actifs (`type='auction_outbid'`, filtré `should_notify`).
  - Audit log `place_bid`.
- RPC `close_auction(_turn_id uuid)` :
  - Org-only, tour `upcoming`, au moins 1 bid actif.
  - Atomique : sélectionne le bid max → `beneficiary_user_id`, marque `won`, autres `lost`.
  - Ledger : ligne `auction_premium` (montant = bid - cotisation_de_base) attribuée au tour, puis répartition `auction_redistribution` proportionnelle au nombre de tours restants pour chaque autre membre (crédit appliqué lors de leur futur versement via fonction helper `pending_auction_credits(user, group)`).
  - Notifs : gagnant (`auction_won`), perdants (`auction_lost`).
  - Audit `close_auction` avec metadata `{winner, amount, premium}`.
- RPC `cancel_my_bid(_turn_id uuid)` : marque le bid actif du caller en `cancelled` tant que tour `upcoming`.
- Ajustement `start_cycle` : si `auction`, ne pré-assigne pas `beneficiary_user_id`, le laisse null sur tous les tours.
- Vue `turn_bids_view` : bids + nom du bidder, filtrée par RLS du groupe.

**Frontend**

- `src/lib/api/auctions.ts` : `listTurnBids`, `placeBid`, `closeAuction`, `cancelMyBid`, abonnement Realtime sur `turn_bids` filtré par `turn_id`.
- `src/components/group/AuctionPanel.tsx` :
  - Liste des tours `upcoming` du groupe en mode enchère.
  - Par tour : enchère courante (max), liste live des bids (nom + montant), formulaire « Enchérir » (input ≥ max+1 GNF, ≥ cotisation), bouton « Annuler mon enchère ».
  - Org : bouton « Clôturer l'enchère » (confirm dialog avec récap gagnant + prime + redistribution).
- Onglet **Enchères** dans `GroupDetail` (visible uniquement si `swap_policy`/`rotation_order='auction'`).
- `start_cycle` UI : si rotation auction, on autorise le démarrage sans bénéficiaires pré-assignés.

---

### P2.5 — Avis post-cycle + score v2

**Migration `db/29_member_reviews.sql`**

- Table `member_reviews` :
  - `id`, `group_id`, `cycle_id` (= `groups.id` du cycle terminé, ou nouveau `cycle_number int` si plusieurs cycles), `reviewer_user_id`, `reviewed_user_id`
  - `rating int check between 1 and 5`, `comment text`, `created_at`
  - Unique `(cycle_id, reviewer_user_id, reviewed_user_id)`
  - Check `reviewer <> reviewed`.
- GRANT `select, insert` à `authenticated`, `all` à `service_role`.
- RLS :
  - SELECT : membres du groupe.
  - INSERT : via RPC.
- RPC `submit_review(_group_id, _reviewed_user_id, _rating, _comment)` :
  - Vérif : groupe `status='completed'`, reviewer participant du cycle, reviewed participant, pas d'auto-avis, pas de doublon.
  - Insert + audit `submit_review`.
  - Trigger recalc fiabilité du `reviewed_user_id`.
- Vue `member_review_summary` : `(user_id, group_id, avg_rating, reviews_count)`.
- Vue `member_review_global` : `(user_id, avg_rating, reviews_count)` agrégée tous groupes.

**Migration `db/30_reliability_score_v2.sql`**

- Refonte `recompute_reliability(_user uuid)` :
  - `payment_score` = score actuel (basé sur on-time / late / défauts).
  - `social_score` = `coalesce(avg_rating, 0) * 20` (0 si aucun avis).
  - `score = round(0.7 * payment_score + 0.3 * social_score)` quand `reviews_count >= 1`, sinon `score = payment_score` (pas de pénalité tant qu'aucun avis).
  - Tier recalculé selon nouveaux seuils inchangés.
- Recalc automatique : trigger `after insert on member_reviews` → recompute du `reviewed_user_id`.
- Recompute global one-shot dans la migration pour tous les users existants.

**Frontend**

- `src/lib/api/reviews.ts` : `submitReview`, `listMyPendingReviews(groupId)`, `listGroupReviews(groupId)`, `getMemberReviewSummary(userId)`.
- `src/components/group/ReviewsPanel.tsx` :
  - Visible si `group.status='completed'`.
  - Section « Donner mon avis » : liste des autres membres, formulaire (étoiles 1-5 + commentaire optionnel), un avis par membre.
  - Section « Avis reçus dans ce groupe » : moyenne + liste anonymisée (note + commentaire, sans nom du reviewer).
- Onglet **Avis** dans `GroupDetail` (visible uniquement cycle terminé).
- `ReliabilityBadge` : ajoute `★ {avg_rating.toFixed(1)} ({n})` à côté du badge quand `reviews_count > 0`.
- `src/lib/api/reliability.ts` : étendre `DbReliability` avec `avg_rating`, `reviews_count` ; idem `DbGroupReliabilityRow`.

---

### Détails techniques

- Pas de modification du schéma `turns` : on réutilise `beneficiary_user_id` nullable.
- `pending_auction_credits` est appelée par `record_mock_payment` pour déduire la prime due par les bénéficiaires futurs (montant à payer = cotisation − crédit redistribué).
- Realtime : `supabase.channel('turn-bids-{turnId}')` avec filtre `turn_id=eq.{id}` ; `AuctionPanel` se réabonne par tour visible.
- Tests manuels après livraison : créer groupe rotation `auction` 3 membres, démarrer cycle, placer 2 bids, clôturer, vérifier ledger + notifs ; terminer cycle, soumettre 2 avis, vérifier que score = `0.7*pay + 0.3*social`.

### Migrations à exécuter (dans l'ordre)

1. `db/28_turn_bids_auction.sql`
2. `db/29_member_reviews.sql`
3. `db/30_reliability_score_v2.sql`

### Hors scope

- Notifs email des évènements enchères/avis : suivront avec P2.2 (infra email + domaine).
- Enchères inverses (à la baisse), enchères scellées : non retenues.
