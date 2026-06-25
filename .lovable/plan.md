
## 1) Test d'intégration SMS avec provider simulé

Créer `supabase/functions/_shared/__tests__/send-tontine-sms.test.ts` (Deno test) qui :
- Mock `sendMessage` de `_shared/nimbasms.ts` (capture in‑memory : `to`, `body`, `logContext.kind`, `logContext.turnId`, `logContext.userId`, `logContext.groupId`).
- Mock le client Supabase (stub des tables `profiles`, `notification_preferences`, `turns`, `contributions`, `groups`, RPC `claim_sms_dedupe` avec set en mémoire).
- Scénarios couverts :
  1. `contribution_confirmed` envoyé 5× avec mêmes `contribution_id` → **1 seul** appel `sendMessage` ; le body contient le bon montant, n° de tour, nom bénéficiaire, échéance ; `logContext.turnId` + `logContext.userId` = payer ; `kind`=`contribution_confirmed`.
  2. Même event avec `contribution_id` différents → 2 appels distincts.
  3. `turn_paid` envoyé 3× même `turn_id` → 1 appel, recipient = `beneficiary_user_id`, body mentionne le montant crédité.
  4. Utilisateur opted‑out (preference `enabled=false`) → 0 appel, log `skipped/opted_out`.
- Lancé via `deno test` dans `.github/workflows/e2e.yml` (nouveau job `sms-unit`).

## 2) Nouveau SMS « bénéficiaire informé d'un paiement reçu »

Ajout d'un **2ᵉ SMS** dans la branche `contribution_confirmed` de `send-tontine-sms` :
- Destinataire = `turns.beneficiary_user_id` (≠ payeur).
- Contenu : *« Bonjour {prenom}, {payeurPrenom} a paye sa cotisation de {montant} GNF pour votre tour #{turnNo} de la tontine "{gname}". Votre prochaine cotisation est due le {nextDue}. Ref: {ref}. »*
- `nextDue` = plus proche `turns.due_date` où le bénéficiaire courant figure comme `contributions.payer_user_id` avec `status='pending'` (sinon "—" et phrase repliée).
- Enqueue côté DB : `enqueue_tontine_sms('beneficiary_payment_received', …)` ajouté dans le trigger `sms_contribution_paid` (migration), avec `dedupe_key = beneficiary_payment_received:{contribution_id}:{beneficiary_user_id}` → garantit 1 SMS par paiement, par bénéficiaire.
- Soumis aux mêmes gardes : opt‑in, rate‑limit global, FIFO outbox.
- Test ajouté dans le fichier de test (point 1) : vérifie destinataire = bénéficiaire, présence de `nextDue`, dédup sur `contribution_id`.

## 3) Bloquer « Payer maintenant » avant l'ouverture du tour

Règle métier : un membre ne peut payer que lorsque le tour est **ouvert à la collecte**, c.-à-d. `turn.status = 'collecting'` OU `turn.due_date <= aujourd'hui`. Si `status='upcoming'` et `due_date > today` → paiement interdit.

Front (`src/components/dashboard/DueCard.tsx` + `src/pages/MyContributions.tsx`) :
- Nouvelle prop `canPayNow: boolean` calculée en amont (déjà accès à `daysToDue` et `turnStatus`).
- Si `!canPayNow` : bouton remplacé par un état désactivé « Disponible le {due_date} », même style, `aria-disabled`, tooltip explicatif.
- Étiquette « Bientôt » conservée.

Back (sécurité) :
- Garde-fou dans `supabase/functions/djomy-init-payment/index.ts` : avant d'initier Djomy, charger `turns(status, due_date)` via `contribution_id` ; si `status='upcoming'` et `due_date > current_date` (UTC) → renvoyer `409 { error: "turn_not_open_yet", available_on: due_date }`.
- Mirroir SQL : ajouter une contrainte dans la RPC qui crée le `payment` (si elle existe ; sinon dans la fonction edge uniquement).

## Détails techniques

### Fichiers créés
- `supabase/functions/_shared/__tests__/send-tontine-sms.test.ts` (Deno).
- `supabase/migrations/<ts>_beneficiary_payment_sms.sql` : modif trigger + nouvel event dans le catalogue.

### Fichiers modifiés
- `supabase/functions/send-tontine-sms/index.ts` : nouvelle branche/section pour le 2ᵉ SMS bénéficiaire, calcul `nextDue` via `contributions` join `turns`.
- `supabase/functions/djomy-init-payment/index.ts` : pré‑check `turn_status`/`due_date`.
- `src/components/dashboard/DueCard.tsx` : prop `canPayNow`, état désactivé.
- `src/pages/MyContributions.tsx` + `src/pages/Dashboard.tsx` : passent `canPayNow` calculé depuis la requête (déjà charge `turn.status` et `due_date`).
- `.github/workflows/e2e.yml` : ajoute job `deno test`.

### Catalogue SMS mis à jour (`mem://features/doctrine-sms-paxefy`)
Ajout de l'event `beneficiary_payment_received` au catalogue fixe (6ᵉ event). Dédup obligatoire par `contribution_id + beneficiary_user_id`.

### Tests
- Deno unit : 4 cas (cf. point 1) + cas bénéficiaire.
- SQL existant `sms_outbox_dedupe.test.sql` : ajout d'un cas `beneficiary_payment_received`.
- Test manuel UX : ouvrir Dashboard avec un tour `upcoming` → bouton désactivé "Disponible le …".

### Impact volume SMS attendu
+1 SMS par contribution confirmée (vers le bénéficiaire). Pour un groupe de N membres : N-1 SMS bénéficiaire par tour. Reste compatible avec le rate‑limit global (`sms_max_per_minute_global`).
