
# Roadmap — Tontine Digitale v2

Objectif : livrer par incréments testables, sans casser l'existant (auth OTP, groupes, Djomy, back-office). Chaque milestone est indépendante, déployable, testée E2E avant la suivante.

## Vue d'ensemble

```text
M1 Fondations DB (plans, quotas, SMS)   ── prérequis de tout le reste
      │
M2 Back-office admin plans & SMS pricing
      │
M3 Souscription utilisateur + paiement Djomy + enforcement quotas
      │
M4 Notifications : routage E-mail/In-App/SMS selon plan + décrément forfait
      │
M5 Recharge SMS depuis un groupe (commande → paiement → crédit)
      │
M6 Tontine Solo (Épargne Projet vs Fonds de roulement)
      │
M7 Tontine Internationale (annuaire public, anonymisation, validation cycle)
      │
M8 Tontine Business (coordinateur + commission + affiliation)
```

---

## M1 — Fondations base de données

Une seule migration pour poser toutes les tables/enums utilisés par les modules suivants. Rien côté UI.

Nouveau schéma :
- `subscription_plans` (code: free|premium|business, base_price, config JSONB des paliers Premium, sms_included, limits JSONB, editable en admin)
- `subscription_plan_history` (audit des changements de prix/limites)
- `user_subscriptions` (user_id, plan_code, tier_options JSONB choisis, price_monthly, status, current_period_end, djomy_ref)
- `sms_pricing` (unit_price, packs JSONB [{qty, price}], effective_from)
- `sms_wallets` (user_id, balance_remaining, total_purchased, total_consumed)
- `sms_orders` (user_id, group_id, pack_id, qty, amount, status, djomy_ref, admin_note)
- `sms_ledger` (wallet_id, delta, reason: purchase|consumption|admin_adjust, ref_id)
- Extension `groups` : `kind` enum `collective|solo|business`, `solo_mode` enum `project|working_capital`, `solo_lock_until`, `is_public` bool, `coordinator_commission_percent`, `coordinator_user_id`
- Extension `cycles` : `awaiting_renewal` bool + table `cycle_renewal_votes` (cycle_id, user_id, agreed, voted_at)
- `referrals` (referrer_id, referred_id, plan_code, commission_percent, status)
- `referral_earnings` (referrer_id, subscription_id, period, amount, paid)

Grants + RLS + policies pour chaque table (voir doctrine `public.` GRANT).

Livrable : migration validée, `types.ts` régénéré, aucune régression (les tables `groups`/`profiles` gardent leurs colonnes existantes).

---

## M2 — Back-office : plans & tarification SMS

Pages admin (super_admin uniquement) :
- `/admin/subscriptions` : édition des 3 plans (prix de base, limites, paliers Premium, forfait SMS inclus). Historique versionné.
- `/admin/sms-pricing` : tarif unitaire + packs, activation d'un nouveau tarif = nouvelle ligne `effective_from`.
- `/admin/sms-orders` : liste des demandes d'achat SMS, filtres par statut, action « marquer traité ».

RPC sécurisées (`security definer`, check `has_role(super_admin)`) pour update.

Livrable : admin peut configurer sans toucher au code.

---

## M3 — Souscription utilisateur + enforcement

