## Objectif
Rendre l'appel entrant **infaillible** et **visible partout** (toutes les pages, onglet caché, écran verrouillé sur mobile), avec une UI digne d'une infrastructure "billion dollar" (sarcelle + or, tabular-nums, air, une seule action primaire).

## Diagnostic (ce qui ne marche pas aujourd'hui)
1. **Realtime fragile** — la table `call_requests` n'est peut-être pas dans la publication `supabase_realtime`, ce qui explique que Moïse ne reçoive rien.
2. **Pas de notification push hors onglet** — seule la `Notification` API native est utilisée, et seulement si l'onglet est caché *et* la permission déjà accordée. Pas d'amorçage de permission, pas de Service Worker → écran verrouillé / onglet fermé = silence.
3. **Sonnerie bloquée par autoplay** — `AudioContext` est créé à la volée sans pré-chauffe ; sur Chrome/Firefox, sans interaction préalable, il reste `suspended`.
4. **UI d'appel entrant = simple `Dialog`** — pas de prise visuelle forte, peut être masqué par d'autres dialogs/sheets, pas de plein écran sur mobile, design générique.
5. **Pas de présence "je suis joignable"** — l'émetteur ne sait pas si le destinataire est en ligne avant d'appeler.

## Plan d'implémentation

### 1. Backend — fiabiliser le canal Realtime
Migration courte :
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.call_requests;` (idempotent via `DO $$ ... $$`)
- `ALTER TABLE public.call_requests REPLICA IDENTITY FULL;` (pour recevoir les updates complets)
- Vérifier que `call_participants` est aussi publié (accusé de réception émetteur).

### 2. Permissions amorcées au login
Nouveau hook `usePrimeCallChannel()` monté dans `AppShell` qui, après authentification :
- demande `Notification.requestPermission()` (une seule fois, mémorisé)
- crée et **suspend** un `AudioContext` partagé (`unlock` au 1er clic global) → la sonnerie démarre instantanément
- Bandeau discret "Activer les notifications d'appel" si la permission est refusée (style sarcelle, ghost button).

### 3. Sonnerie globale + écran d'appel entrant plein écran
Remplacer `IncomingCallSheet` (Dialog) par **`IncomingCallScreen`** :
- `fixed inset-0 z-[100]` — couvre tout, par-dessus toute route/modale.
- Fond dégradé sarcelle profond → noir, halo or pulsant derrière l'avatar (animation `breathe` 1.6s, respect `prefers-reduced-motion`).
- Avatar XL du demandeur (96px), nom en `font-display`, sous-titre `text-sm text-muted-foreground` avec le nom du groupe et le sujet.
- Deux boutons circulaires `h-16 w-16` : **Refuser** (rouge desaturé) à gauche, **Rejoindre** (sarcelle, ombre `shadow-primary`) à droite, libellés sous l'icône. Une seule action primaire visuelle (Rejoindre).
- Compteur d'attente en `tabular-nums` (`00:12`) sous l'avatar.
- Flash du `<title>` ("📞 Appel — {Nom}") quand `document.hidden`, restauré au focus.
- `favicon` swap optionnel (badge or) pendant la sonnerie.

### 4. Sonnerie robuste
- Singleton `AudioContext` partagé (déverrouillé par `usePrimeCallChannel`).
- Si `state === "suspended"` au moment de l'appel → fallback : toast "Cliquez pour activer le son" qui appelle `resume()`.
- Vibration `[400,200,400,200,600]` en boucle (mobile).
- Coupure automatique à la décroche / refus / timeout 45s.

### 5. Notification système enrichie + Service Worker minimal
- SW dédié `public/call-sw.js` (uniquement pour `showNotification` persistante + clic → `clients.openWindow('/')` et focus). Pas de cache, pas d'offline (respect skill PWA).
- Enregistrement guardé : prod uniquement, pas en preview Lovable (`id-preview--`, `preview--`, iframe → skip).
- À l'arrivée d'un appel : `registration.showNotification(...)` avec `requireInteraction: true`, `actions: [Rejoindre, Refuser]`, `tag: callId`, son OS.

### 6. Présence "joignable"
- Étendre `user_call_presence` (déjà existant) : heartbeat 30s tant que l'onglet est ouvert.
- Dans `CallRequestDialog`, afficher avant l'envoi un compteur "X membres joignables maintenant" (point vert sarcelle). Décourage les appels dans le vide.

### 7. Cohérence design "billion dollar"
- Aucune couleur hardcodée — tokens `--primary` (sarcelle) et `--accent` (or) uniquement.
- Skeletons (jamais de spinner) pendant le chargement du nom/avatar du demandeur.
- Halo et pulse via `@keyframes` dans `index.css` (tokens `--shadow-primary`).
- `whitespace-nowrap` sur tous les CTA, libellés courts ("Rejoindre" / "Refuser").
- Respect `prefers-reduced-motion`.

## Détails techniques
- **Fichiers créés** : `supabase/migrations/<ts>_call_realtime_publication.sql`, `public/call-sw.js`, `src/hooks/usePrimeCallChannel.ts`, `src/lib/audio/callAudio.ts` (singleton AudioContext), `src/components/messages/IncomingCallScreen.tsx`, `src/hooks/useDocumentTitleFlash.ts`.
- **Fichiers modifiés** : `src/components/layout/AppShell.tsx` (remplace `IncomingCallSheet` par `IncomingCallScreen`, monte `usePrimeCallChannel`), `src/hooks/useRingtone.ts` (utilise le singleton + fallback resume toast), `src/index.css` (keyframes `breathe`, `pulse-ring`), `src/components/messages/CallRequestDialog.tsx` (compteur joignables).
- **Supprimés** : `src/components/messages/IncomingCallSheet.tsx` (remplacé).

## Hors scope (à confirmer avant)
- Vraie vidéo (caméra) — actuellement audio uniquement via `useWebRTCCall`. Le titre de votre message dit "vidéo" mais le code est audio. Je garde **audio** sauf si vous demandez explicitement de basculer en visio (effort important : nouveaux flux SDP, TURN obligatoire, UI tuiles vidéo).
- Push iOS Safari hors onglet : nécessite PWA installée + APNs ; non couvert ici.
