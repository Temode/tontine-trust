## Objectif

1. Débloquer définitivement le webhook Djomy (P0 : `function digest(text, unknown) does not exist`) pour que les paiements passent de `pending` → `succeeded` et déclenchent reçus + ledger.
2. Régler le vrai problème UX remonté : **le bouton « Payer » n'est pas accessible** depuis mobile ni depuis le détail du groupe. La page `/cotisations` existe mais n'est reliée à rien sur mobile.

## Partie 1 — Fix P0 digest() (recommandée)

**Cause :** `pgcrypto` est installé dans le schéma `extensions` (standard Supabase). Les fonctions `append_ledger`, `compute_payout_hash` et l'audit log appellent `digest(...)` sans qualifier le schéma, et leur `search_path` ne contient pas `extensions` → l'appel échoue dès qu'un webhook tente d'écrire dans le ledger.

**Solution retenue (la plus sûre) :** schema-qualifier tous les appels en `extensions.digest(...)` plutôt que de toucher au search_path global. C'est non destructif, rétro-compatible, et ça blinde l'app contre toute future migration de schéma.

Migration unique qui `CREATE OR REPLACE FUNCTION` pour :
- `public.append_ledger(...)` (db/04) — remplacer `digest(...)` par `extensions.digest(...)`
- `public.compute_payout_hash(...)` (db/05) — idem
- `public.log_audit(...)` (db/25) — idem
- `public.apply_djomy_webhook(...)` (migration 20260616154444) — relire et corriger si elle appelle digest directement
- S'assurer que `pgcrypto` est bien dans `extensions` (`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions`)

**Alternative écartée :** ajouter `SET search_path = public, extensions` à chaque fonction. Marche aussi mais moins explicite et casse en cascade si une autre fonction `SECURITY DEFINER` oublie le set.

## Partie 2 — Rendre le bouton Payer accessible

Le problème reporté par l'utilisateur (« je ne vois pas de bouton de paiement ») vient de la nav :

- `BottomNav` (mobile, viewport actuel 712×489) liste seulement : Accueil, Groupes, Créer, Profil. **Aucun lien vers `/cotisations`.**
- `DesktopSidebar` a bien le lien « Mes cotisations » mais il est masqué sous `lg:`.
- Sur `GroupDetail`, aucun CTA direct « Payer ma cotisation » ne renvoie vers `/cotisations`.

### Changements front-end (présentation uniquement)

1. **`src/components/layout/BottomNav.tsx`** : remplacer l'item « Profil » par « Cotisations » (icône `Wallet`, route `/cotisations`) et déplacer Profil dans le TopBar / menu utilisateur (il y est déjà accessible via l'avatar). Résultat : 4 items = Accueil · Groupes · Créer · Cotisations.
2. **`src/pages/GroupDetail.tsx`** : ajouter un bouton primaire « Payer ma cotisation » dans l'en-tête du groupe quand le membre courant a au moins une cotisation due pour ce groupe. Le bouton ouvre directement `DjomyPaymentModal` avec la prochaine `contribution_due` du groupe (réutilise `listMyContributionsDue` filtrée par `group_id`). Si aucune cotisation due → bouton masqué.
3. **`src/pages/Dashboard.tsx`** : le `DuesCard` existe déjà ; vérifier qu'il propose un CTA « Payer » qui route vers `/cotisations` (si non, ajouter un lien discret).

Aucun changement de logique métier, aucune nouvelle table, aucun edge function modifié.

## Partie 3 — Validation

Après application :
1. Rejouer l'audit API ciblé Djomy (script déjà en place dans `/tmp/browser/audit/`) → init paiement → simulation webhook via la RPC `_audit_simulate_djomy_webhook` (à ajouter dans la même migration, restreinte aux emails `*.audit+*@tontine.test`, signe le payload avec un secret de test interne pour court-circuiter `DJOMY_WEBHOOK_SECRET`).
2. Vérifier en DB : `payments.status = 'succeeded'`, `receipts` rempli, `ledger_entries` créé avec hash non null.
3. Playwright mobile (viewport 712×489) : vérifier que l'item « Cotisations » apparaît dans la BottomNav et que le bouton « Payer » est visible sur GroupDetail quand une cotisation est due.

## Livrables

- 1 migration SQL (fix digest + helper d'audit webhook)
- 2 fichiers front modifiés : `BottomNav.tsx`, `GroupDetail.tsx`
- Capture avant/après mobile + log SQL d'un paiement passé en `succeeded`

## Question rapide avant de lancer

Confirmes-tu le remplacement de « Profil » par « Cotisations » dans la BottomNav (Profil reste accessible via l'avatar du TopBar) ? Sinon je peux passer la BottomNav à 5 items, mais c'est plus serré visuellement sur petit écran.
