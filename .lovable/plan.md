# Diagnostic et plan de correctifs

J'ai investigué les 3 problèmes. Voici la cause racine de chacun et la correction proposée. Tout passe par **une seule migration SQL** + un petit ajustement front pour remonter le vrai message d'erreur de `start_cycle`.

---

## 1. Bob rejoint sans validation d'Alice

**Cause** — Dans `join_group_with_code`, la règle actuelle est inversée :

```text
visibility = 'private'  →  status = 'active'   (auto-accepté)
visibility = 'public'   →  status = 'pending'  (validation requise)
```

Or le groupe d'Alice est `private`, donc Bob est activé immédiatement. C'est l'inverse du comportement attendu : **rejoindre via code doit toujours passer par une validation de l'organisateur**, sauf si le groupe est explicitement marqué « ouvert ».

**Correctif** — Réécrire le bloc de décision : par défaut, toute adhésion via code arrive en `pending`. L'organisateur valide ensuite via le panneau « Candidatures en attente » déjà présent dans `GroupDetail.tsx` (qui appelle `approve_member` / `reject_member`).

---

## 2. `start_cycle` → 400 Bad Request

**Cause probable** — Le message d'erreur est masqué côté front (`message: [object Object]`). En testant la fonction, la logique passe les gardes (Alice est bien `organisateur`, groupe `open`, 2 membres actifs). Le 400 vient soit de `log_audit` (trigger d'instrumentation), soit du cast d'enum sur `notifications`. Sans le vrai message, impossible d'être catégorique.

**Correctif en 2 temps** :

a. **Front** — Dans `src/lib/diagnostics/crashLogger.ts` et le `onError` de `startCycleM` (`GroupDetail.tsx`), sérialiser correctement l'erreur Supabase (`error.message`, `error.details`, `error.hint`, `error.code`) au lieu de la stringifier brutalement en `[object Object]`. On verra enfin le vrai code Postgres.

b. **SQL** — Durcir `start_cycle` : envelopper `log_audit` dans un `BEGIN … EXCEPTION WHEN OTHERS THEN NULL` pour qu'un échec d'audit n'avorte pas le démarrage du cycle, et garantir que `v_freq_days` n'est jamais NULL (raise explicit si la fréquence est inconnue).

Une fois (a) déployé, on aura le message exact si (b) ne suffit pas — on itère.

---

## 3. Back-office « Utilisateurs » vide

**Cause confirmée** — La vue `admin_user_overview` est déclarée avec `security_invoker=on` et fait un `JOIN auth.users`. Or le rôle `authenticated` n'a **pas** le privilège `SELECT` sur `auth.users` (vérifié : `has_table_privilege = false`). Résultat : même pour un super_admin, la vue renvoie une erreur ou un set vide. Les 5 profils existent bien dans la base.

**Correctif** — Recréer la vue en `security_invoker=off` (elle s'exécute alors avec les droits du propriétaire, qui voit `auth.users`), et ajouter une garde interne `WHERE public.has_role(auth.uid(), 'super_admin')` pour qu'aucun autre rôle ne puisse l'utiliser. Idem pour `admin_group_overview`, `admin_payment_overview`, `admin_platform_kpis` qui ont le même schéma et probablement le même bug latent.

---

## Détails techniques (migration unique)

```text
1. CREATE OR REPLACE FUNCTION public.join_group_with_code(...)
   → toujours v_target_status = 'pending' (sauf si invitation auto-approve future)
   → v_target_position = NULL

2. CREATE OR REPLACE FUNCTION public.start_cycle(uuid)
   → wrap log_audit dans BEGIN/EXCEPTION
   → RAISE EXCEPTION 'INVALID_FREQUENCY' si v_freq_days IS NULL

3. DROP VIEW + CREATE VIEW admin_user_overview / admin_group_overview /
   admin_payment_overview / admin_platform_kpis
   → sans security_invoker (= security definer par défaut)
   → ajouter WHERE has_role(auth.uid(),'super_admin') dans chaque vue
   → GRANT SELECT ... TO authenticated
```

## Fichiers front modifiés

- `src/lib/diagnostics/crashLogger.ts` — sérialisation propre des erreurs Supabase (message + details + hint + code).
- `src/pages/GroupDetail.tsx` — `onError` de `startCycleM` affiche `error.details ?? error.message`.

## Critères de validation

- Bob saisit le code d'Alice → apparaît dans « Candidatures en attente » d'Alice, **pas** dans les membres actifs.
- Alice approuve → Bob devient actif, position assignée.
- Alice clique « Démarrer le cycle » → soit ça réussit, soit le toast affiche le vrai message Postgres (plus jamais `[object Object]`).
- `/admin/utilisateurs` liste les 5 profils existants avec email, rôles, nb de groupes.
- Un utilisateur non-admin appelant les vues admin via l'API obtient 0 ligne (garde interne).
