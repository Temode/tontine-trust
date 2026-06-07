## Audit final — pourquoi l'app devient blanche

### Cause racine identifiée (grâce à votre console)
```
[vite] Internal Server Error
Failed to resolve import "qrcode" from "src/components/invite/ShareSheet.tsx"
```

- `qrcode` **est déclaré dans `package.json`** et installé dans la sandbox Lovable, mais **n'est pas installé sur votre machine locale** (`C:\Users\HP\…`, `localhost:8080`). Vous avez probablement `git pull` sans relancer `npm install` (ou `bun install`) après l'ajout de la dépendance lors du flux d'invitations.
- Quand Vite échoue à résoudre un import, il renvoie **HTTP 500 sur tout le module graph**. React ne peut plus monter → page blanche totale. C'est exactement ce que vous voyez sur `/groupes` et au retour d'onglet (HMR retente, échoue à nouveau).

### Action immédiate côté utilisateur
Dans le terminal du projet local :
```bash
npm install        # ou: bun install
```
puis redémarrer `npm run dev`. La page reviendra instantanément.

---

## Audit de robustesse (pour que ça ne ternisse plus jamais Tontine Digital)

Même une fois `qrcode` installé, l'app reste **fragile** : un seul import cassé ou une seule exception au rendu efface tout. Les correctifs suivants garantissent qu'**on ne reverra plus jamais une page 100% blanche**.

### 1. ErrorBoundary global + boundary par route
- Envelopper `<Routes>` dans `App.tsx` avec un `ErrorBoundary` qui propose **Recharger l'application**.
- Envelopper l'`<Outlet />` dans `AppShell` avec un second boundary : la **sidebar et la nav restent visibles** même si la page courante crashe, et l'utilisateur peut naviguer ailleurs.
- Améliorer `ErrorBoundary.tsx` : bouton "Recharger la page" + reset automatique au changement de `location.pathname`.

### 2. Lazy-load des écrans + Suspense
- Convertir les imports de pages en `lazy(() => import(...))` dans `App.tsx` avec un `<Suspense fallback={spinner}>`.
- **Bénéfice clé** : un import cassé dans `ShareSheet` (ou n'importe quel sous-composant) n'affectera que la route qui l'utilise (`/inviter`), pas le dashboard ni `/groupes`.

### 3. QueryClient durci
```ts
new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // stop la tempête de refetch au retour d'onglet
      retry: 1,
      staleTime: 30_000,
    },
    mutations: { retry: 0 },
  },
})
```
Garder `refetchOnWindowFocus: true` uniquement sur la cloche de notifications.

### 4. AuthProvider robuste
- Flag `mounted` pour éviter `setState` après démontage.
- `setLoading(false)` aussi sur le premier `onAuthStateChange` (pas seulement `getSession`).
- Re-fetch `user_roles` uniquement si `user.id` change (évite spam au `TOKEN_REFRESHED` qui survient au retour d'onglet).

### 5. Hygiène realtime
- `supabase.removeChannel(channel)` au cleanup de `useNotificationsRealtime` (plus fiable que `unsubscribe()` seul).

### 6. Observabilité
- Dans `main.tsx`, brancher `window.addEventListener("error", ...)` et `"unhandledrejection"` → `console.error("[GlobalError]", ...)`.
- `ErrorBoundary.componentDidCatch` logge déjà ; ajouter la stack complète.

### 7. Filets de sécurité MyGroups
- `try/catch` autour de `computePortfolio` (fallback zéros).
- Afficher un encart d'erreur si `useQuery({ queryKey: ["groups","mine"] })` est en `isError` (au lieu d'un "Chargement…" infini).

---

## Fichiers touchés
- `src/App.tsx` — QueryClient configuré, ErrorBoundary global, lazy() + Suspense
- `src/components/layout/AppShell.tsx` — ErrorBoundary autour de l'Outlet
- `src/components/ErrorBoundary.tsx` — bouton recharger + reset sur changement de route
- `src/hooks/useAuth.tsx` — mounted flag, loading sur auth event, refetch roles conditionnel
- `src/hooks/useNotifications.ts` — cleanup via removeChannel
- `src/main.tsx` — handlers globaux error / unhandledrejection
- `src/pages/MyGroups.tsx` — état isError + computePortfolio défensif

## Non-objectifs
- Aucun changement métier, schéma DB, RPC ou visuel des KPIs/tableaux.
- Aucun ajout de dépendance.

## Résultat attendu
- Plus jamais d'écran 100% blanc : on aura au pire un encart d'erreur avec sidebar visible et bouton "Recharger".
- Le retour sur l'onglet ne déclenche plus de cascade de refetch (fin du blanc sur `/groupes`).
- Un import cassé n'impacte qu'une seule route, pas toute l'app.
- Diagnostic futur facilité par les logs globaux `[ErrorBoundary]` / `[GlobalError]`.
