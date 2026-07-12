## Objectif

Ajouter un **portefeuille utilisateur consolidé** (Disponible / Bloqué) et un **flux de retrait global** avec formulaire sécurisé, table dédiée, notifications, et backoffice admin — sans casser les retraits par groupe existants (cotisations, payout-holds, tests E2E).

## 1. Architecture données

### Nouvelle vue `public.user_wallet`
Agrège en lecture seule à partir des tables existantes (`beneficiary_balances`, ledger, retraits en cours) :
- `user_id`
- `available_amount` = Σ `beneficiary_balances.available_amount` (groupes actifs, hors pénalités payout-hold en cours) − Σ retraits globaux `pending`
- `locked_amount` = fonds Tontine Solo « Épargne Projet » non échus + retraits globaux `pending` (gel)
- `total_credited`, `total_withdrawn`

Exposée via **RPC `get_my_wallet()`** (SECURITY DEFINER, scoped `auth.uid()`).

### Nouvelle table `public.user_withdrawal_requests` (parallèle, n'affecte pas `withdrawal_requests` existante)
| colonne | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → auth.users | not null |
| amount | bigint | > 0 |
| payment_method | enum `withdrawal_channel` (`mobile_money_om`, `mobile_money_momo`, `card`, `bank_transfer`) | |
| payment_details | jsonb | schéma validé côté RPC selon method |
| status | enum `user_withdrawal_status` (`pending`, `completed`, `rejected`) | default `pending` |
| rejection_reason | text | |
| processed_by | uuid | admin qui clique « Marquer payé » |
| processed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Grants: `authenticated` (SELECT/INSERT own), `service_role` ALL. RLS: user voit ses lignes ; admins (`has_role(uid,'admin')`) voient tout et peuvent `UPDATE status`.

### Gel du solde (atomique)
- RPC **`request_user_withdrawal(_amount, _method, _details jsonb)`** :
  1. Validation JSON schema par method (double numéro identique déjà validé côté UI, re-vérifié serveur).
  2. Lock `SELECT ... FOR UPDATE` sur agrégat, vérifie `amount ≤ available`.
  3. INSERT ligne `pending` → le montant devient automatiquement « bloqué » (la vue déduit les `pending` de disponible).
  4. Retourne l'id.
- RPC **`admin_mark_withdrawal_paid(_id)`** :
  1. Vérifie `has_role(admin)`.
  2. Passe `completed` + insère `ledger_entries` de type `user_withdrawal` pour matérialiser la sortie définitive sur les `beneficiary_balances` sous-jacents (répartition FIFO par groupe le plus ancien crédité, documentée dans le code).
  3. Trigger notification.
- RPC **`admin_reject_withdrawal(_id, _reason)`** : passe `rejected`, libère le gel (rien à défaire, la vue exclut `pending|rejected` du blocage).

## 2. Interface utilisateur

### Page `Mon solde` (`src/pages/MyBalance.tsx`)
- **Bandeau portefeuille** en haut : « Solde disponible » (gros, or) + « Solde bloqué » (secondaire) via `get_my_wallet()`.
- Bouton **« Faire une demande de retrait »** → ouvre `GlobalWithdrawDialog`.
- Section historique : liste des `user_withdrawal_requests` avec badges (pending amber, completed green, rejected red).
- Le `WithdrawDialog` par-groupe existant reste accessible depuis chaque carte de groupe (inchangé).

