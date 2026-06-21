## Problème observé

Kankou paie via Djomy → revient avec la flèche du navigateur (donc sans passer par `/paiement/retour`) → l'app continue à lui demander de payer alors que Djomy a bien encaissé.

## Cause

1. La réconciliation active (appel à `djomy-payment-status`) n'existe que dans `PaymentTracker`, qui n'est monté **que** sur `/paiement/retour` et le Dashboard (via `InFlightPaymentsCard`). Aucun rattrapage sur `/cotisations`, `/dashboard/groupe/*`, etc.
2. La liste `["contributions","due"]` n'a **aucun abonnement Realtime** sur `payments` : même si le webhook met à jour la DB, l'UI ne se rafraîchit pas tant qu'on ne refocus pas la fenêtre / recharge.
3. Si le webhook signe avec une clé différente de `DJOMY_WEBHOOK_SECRET`, le handler répond `200 ignored: invalid_signature` et seule la réconciliation active peut rattraper le retard.

## Plan correctif (front uniquement, pas de migration DB)

### 1. Nouveau hook global `useDjomyPaymentReconciler`

Fichier : `src/hooks/useDjomyPaymentReconciler.ts`

Branché une seule fois dans `AppShell` pour couvrir toute l'app dès qu'un utilisateur est connecté.

- Au montage **et** sur les évènements `visibilitychange` (onglet redevient visible), `focus` et `online`, exécute une « passe de réconciliation » :
  - `SELECT id, djomy_transaction_id, initiated_at FROM payments WHERE user_id = me AND status IN ('initiated','pending') AND djomy_transaction_id IS NOT NULL AND initiated_at > now() - interval '2 hours'`.
  - Pour chacun (max 5 en parallèle, déduplication 10 s par `transactionId`), appelle `supabase.functions.invoke('djomy-payment-status', { transactionId })`. Cette edge function applique déjà `apply_djomy_webhook` si Djomy déclare `SUCCESS/FAILED/CANCELLED`.
- Abonnement Realtime unique : `postgres_changes UPDATE payments filter=user_id=eq.<me>` → à chaque évènement :
  - `queryClient.invalidateQueries` sur `contributions`, `payments`, `dashboard`, `turns`, `receipts`, `payments-history`.
  - Si la transition observée est `pending|initiated → succeeded`, déclenche un toast nominatif « ✓ Paiement confirmé, votre cotisation est à jour ».
- Cleanup propre du canal et des listeners (préfixe d'ID Realtime unique pour éviter toute collision si le hook re-monte).

### 2. Montage global dans `AppShell`

Fichier : `src/components/layout/AppShell.tsx`

Ajouter `useDjomyPaymentReconciler()` à côté des hooks déjà présents (`usePrimeCallChannel`, `useDocumentTitleFlash`). Aucune UI à ajouter ici.

### 3. UX dédiée sur `/cotisations`

Fichier : `src/pages/MyContributions.tsx`

- Forcer une passe de réconciliation au montage (la passe globale tourne déjà, mais on garantit un appel immédiat même si l'utilisateur arrive par deep-link).
- Ajouter dans le `TopBar` / header de la page un bouton secondaire **« Vérifier mes paiements »** qui :
  - relance la même passe de réconciliation,
  - affiche un spinner pendant ≤ 3 s puis un toast (« Aucun paiement en attente » ou « N paiement(s) mis à jour »).
- S'assurer que `InFlightPaymentsCard` est bien rendu en haut de la page (déjà importé) pour rendre visibles les paiements en cours, avec le `PaymentTracker` qui continuera son polling tant qu'on est sur la page.

### 4. Garde-fous

- La passe ne tourne que si `user.id` est connu.
- Aucun appel si aucun paiement en attente.
- Throttle : minimum 4 s entre deux passes pour éviter de marteler `djomy-payment-status` si l'utilisateur jongle entre onglets.
- Les erreurs réseau sont silencieuses (juste loggées) — la prochaine passe rattrapera.

## Hors périmètre

- Pas de modification de `djomy-webhook` ni de `djomy-payment-status`.
- Pas de migration DB : `apply_djomy_webhook` fait déjà passer la cotisation à `paid` lors du flip `succeeded`.
- Si l'analyse révèle que le webhook arrive avec `signature_valid=false`, c'est un sujet séparé (rotation du `DJOMY_WEBHOOK_SECRET`) ; la réconciliation active masque le problème en attendant.

## Fichiers touchés

- **Créé** : `src/hooks/useDjomyPaymentReconciler.ts`
- **Modifiés** : `src/components/layout/AppShell.tsx`, `src/pages/MyContributions.tsx`