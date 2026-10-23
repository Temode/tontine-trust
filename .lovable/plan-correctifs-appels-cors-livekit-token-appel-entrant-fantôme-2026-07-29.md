# Correctifs appels : CORS livekit-token + appel entrant fantôme

## Diagnostic (vérifié)

### 1. Erreur "Failed to send a request to the Edge Function"
Les fonctions `livekit-token` et `livekit-moderate` importent `corsHeaders` depuis `npm:@supabase/supabase-js@2/cors` — ce sous-chemin n'existe pas dans le package. Le module ne se charge pas, la preflight OPTIONS échoue → erreur CORS visible dans la console (`Response to preflight request doesn't pass access control check`).

### 2. Appel entrant fantôme au refresh de compte A
Quand compte B clique sur "Appeler", `requestGroupCall` insère la ligne dans `call_requests` (statut `pending`) **avant** l'étape LiveKit. Comme la génération du token échoue (cf. bug 1), personne ne rejoint jamais l'appel et la ligne reste `pending` indéfiniment. À chaque refresh, `useIncomingCalls` (poll toutes les X s + hydrate `pending/accepted` sans filtre de fraîcheur) affiche cet appel fantôme. Le compteur "1 appel en attente" du header vient de la même source.

## Correctifs

### A. Réparer CORS des fonctions LiveKit
Dans `supabase/functions/livekit-token/index.ts` et `supabase/functions/livekit-moderate/index.ts` :
- Retirer l'import cassé.
- Déclarer localement :
  ```ts
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  ```

### B. Empêcher les appels fantômes

1. **Auto-expiration côté client** (`src/hooks/useIncomingCalls.ts`) : ajouter un filtre `created_at >= now() - 90s` sur la requête de poll (déjà en place sur le catch-up initial) et sur l'hydrate depuis UPDATE, pour ne jamais présenter un appel obsolète.

2. **Marquer les appels expirés** : ajouter une fonction SQL `expire_stale_call_requests()` qui passe à `missed` les `call_requests` `pending` de plus de 2 minutes, puis l'appeler :
   - au démarrage de `useIncomingCalls` (best-effort, RPC),
   - après un abandon côté émetteur (fermeture du dialog sans join).

3. **Nettoyer si LiveKit échoue** (`src/components/messages/CallRoom.tsx` ou hook qui fetch le token) : si `livekit-token` renvoie une erreur avant tout join, appeler `updateCallStatus(callId, "cancelled")` pour ne pas laisser la ligne pending.

## Fichiers modifiés
- `supabase/functions/livekit-token/index.ts`
- `supabase/functions/livekit-moderate/index.ts`
- `supabase/migrations/<timestamp>_expire_stale_calls.sql` (nouvelle RPC)
- `src/hooks/useIncomingCalls.ts`
- `src/components/messages/CallRoom.tsx` (rollback en cas d'échec token)

## Validation
- Recharger compte A : plus d'appel entrant fantôme.
- Lancer un appel depuis compte B : preflight OPTIONS 200, token reçu, salle LiveKit ouverte.
- Fermer sans join : la ligne passe à `cancelled`, compte A ne voit rien.