### Nouveau `src/components/balance/GlobalWithdrawDialog.tsx`
Formulaire multi-étapes, validation Zod :
1. **Montant** : input numérique, live check `≤ available_amount`, boutons 25/50/100 %.
2. **Méthode** : radio-cards Orange Money / MTN MoMo / Carte / Virement bancaire.
3. **Détails conditionnels** :
   - **Mobile Money** : `phone` + `phone_confirm` (blocage si ≠), format Guinée `+224…`.
   - **Carte** : `cardholder_name`, `card_number` (masqué, Luhn), *pas de CVV/expiration stockés* (l'admin traite hors-plateforme).
   - **Virement bancaire** : `bank_name`, `bank_code`, `account_number_or_iban`, `account_holder`.
4. **Récapitulatif** + bouton « Valider la demande » → `request_user_withdrawal`.
Toast succès + invalidation `useQuery(['user-wallet'])` + `['user-withdrawals']`.

## 3. Notifications

### Edge function `notify-withdrawal-submitted` (déclenchée par trigger `AFTER INSERT` via `pg_net` ou appel direct après RPC)
- **User** : email `withdrawal-submitted` (template React Email) + SMS via `nimbasms.sendMessage` avec `smsTemplates.buildWithdrawalSubmittedSms`.
- **Admins** : liste dynamique = `profiles` joints `user_roles WHERE role='admin'` → email à chacun + SMS à `phone_number` si présent. Pas de hardcoding, pas de variable d'env.

### Edge function `notify-withdrawal-completed`
- Appelée dans `admin_mark_withdrawal_paid` (via `pg_net` async).
- **User** : email + SMS « retrait traité avec succès ».

Nouveaux templates : `withdrawal-submitted.tsx`, `withdrawal-completed.tsx`, `withdrawal-rejected.tsx` dans `_shared/transactional-email-templates/` + registry. SMS builders ajoutés à `_shared/smsTemplates.ts` avec `dedupeKey` = `withdrawal_submitted:<id>` etc.

## 4. Backoffice admin

### Nouvelle page `src/pages/admin/Withdrawals.tsx` + entrée sidebar « Gestion des retraits »
- Table dense (style tableur) triée par `created_at DESC`, filtre statut (Pending par défaut).
- Colonnes : Date, Utilisateur (nom + téléphone), Montant (GNF), Méthode (badge), **Détails de destination** (rendu conditionnel lisible : numéro MoMo, IBAN + banque, ou numéro carte + titulaire), Statut, Actions.
- Actions par ligne :
  - **« Marquer comme payé »** → confirm dialog → `admin_mark_withdrawal_paid` → la ligne quitte l'onglet Pending (visible dans onglet « Traitées »).
  - **« Rejeter »** → dialog avec motif obligatoire → `admin_reject_withdrawal`.
- Onglets : `En attente` / `Traitées` / `Rejetées` / `Toutes`.
- Export CSV.
- Protection route via `RoleGuard allowedRoles={['admin','super_admin']}`.

## 5. Découpage technique (ordre d'implémentation)

1. **Migration SQL** : enums, table `user_withdrawal_requests`, vue `user_wallet`, RPCs (`get_my_wallet`, `request_user_withdrawal`, `admin_mark_withdrawal_paid`, `admin_reject_withdrawal`), RLS, GRANTs, trigger notif.
2. **Edge functions** : `notify-withdrawal-submitted`, `notify-withdrawal-completed` + templates email + templates SMS + registry.
3. **API client** : `src/lib/api/wallet.ts` (nouveau) — types + wrappers RPC.
4. **UI utilisateur** : `GlobalWithdrawDialog.tsx` + refonte bandeau `MyBalance.tsx` + section historique.
5. **UI admin** : `pages/admin/Withdrawals.tsx` + route + entrée `AdminSidebar`.
6. **Tests** : SQL tests (idempotence gel, rejet, ledger cohérent), unitaires templates SMS, E2E Playwright happy-path (demande → admin paie → user reçoit notif fictive).

## Points de vigilance

- La vue `user_wallet` doit rester cohérente avec `beneficiary_balances` : tests d'invariant `Σ balances − Σ withdrawals.completed = wallet.total_credited − wallet.total_withdrawn`.
- La répartition FIFO sur les `beneficiary_balances` lors du `completed` doit être atomique (transaction unique) sinon un crash laisse le solde global juste mais les sous-comptes incohérents.
- Ne pas exposer `service_role`. Les edge functions notif utilisent l'auth admin JWT du webhook trigger.
- Aucun stockage de CVV / date d'expiration carte — précisé dans le formulaire côté UX (« L'admin vous contactera si besoin »).
- L'ancien `WithdrawDialog` par-groupe et son RPC `request_withdrawal` restent en place ; on n'y touche pas (tests E2E `payout-hold`, `deposits`, `solo` verts).

Feu vert pour lancer l'implémentation dans cet ordre ?
