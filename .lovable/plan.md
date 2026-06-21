## Objectif

Activer l'appel audio de groupe (jusqu'ici UI seule) dans les conversations Tontine Digital, en s'appuyant sur l'infrastructure `call_requests` / `user_call_presence` déjà en place. L'expérience reste fidèle à `docs/DESIGN_DOCTRINE.md` (sarcelle/or, une seule action primaire, pas de spinner brut, tabular-nums).

## Choix techniques

WebRTC pair-à-pair (mesh) côté navigateur, signalisation via **Supabase Realtime Broadcast** (canal `call:{call_id}`). Avantages : aucune dépendance payante au démarrage, déjà inclus dans Lovable Cloud, pas de serveur média à opérer.

- **STUN** : `stun:stun.l.google.com:19302` (gratuit, suffisant pour la majorité des NAT).
- **TURN** : optionnel pour la v1. Si présent (secret `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`), on l'ajoute aux `iceServers`. Sans TURN, ~15 % des appels mobiles peuvent échouer — on l'indique dans le toast d'erreur et on documente l'ajout d'un service Twilio/Metered plus tard.
- **Limite mesh** : 6 participants audio simultanés maximum (au-delà, qualité dégradée). Bandeau d'avertissement si le groupe a > 6 membres actifs : « Appel limité aux 6 premiers participants ».

## 1. Base de données (une seule migration)

### Étendre `call_requests`
- Pas de nouvelle colonne nécessaire : `status` couvre déjà `pending|accepted|declined|cancelled|missed|ended`, `started_at` / `ended_at` existent.

### Nouvelle table `call_participants`
- Colonnes : `call_id uuid references call_requests`, `user_id uuid`, `joined_at timestamptz`, `left_at timestamptz null`, `is_muted boolean default false`. PK `(call_id, user_id)`.
- GRANT (authenticated, service_role), RLS : lecture/écriture si membre actif du groupe parent.
- Realtime activé → tous les pairs voient instantanément qui rejoint / quitte.

### Nouvelles RPC
- `join_call(p_call_id uuid)` : marque le user comme participant, passe `call_requests.status` à `accepted` et fixe `started_at` si premier participant.
- `leave_call(p_call_id uuid)` : met `left_at = now()`. Si plus aucun participant actif, set `status='ended'`, `ended_at=now()`.
- `mute_call_participant(p_call_id, p_muted)` : self-mute, refresh broadcast.

### `user_call_presence`
- Auto bascule en `busy` à `join_call`, retour à `available` à `leave_call` (déclencheur SQL).

## 2. Signalisation WebRTC

Canal Realtime Broadcast `call:{call_id}` avec events :
- `peer-join { user_id }`
- `offer { from, to, sdp }`
- `answer { from, to, sdp }`
- `ice { from, to, candidate }`
- `peer-leave { user_id }`

Chaque client crée un `RTCPeerConnection` par pair (mesh). Politique « celui dont l'`user_id` est lexicographiquement le plus petit » crée l'offre, l'autre répond — évite les collisions.

## 3. Composants UI

### `CallRoom.tsx` (nouveau, plein écran modal)
- Header : nom du groupe, durée d'appel (`tabular-nums`, format `mm:ss`), badge « En direct » sarcelle pulsant.
- Grille de participants : avatar + nom + indicateur niveau audio (anneau sarcelle dynamique via `AnalyserNode`), pastille micro coupé.
- Barre d'actions (bas, centrée, une action primaire) :
  - **Quitter** (gros bouton or, primary destructive)
  - Boutons secondaires icônes : `Mic` / `MicOff`, `Volume2` / `VolumeX` (sortie locale), `Users` (liste).
- Empty state : « En attente d'autres participants… » + skeleton de tuiles.
- Erreurs ICE : toast + bouton « Réessayer la connexion ».

### `IncomingCallSheet.tsx` (nouveau, monté dans `AppShell`)
- Écoute les inserts `call_requests` (statut `pending`) sur tous les groupes du user via `useChatToasts` étendu.
- Bottom-sheet (mobile) / dialog (desktop) : avatar groupe, nom demandeur, sujet, deux boutons : **Rejoindre** (sarcelle, primary) / **Refuser** (ghost).
- Sonnerie discrète (oscillator WebAudio, 2 bips) — pas de mp3 externe.
- Auto-dismiss si l'appel passe à `ended`, `declined`, `cancelled`.

