## Correction de mon diagnostic

Tu as raison — **chaque membre paie chaque tour, y compris le bénéficiaire**. Donc sur le tour 1 d'« Epargne » :
- Attendu : 3 contributions de 10 000 GNF (toi, Kankou, Rougui).
- Réel : 2 confirmées (toi + Kankou). **Rougui n'a effectivement pas payé** sa propre cotisation alors qu'elle est en plus la bénéficiaire.
- Le tour reste `collecting` car il manque sa contribution → aucun bouton "Payer" ne s'affiche pour elle car **aucun tour avec contribution attendue d'elle n'est ouvert dans son UI**. C'est un bug de visibilité côté membre.

Le solde du bénéficiaire (versement automatique + retrait à la demande) **n'existe pas encore** dans la base — il faut le créer.

---

## Plan en 4 volets (conforme à la Doctrine Design)

### 1. Backend — Solde bénéficiaire + auto‑clôture des tours

Migration `db/47_beneficiary_balance_and_auto_close.sql` :

- **Nouvelle table `beneficiary_balances`** (`user_id`, `group_id`, `available_amount`, `total_credited`, `total_withdrawn`) avec RLS : le propriétaire lit/écrit son propre solde, organisateurs du groupe lisent.
- **Nouvelle table `withdrawal_requests`** (`user_id`, `group_id`, `amount`, `method` OM/MOMO/Carte, `status` pending/processing/paid/failed, `djomy_payout_ref`) — RLS : membre crée/lit les siennes, organisateur lit celles du groupe.
- **Fonction `auto_close_turn_if_complete(turn_id)`** : si toutes les contributions attendues (tous membres `active`, **bénéficiaire inclus**) sont `confirmed` →
  - `turns.status = 'paid'`, `paid_at = now()`,
  - crédit du `beneficiary_balances.available_amount` (somme des cotisations − fee éventuel),
  - ouverture du tour suivant en `collecting`,
  - `audit_log` `turn_auto_closed` + `payout_credited` + notifications à tous.
- **Fonction `flag_overdue_contributions()`** appelée par cron : pour chaque tour `collecting` dont `due_date < today − grace`, marque chaque contribution attendue non payée comme `defaulted`, déclenche `member_default_reports`, notifie.
- **Trigger `AFTER UPDATE OF status ON contributions`** → appelle `auto_close_turn_if_complete`.
- **Backfill one‑shot** : exécute la fonction sur tous les tours `collecting` existants. (Tour 1 d'Epargne restera `collecting` car il manque Rougui — exactement le bon comportement.)
- **Vue `group_health_view`** : pour chaque groupe actif, expose tour courant, % payé, liste des défaillants → alimente Dashboard + alertes.

### 2. Frontend — Visibilité « tour courant » pour chaque membre (Doctrine)

Composant `CurrentTurnBanner` placé en haut de `GroupDetail` et résumé dans `Dashboard` :

- **Une seule action primaire** : si je dois payer ma cotisation du tour courant → bouton « Payer 10 000 GNF » (whitespace-nowrap, primary teal). Sinon → bouton secondaire ghost « Voir détails ».
- Affiche : N° du tour, bénéficiaire (nom + avatar), échéance (date relative), montant attendu, **liste des 3 membres avec statut payé/en attente/en retard** (avec icône et token sémantique, pas de badge ALL CAPS).
- Tabular-nums, formatGNF, gold accent uniquement pour les montants critiques.

Le bouton "Payer" s'affichera donc maintenant pour Rougui sur le tour 1 (sa propre cotisation manquante).

### 3. Frontend — Page d'audit du groupe `/groupes/:id/audit`

Conforme Doctrine : titre display bold, sous-titre muted, une seule action primaire « Forcer la réconciliation » (organisateur), reste en ghost.

- **Timeline verticale** (création → invitations → approbations → paiements → clôtures → payouts → retraits → alertes), filtres pills sobres.
- **Tableau « État des tours »** : tour, bénéficiaire, échéance, collecte (X/Y membres, X 000 / Y 000 GNF), statut. Tabular-nums partout.
- **Section anomalies** : tours `collecting` dont `due_date` dépassé, membres en retard, contributions `defaulted`.
- Skeletons (pas spinners).

### 4. Frontend — Page « Mon solde » et présence quotidienne

**Nouvelle page `/solde`** (entrée dans la nav) :
- Carte « Solde disponible » par groupe (display bold XL, tabular-nums, accent or sur le montant).
- Bouton primaire unique « Retirer » → ouvre `WithdrawDialog` (montant, méthode OM/MOMO/Carte, déclenche `djomy-init-payout` edge function existante ou nouvelle).
- Historique des retraits (table sobre).

**Dashboard** :
- Nouvelle carte `TodayTontineCard` au-dessus de la ligne de flottaison : pour chaque groupe actif → tour courant + ma situation (« à payer », « payé », « bénéficiaire »).
- Realtime sur `turns`, `contributions`, `beneficiary_balances` (extension de `useDjomyPaymentReconciler` + nouveau hook `useTontineRealtime`).

**Notifications** (`send-tontine-reminders` étendu) :
- J‑1, jour J, J+1, J+3 : rappels gradués au membre + alerte à l'organisateur.
- À chaque clôture de tour : annonce « Tour N terminé, X a été crédité de Y GNF, à Z de payer ».
- À chaque retrait : confirmation + reçu.

---

## Fichiers

**Créés** :
- `db/47_beneficiary_balance_and_auto_close.sql`
- `src/lib/api/balances.ts`, `src/lib/api/withdrawals.ts`, `src/lib/api/groupAudit.ts`
- `src/pages/MyBalance.tsx`, `src/pages/GroupAudit.tsx`
- `src/components/group/CurrentTurnBanner.tsx`
- `src/components/dashboard/TodayTontineCard.tsx`
- `src/components/balance/WithdrawDialog.tsx`
- `src/hooks/useTontineRealtime.ts`
- `supabase/functions/djomy-init-payout/index.ts` (si non existant)

**Modifiés** :
- `src/App.tsx` (routes `/solde`, `/groupes/:id/audit`)
- `src/pages/Dashboard.tsx`, `src/pages/GroupDetail.tsx`
- `src/components/layout/BottomNav.tsx` + `DesktopSidebar.tsx` (entrée Solde)
- `supabase/functions/send-tontine-reminders/index.ts`
- `src/hooks/useDjomyPaymentReconciler.ts`

---

## Conformité Doctrine vérifiée

- Couleurs : teal `#0D7377` primary, or `#E8AA14` uniquement sur montants critiques. Zéro hex hardcodé.
- Une seule action primaire visible par page (Payer / Retirer / Forcer réconciliation).
- Montants `tabular-nums` + `formatGNF`.
- Skeletons partout, jamais de spinner.
- Empty states avec icône + titre + description + 1 CTA.
- Responsive vérifié à 712×800.

---

## Résultat attendu

- Rougui ouvre l'app → bandeau « Tour 1 — tu dois payer 10 000 GNF » → elle paie.
- Dès sa contribution `confirmed`, le tour 1 se clôture seul, 30 000 GNF crédités sur son solde, tour 2 ouvert (bénéficiaire = toi).
- Toi sur le Dashboard tu vois en permanence l'état des 3 membres et le tour courant.
- Si quelqu'un est en retard, alerte + rappel automatique, défaut tracé dans l'audit.
- Chaque bénéficiaire retire son argent quand il veut depuis `/solde`.