## Objectif

Reporter l'intégration **Djomy** à la toute fin (en attendant les credentials API du PDG) et terminer **tout le reste** de l'application. Quand Djomy sera prêt, il ne restera qu'à brancher l'API de paiement réelle dans des points d'intégration déjà préparés ("payment adapter" mocké en attendant).

---

## Stratégie : Payment Adapter

Créer une **interface d'abstraction** `PaymentProvider` côté backend (edge function) et UI. Aujourd'hui : implémentation `MockProvider` (simulation + écriture en DB). Demain : on remplace par `DjomyProvider` sans toucher au reste du code.

```text
UI → useInitiatePayment() → edge function `initiate-payment`
                                    ├── MockProvider (now)
                                    └── DjomyProvider (later, drop-in)
                            → webhook `payment-webhook` → update contributions/turns
```

---

## Phases restantes (ordre d'exécution)

### Phase C — Cotisations & Ledger (cœur métier sans Djomy)
1. **Migration SQL `04_phase_c_ledger.sql`** :
   - Table `payments` (id, contribution_id, user_id, amount, operator, status, provider_ref, created_at)
   - Table `ledger_entries` (immutable, double entrée : débit/crédit, type, ref, hash chaîné)
   - RPC `record_mock_payment(contribution_id)` qui : crée payment `succeeded`, marque `contribution.status=paid`, écrit 2 lignes ledger, et si toutes contributions d'un turn = paid → `turn.status=collecting → paid` + crédit bénéficiaire
   - View `my_contributions_due` (cotisations à payer pour user courant)
2. **API layer** : `src/lib/api/payments.ts`, `contributions.ts`
3. **UI** :
   - Remplacer `PaymentModal` mock par un vrai flow connecté à `record_mock_payment`
   - Page **Mes cotisations** (liste due/payées, statut, reçu)
   - Dashboard : KPI "À payer cette semaine" depuis vraies données
   - GroupDetail tab "Rotation" : afficher progression cotisations par turn

### Phase D — Versement (payout) & Reçus
1. RPC `release_payout(turn_id)` (organisateur) : marque turn `paid`, écrit ledger payout, génère un **reçu** (table `receipts` avec n° séquentiel + hash)
2. UI organisateur : bouton "Verser au bénéficiaire" sur un turn en `collecting` complet
3. Composant `ReceiptCard` (téléchargeable plus tard en PDF)

### Phase E — Score de fiabilité
1. Vue `user_reliability_score` calculée depuis : ratio paiements à temps, retards moyens, défauts
2. RPC `recompute_reliability(user_id)` déclenchée après chaque paiement
3. Affichage : Profile + ReliabilityCard dashboard + badge sur membres dans GroupDetail

### Phase F — Notifications & Rappels (in-app d'abord)
1. Table `notifications` (user_id, type, payload, read_at)
2. Triggers : nouvelle cotisation due (J-3, J-1, J0), turn assigné, paiement reçu, demande d'adhésion
3. UI : centre de notifications dans TopBar (cloche + dropdown)
4. *(SMS reporté — décision provider plus tard, comme convenu)*

### Phase G — Conformité & Sécurité
1. **Audit log** table `audit_events` (qui a fait quoi, IP, user_agent)
2. Revue **RLS** sur toutes les tables sensibles (payments, ledger, receipts)
3. Page **Profile** : KYC light (nom complet, pièce d'identité optionnelle stockée dans storage privé)
4. Conditions d'utilisation + acceptation versionnée

### Phase H — Polish & Onboarding
1. Onboarding 3 écrans pour nouveau user (concept tontine, sécurité, premier groupe)
2. États vides illustrés sur toutes les pages
3. Mode hors-ligne basique (cache react-query + bannière)
4. Tests E2E Playwright sur parcours critiques

### Phase I — DJOMY (dernière étape, quand credentials reçus)
1. `add_secret` : `DJOMY_CLIENT_ID`, `DJOMY_CLIENT_SECRET`
2. Edge function `djomy-auth` (OAuth client credentials + cache token)
3. Edge function `initiate-payment` : remplace `MockProvider` par appel `create_payment_gateway` Djomy
4. Edge function `djomy-webhook` : reçoit confirmation → appelle même logique qu'aujourd'hui `record_mock_payment` (déjà testée) mais avec `provider_ref` réel
5. Feature flag `PAYMENT_PROVIDER=mock|djomy` pour bascule progressive
6. Tests sandbox avec vrais numéros Orange/MTN

---

## Ce qui change *minimum* quand Djomy arrive

Grâce à l'adapter, seulement **3 fichiers** :
- `supabase/functions/initiate-payment/index.ts` (swap provider)
- `supabase/functions/djomy-webhook/index.ts` (nouveau, branche logique existante)
- Secrets ajoutés

Tout le reste (UI, DB, ledger, scores, notifications) sera déjà en place et testé.

---

## Ordre de validation proposé

On commence par **Phase C (Cotisations & Ledger)** car c'est le cœur métier et ça débloque D, E, F. Tu valides après chaque phase, je passe à la suivante.

OK pour démarrer Phase C ?