Frontend :
- Page `/abonnement` avec 3 cartes (Free / Premium modulable / Business).
- Premium : sliders (nb groupes 2-8, nb membres jusqu'à 20, Solo 0/1, Internationaux 0-6) → prix calculé côté client + revalidé côté serveur.
- Paiement via Djomy (init-payment existant), webhook → activation `user_subscriptions`.

Enforcement (guards) :
- Hook `useEntitlements()` centralisé.
- Blocage création groupe si quota dépassé (client + RLS/trigger côté DB).
- Blocage ajout membre au-delà de la limite du plan de l'organisateur.
- Blocage Tontine Solo / Internationale selon plan.

Tests E2E : Free bloqué au 3e groupe ; Premium avec 8 groupes OK ; downgrade → mode lecture seule.

---

## M4 — Routage des notifications selon plan

Refactor du dispatcher notifications :
- Nouvelle fonction `dispatch_notification(user_id, event, payload)` qui :
  1. Lit le plan de l'utilisateur.
  2. Envoie systématiquement In-App + Email.
  3. Si plan payant ET wallet SMS > 0 ET événement éligible (rappel paiement, alertes critiques) → enqueue SMS via `sms_outbox` existant + décrément atomique du wallet + entrée `sms_ledger`.
  4. Si wallet à 0 → notification In-App « forfait SMS épuisé, rechargez ».

Respect doctrine SMS (catalogue figé, outbox, jamais de `net.http_post` dans un trigger).

Tests : compteur wallet cohérent, pas de double envoi, Free jamais de SMS.

---

## M5 — Recharge SMS depuis un groupe

- Bouton « Recharger SMS » dans l'écran groupe (visible plans payants).
- Dialog : sélection pack (issu de `sms_pricing`), paiement Djomy, webhook → `sms_orders.status=paid` + crédit `sms_wallets` + entrée ledger.
- Notification admin (in-app + email) à chaque commande.
- Historique accessible depuis profil utilisateur.

---

## M6 — Tontine Solo

- Extension du flow `CreateGroup` : nouveau choix « Type » (Collective / Solo). Si Solo :
  - Radio Épargne Projet (date échéance obligatoire, `solo_lock_until`) vs Fonds de roulement.
- Backend : trigger empêche retrait avant `solo_lock_until` en mode projet.
- UI dédiée : `/solo` liste des tontines solo, progression vers l'objectif.
- Adaptation payout : bénéficiaire = organisateur unique, pas de rotation.

---

## M7 — Tontine Internationale

- Colonne `is_public` sur `groups` (déjà `visibility='public-link'|'directory'` existant → réutiliser + nouveau flag « catalogue international »).
- Page `/international` dans sidebar, vue anonymisée (membres → « Membre A/B/… », scores agrégés).
- Candidature → notification organisateur → accept/reject via flow existant `join_requests`.
- Fin de cycle : nouveau flag `awaiting_renewal`, écran « Participer au prochain cycle ? Oui/Non », RPC `vote_cycle_renewal`, l'organisateur ne peut relancer que sur les membres ayant voté Oui.

---

## M8 — Tontine Business

Prérequis : plan Business actif.
- Création de groupe avec case « Je coordonne sans cotiser » → `coordinator_user_id` + `coordinator_commission_percent`.
- Adaptation `distribute_payout` : prélève commission avant versement bénéficiaire → ligne `ledger_entries` type `coordinator_fee`.
- Page « Mes commissions » pour le coordinateur.
- Affiliation :
  - Lien unique `?ref=<code>` sur la page marketing.
  - Signup capture le referrer → table `referrals`.
  - À chaque paiement d'abonnement du filleul → job crée `referral_earnings`.
  - Page « Mon programme d'affiliation » (parrains, revenus, payouts).

---

## Détails techniques transverses

- **Tests** : chaque milestone ajoute un fichier `tests/e2e/*.spec.ts` + tests Deno sur les nouvelles edge functions.
- **Sécurité** : toutes les nouvelles tables ont RLS + GRANT explicites ; les prix/limites ne sont modifiables que via RPC `security definer` avec `has_role(super_admin)`.
- **Paiements** : réutilise Djomy existant, pas de nouveau provider.
- **Compat legacy** : les groupes existants sont `kind='collective'` par défaut, aucun downgrade forcé.
- **Rollback** : chaque migration a son inverse dans un commentaire ; feature flags via `internal_config` pour activer/désactiver progressivement en prod.

---

## Validation demandée

Confirme-moi :
1. L'ordre des milestones te convient (ou tu veux prioriser Solo / International avant les abonnements ?).
2. Le périmètre de M1 (une seule grosse migration) est OK, ou tu préfères une migration par milestone.
3. On démarre M1 dès validation.
