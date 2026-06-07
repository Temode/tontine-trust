Objectif

Rendre tout crash React reproductible et corrigeable en 30 secondes : trace complète, route, utilisateur, composant fautif. Garantir qu'aucune route (Auth comprise) ne devient un écran blanc.

1. Journalisation centralisée des erreurs

Créer `src/lib/diagnostics/crashLogger.ts` exposant `logCrash({ source, error, info, extra })` qui imprime un bloc unique :

```text
[Tontine Crash] 2026-06-07T21:10:00Z
  source       : ErrorBoundary | window.error | unhandledrejection
  route        : /auth
  user         : <uid|anon>  roles: [participant]
  componentStack: ...
  error        : NotFoundError: Failed to execute 'insertBefore'...
  stack        : ...
  extra        : { lastFocusedTab: "signin", submitting: true }
```

Champs récoltés :
- `location.pathname + search`
- `user.id` et `roles` lus via un petit registre `setAuthSnapshot({ userId, roles })` mis à jour dans `useAuth.tsx` à chaque changement de session
- `navigator.userAgent`, `document.documentElement.lang`
- Compteur incrémental de crash dans la session (utile pour distinguer boucles)

Le logger garde aussi les 20 derniers crashs en mémoire (`window.__tontineCrashes`) pour copier/coller depuis la console.

2. Branchement sur toutes les sources d'erreurs

- `src/main.tsx` : `window.error` et `unhandledrejection` appellent `logCrash`.
- `src/components/ErrorBoundary.tsx` : `componentDidCatch` appelle `logCrash` avec `componentStack` (info.componentStack) et le `fallbackTitle` comme `extra.boundary`.
- React Query : ajouter `queryCache` et `mutationCache` global handlers dans `App.tsx` qui transmettent les échecs au logger.

3. Diagnostic ciblé `insertBefore` / Google Translate

- Ajouter dans `main.tsx` un `MutationObserver` léger qui détecte si `<html>` reçoit `class="translated-ltr"` ou `translated-rtl` (signature Google Translate) et logge `[Tontine Diag] translate-detected`.
- Dans `crashLogger`, si le message contient `insertBefore` ou `removeChild` + `not a child`, ajouter automatiquement `extra.likelyCause = "DOM externe (Google Translate / extension)"` et la liste des classes de `<html>`.
- Confirmer ainsi que le crash `<LoaderCircle>` observé sur `/auth` vient bien d'une mutation externe, pas d'un bug Tontine.
- Garder le durcissement déjà en place (`translate="no"`, balise `<meta name="google" content="notranslate">`, boutons spinner enveloppés dans `<span>`).

4. Couverture ErrorBoundary sur 100% des routes

Refactor `src/App.tsx` :

```text
ErrorBoundary global (app)
  └─ Routes
      ├─ ErrorBoundary route "/"      → Index
      ├─ ErrorBoundary route "/auth"  → Auth
      ├─ ProtectedRoute
      │   └─ AppShell (déjà ErrorBoundary autour de Outlet)
      └─ ErrorBoundary route "*"     → NotFound
```

- Créer `RouteBoundary` (wrapper court qui prend `name` + `children` et utilise `useLocation` pour `resetKey={pathname}`) afin que naviguer vers une autre route réinitialise l'erreur automatiquement.
- Le fallback affiche : titre, message court, bouton "Réessayer", bouton "Recharger la page", bouton "Copier le rapport" (copie le dernier crash formaté dans le presse-papier).
- Aucune route ne reste sans frontière.

5. Vérification

- Provoquer manuellement un throw dans `Auth` : l'écran affiche le fallback, la console contient le bloc `[Tontine Crash]` complet avec route `/auth` et user `anon`.
- Recharger `/groupes` avec une session expirée : pas d'écran blanc, log clair.
- Si Google Translate est activé, `[Tontine Diag] translate-detected` apparaît avant le crash.

Fichiers touchés
- nouveau : `src/lib/diagnostics/crashLogger.ts`
- nouveau : `src/components/RouteBoundary.tsx`
- modif : `src/main.tsx`, `src/App.tsx`, `src/components/ErrorBoundary.tsx`, `src/hooks/useAuth.tsx`

Aucun changement DB, aucun changement d'UX en mode nominal.