### Évolutions
- `CallRequestDialog.tsx` : sur succès, le demandeur est dirigé vers `CallRoom` directement (il devient premier participant).
- `CallHistoryDrawer.tsx` : nouvelle colonne « Participants » (count), bouton « Rejoindre » actif si appel `pending`/`accepted` en cours.
- `ConversationHeader.tsx` : si un appel est en cours pour ce groupe, bandeau sarcelle sticky « Appel en cours · 3 participants — Rejoindre ».

## 4. Hooks

- `useWebRTCCall(callId)` : gère `RTCPeerConnection`s, attache `getUserMedia({audio:true})`, écoute signalisation, expose `{ participants, localStream, toggleMute, leave, status }`.
- `useIncomingCalls()` : remonte la prochaine demande pending visible pour l'utilisateur.
- `useCallTimer(startedAt)` : renvoie durée formatée.

## 5. Permissions & erreurs

- Demande explicite du micro avant join (`navigator.mediaDevices.getUserMedia`).
- Refus → toast clair : « Autorisez l'accès au micro dans votre navigateur pour rejoindre l'appel. »
- HTTPS requis (déjà le cas en preview/prod Lovable). En localhost ok.
- Navigateurs non supportés (vieux Safari) → message dédié et désactivation des boutons.

## 6. Fichiers à créer

- `supabase/migrations/<ts>_call_participants.sql`
- `src/lib/api/calls.ts` → ajouter `joinCall`, `leaveCall`, `setMute`, `listCallParticipants`, `subscribeCallParticipants`.
- `src/hooks/useWebRTCCall.ts`
- `src/hooks/useIncomingCalls.ts`
- `src/hooks/useCallTimer.ts`
- `src/components/messages/CallRoom.tsx`
- `src/components/messages/CallParticipantTile.tsx`
- `src/components/messages/IncomingCallSheet.tsx`
- `src/components/messages/OngoingCallBanner.tsx`

## 7. Fichiers à modifier

- `src/components/messages/CallRequestDialog.tsx` → redirige vers `CallRoom`.
- `src/components/messages/CallHistoryDrawer.tsx` → bouton « Rejoindre » actif + retire « bientôt disponible ».
- `src/components/messages/ConversationHeader.tsx` → bandeau d'appel en cours, retire les tooltips « bientôt disponible » sur `Phone`.
- `src/components/layout/AppShell.tsx` → monte `IncomingCallSheet`.
- `src/lib/api/presence.ts` → helpers pour set busy/available auto.

## 8. Hors périmètre v1 (à signaler)

- **Vidéo** : reste désactivée, tooltip conservé.
- **TURN managé** : non inclus ; si la connectivité échoue derrière NAT strict, plan v1.1 = brancher Twilio Network Traversal via connector (5 min de setup, ~0,40 USD/Go).
- **Enregistrement d'appel** : non implémenté.
- **Notifications push hors-app** : reposent sur les notifs Lovable existantes (in-app uniquement pour le moment).

## 9. Validation

1. Alice clique « Demander un appel » → modal → envoi → entre dans `CallRoom` seule, statut « En attente ».
2. Bob (autre session) reçoit `IncomingCallSheet` < 1 s, clique « Rejoindre » → flux audio bidirectionnel établi en < 3 s sur réseau classique.
3. Charlie rejoint → mesh à 3, chacun entend les 2 autres.
4. Bob mute → pastille micro coupé visible chez Alice et Charlie en < 500 ms.
5. Présence : pendant l'appel, pastille des 3 passe à `busy` chez les autres membres ; revient à `available` après `Quitter`.
6. Dernier participant quitte → appel passe `ended`, `ended_at` rempli, historique mis à jour.
7. Refus de permission micro → message d'erreur explicite, aucune entrée fantôme dans `call_participants`.
8. Doctrine : aucune couleur hardcodée, `mm:ss` en tabular-nums, une seule action primaire (Quitter), skeletons.
