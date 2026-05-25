## Phase E — Score de fiabilité

Migration D appliquée. Place à Phase E : calculer et afficher un score de fiabilité par utilisateur basé sur l'historique réel des cotisations.

### 1. Migration SQL — `db/06_phase_e_reliability.sql`

- **Table `user_reliability_scores`** (snapshot par user) :
  - `user_id` (PK), `score` (0–100), `tier` enum (`excellent`, `bon`, `moyen`, `risque`, `nouveau`)
  - Compteurs : `total_due`, `total_paid`, `total_on_time`, `total_late`, `avg_delay_days`, `cycles_completed`
  - `last_computed_at`
- **RPC `recompute_reliability(_user_id uuid default auth.uid())`** :
  - Agrège `contributions` confirmées vs attendues, calcule délai (`confirmed_at - turn.due_date`)
  - Formule : `score = round(85 * taux_paiement + 15 * taux_a_temps)` puis `-` pénalité pour retards moyens > 3 j (max −10)
  - Tier dérivé : `>=85 excellent`, `>=70 bon`, `>=50 moyen`, `>=1 risque`, `0 paiement nouveau`
  - Upsert dans `user_reliability_scores`
- **Trigger `after update on contributions when status -> confirmed`** → appelle `recompute_reliability(payer_user_id)` (asynchrone via NOTIFY n'est pas dispo simplement, on l'appelle direct, SECURITY DEFINER)
- **VIEW `group_reliability`** : pour chaque groupe → `avg_score`, liste membres avec leur score (lecture par membres du groupe)
- **VIEW `my_reliability`** : `select * from user_reliability_scores where user_id = auth.uid()` + détail des 5 derniers retards
- RLS : `user_reliability_scores` lecture par user lui-même OU membres d'un groupe partagé (helper `shares_group_with`) ; pas d'écriture directe

### 2. Couche API — `src/lib/api/reliability.ts`
- `getMyReliability()` → score + détails
- `getGroupReliability(groupId)` → liste membres + scores
- `recomputeMyReliability()` → RPC (bouton manuel "Recalculer" sur Profile)

### 3. UI

- **Composant `ReliabilityBadge`** (réutilisable) : pastille colorée par tier + score numérique
- **`ReliabilityCard`** (existant) : remplacer le mock par `getMyReliability()` + breakdown (cotisations payées / à temps / retard moyen)
- **Dashboard** : la `ReliabilityCard` affiche les vraies données
- **Profile** :
  - Bloc "Mon score de fiabilité" avec gauge + statistiques + bouton "Recalculer"
  - Historique des retards (5 dernières contributions hors délai)
- **GroupDetail — onglet Membres** : afficher `ReliabilityBadge` à droite de chaque membre (au lieu de l'icône Star statique)
- **JoinGroup / Directory** : afficher score moyen du groupe si > 0

### 4. Hors scope (phases suivantes)
- Notifications complètes (Phase F)
- Audit & KYC (Phase G)
- PDF reçus serveur, onboarding (Phase H)
- Djomy (Phase I)

### Action utilisateur après mes changements
Exécuter `db/06_phase_e_reliability.sql` dans le SQL Editor Supabase, puis confirmer pour enchaîner Phase F (notifications).
