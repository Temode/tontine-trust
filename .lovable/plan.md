# Implémentation P0 — Tontine Digital MVP

Périmètre validé : les 5 chantiers indispensables pour la démo soutenance.

## Ordre d'exécution

### 1. Édition du groupe avant démarrage
- Migration SQL `db/16_update_group_settings.sql` : RPC `update_group_settings(_group_id uuid, _payload jsonb)` réservée à l'organisateur, refusée si `status != 'forming'`. Champs éditables : name, description, contribution_amount, frequency, max_members, rotation_order_kind, late_penalty_percent, late_penalty_after_days, visibility.
- `src/lib/api/groups.ts` : fonction `updateGroupSettings(id, payload)`.
- Nouvelle page `src/pages/GroupSettings.tsx` (route `/groupes/:id/parametres`) — formulaire pré-rempli, bouton "Enregistrer", désactivé si cycle démarré.
- Lien "Modifier" dans `GroupDetail` visible pour organisateur uniquement.

### 2. Pénalités de retard
- Migration `db/17_late_penalties.sql` :
  - Ajout `penalty_amount numeric default 0` sur `contributions`.
  - Modif `record_mock_payment` : si `now() > turn.due_date + group.late_penalty_after_days`, calcule `penalty = amount * pct / 100`, total payé = `amount + penalty`, écrit ligne `ledger` type `penalty`.
- UI : badge "En retard +X GNF" dans `MyContributions` et `PaymentModal` montre le détail.

### 3. Commission 1 % sur versement
- Migration `db/18_payout_fee.sql` :
  - Modif `release_payout` : `fee = payout_amount * 0.01`, montant net bénéficiaire = `payout_amount - fee`, écrit ligne `ledger` type `fee`.
  - Champ `fee_amount` sur `receipts`.
- Vue reçu : ligne "Commission plateforme" affichée.

### 4. Calendrier visuel des tours
- Nouveau composant `src/components/group/TurnsTimeline.tsx` : timeline verticale avec date, bénéficiaire, statut coloré (upcoming/collecting/paid/skipped).
- Intégré dans `GroupDetail` en remplacement (ou complément) de la liste actuelle.
- Sous-composant `TurnDot` avec semantic tokens (primary/accent/muted).

### 5. Graphiques dashboard
- Nouveau composant `src/components/dashboard/DashboardCharts.tsx` utilisant Recharts (déjà installé via shadcn `chart.tsx`).
  - `AreaChart` : cotisations payées vs reçues sur 6 derniers mois.
  - `PieChart` : répartition statuts contributions (payées / en attente / en retard).
- Source : `listMyPaymentsHistory` + `listMyContributionsDue` (déjà exposés).
- Intégré dans `Dashboard.tsx` au-dessus des sections existantes.

## Notes
- Toutes les nouvelles migrations seront créées dans `db/` (à exécuter manuellement dans le SQL editor comme convenu).
- Respect strict des tokens design system (`bg-primary`, `text-foreground`, etc.) — pas de couleur hardcodée.
- Pas de régression sur le flux existant : on ajoute, on ne refactore pas.

Je lance l'implémentation dès passage en mode build.
