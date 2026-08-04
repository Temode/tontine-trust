# Migration WebRTC P2P → LiveKit Cloud (SFU) pour la visioconférence de groupe

## Faisabilité

Oui, techniquement sain et cohérent avec ton besoin : dès qu'un appel dépasse 3–4 participants (assemblées de tontine), un mesh P2P sature les mobiles en 4G (chaque client encode N-1 flux vidéo). Un SFU comme LiveKit Cloud résout ça — chaque client n'envoie qu'un seul flux et en reçoit N-1 déjà démultiplexés par le serveur, avec adaptation dynamique de la qualité (simulcast, dynacast) selon la bande passante mobile. C'est le pattern utilisé par Meet/Zoom.

LiveKit Cloud propose un free tier généreux (bande passante à la minute, jusqu'à ~50 participants par room) et un SDK React officiel (`@livekit/components-react`) qui remplace directement notre UI d'appel maison. Aucun changement de schéma DB nécessaire : on garde `call_requests` / `call_participants` pour l'orchestration métier (qui appelle, historique, enregistrement), on remplace uniquement la couche transport.

## Audit du code actuel à remplacer

À supprimer / remplacer :

- `src/hooks/useWebRTCCall.ts` (1 405 lignes) — machine à états ICE/SDP/renégociation P2P, signaling via Supabase Realtime. Remplacé par les hooks LiveKit (`useRoom`, `useTracks`, `useParticipants`).
- `src/components/messages/CallRoom.tsx` (586 l), `CallParticipantTile.tsx` (185 l), `CallDiagnosticPanel.tsx` — l'UI d'appel maison. Remplacée par les composants LiveKit (`LiveKitRoom`, `GridLayout`, `ParticipantTile`, `ControlBar`) restylés avec nos tokens (Bleu sarcelle / Or).
- `supabase/functions/get-ice-servers/index.ts` — plus utilisé (LiveKit gère TURN en interne).

À conserver :

- Tables `call_requests`, `call_participants`, `call_recordings` et leurs RPC (`request_group_call`, `respond_call_request`, `join_call`, `leave_call`, `set_call_mute`, `set_call_recording`). Elles portent la logique métier tontine (topic, planification, historique, quorum, consentement enregistrement) qui n'a rien à voir avec le transport.
- `IncomingCallScreen`, `useIncomingCalls`, `IncomingCallsContext`, `useRingtone` — signalisation « ça sonne » côté destinataire via Realtime sur `call_requests`. Inchangée.
- `CallRequestDialog`, `CallHistoryDrawer` — UI d'initiation et d'historique. Inchangée.

À ajouter :

- Edge Function `livekit-token` : mint un JWT LiveKit court (TTL 1 h) avec les grants `roomJoin`, `room=<call_id>`, `identity=<user_id>`, `name=<full_name>`. Vérifie côté serveur que l'appelant est bien membre du groupe (`can_join_call(call_id, auth.uid())`) avant d'émettre le token — c'est le seul garde-fou d'accès à la room, donc non négociable.
- Facultatif M2 : Edge Function `livekit-webhook` pour recevoir `participant_joined`, `participant_left`, `room_finished`, `egress_ended` — utile pour clôturer proprement `call_requests` et enregistrer l'URL de l'enregistrement en base.

## 1. Nouvelle architecture proposée

```text
 Frontend (React)                       Backend (Supabase)                 LiveKit Cloud
 ────────────────                       ─────────────────                  ─────────────
 CallRequestDialog ─── request_group_call() ──▶ call_requests (Realtime)
                                                     │
 IncomingCallScreen ◀── Realtime notify ─────────────┘
       │ accept
       ▼
 /call/:callId  ── invoke("livekit-token") ─▶ verify membership
                                              mint JWT (roomJoin, room=callId)
                                              ◀── { token, wsUrl } ────────
       │
       └── <LiveKitRoom token wsUrl> ─── WSS ──────────────────────────────▶ SFU
              ├── GridLayout (video)                                          (media)
              ├── ControlBar (mute/cam/screen/leave)
              └── ParticipantTile × N
```

Flux :

1. L'orchestration métier reste identique : `request_group_call` crée la ligne dans `call_requests`, les destinataires reçoivent l'incoming via Realtime.
2. À l'acceptation, on navigue vers `/call/:callId`. Le composant appelle `livekit-token` avec le `call_id`. L'edge function vérifie que l'utilisateur est membre du groupe lié à cet appel, puis émet un JWT LiveKit dont la `room` est le `call_id`. Aucun token n'est jamais mis en cache.
3. `<LiveKitRoom>` se connecte au WSS LiveKit Cloud avec ce token, active simulcast + dynacast, joint le micro et éventuellement la caméra selon les préférences utilisateur.
4. À la sortie (`onDisconnected`), on appelle `leave_call` pour clôturer côté DB. Quand le dernier participant part, un webhook LiveKit → `livekit-webhook` (M2) marque `call_requests.status = 'ended'`.
5. Enregistrement (M2) : on déclenche un egress LiveKit (composite MP4) vers notre bucket `call-recordings` via l'API serveur ; l'URL revient par webhook et est écrite via `set_call_recording`.

Périmètre livré en M1 (audio+vidéo temps réel) : points 1 à 4. L'enregistrement (5) est décalé en M2 pour ne pas mélanger transport et pipeline egress.

## 2. Dépendances à ajouter

Frontend (via `bun add`) :

- `livekit-client` — SDK bas niveau (Room, Track, RemoteParticipant).
- `@livekit/components-react` — composants React prêts à l'emploi (`LiveKitRoom`, `GridLayout`, `ControlBar`, `ParticipantTile`, `useTracks`).
- `@livekit/components-styles` — CSS de base, à surcharger avec nos tokens Bleu sarcelle / Or.

Backend (edge function Deno, via `npm:` specifier — pas d'install) :

- `npm:livekit-server-sdk@2` pour `AccessToken` et (M2) `RoomServiceClient`, `EgressClient`, `WebhookReceiver`.

À supprimer une fois LiveKit validé : rien à désinstaller côté npm — `useWebRTCCall` n'utilise que les APIs natives du navigateur, donc suppression = simple `rm` des fichiers concernés.

## 3. Variables d'environnement

À ajouter côté backend Lovable Cloud (formulaire sécurisé, jamais dans `.env` frontend) :

| Nom | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `LIVEKIT_API_KEY` | oui | `APIxxxxxxxxxxxx` | Clé API du projet LiveKit Cloud (Dashboard → Settings → Keys). Sert à signer les JWT. |
| `LIVEKIT_API_SECRET` | oui | chaîne de 40+ caractères | Secret associé. Signe le JWT côté serveur — jamais exposé au client. |
| `LIVEKIT_WS_URL` | oui | `wss://tontine-xxxxx.livekit.cloud` | URL WebSocket du projet LiveKit Cloud. Renvoyée au client avec le token. Publique par nature (elle transite dans le navigateur), stockée en backend uniquement pour être servie par `livekit-token`. |

Aucune variable côté frontend `.env` : le client reçoit `{ token, wsUrl }` à la demande, rien n'est bundlé.

Les 2 secrets Coturn (`TURN_HOST`, `TURN_SHARED_SECRET`) que tu allais me fournir ne sont plus nécessaires — LiveKit Cloud embarque son propre TURN (443/TCP+UDP, TLS) accessible depuis n'importe quel réseau mobile ou d'entreprise.

## Plan d'action (M1 — audio + vidéo temps réel)

1. **Prérequis (toi)** : créer un projet LiveKit Cloud (5 min sur livekit.io, plan Build gratuit), récupérer les 3 valeurs ci-dessus.
2. **Backend** : créer `supabase/functions/livekit-token/index.ts` — vérifie l'auth JWT Supabase, vérifie l'appartenance au groupe via une RPC `can_join_call(p_call_id)`, mint le JWT LiveKit (TTL 1 h, grants `roomJoin` + `canPublish` + `canSubscribe`), renvoie `{ token, wsUrl }`. CORS standard.
3. **DB** : petite RPC `can_join_call(p_call_id uuid)` SECURITY DEFINER retournant `boolean` — encapsule la vérification membre-du-groupe pour la réutiliser côté token et côté `join_call`.
4. **Frontend** : ajouter les 3 dépendances LiveKit. Créer `src/pages/CallRoom.tsx` (route `/call/:callId`) qui appelle `livekit-token` et rend `<LiveKitRoom>` + `<GridLayout>` + `<ControlBar>`. Restyler via `@livekit/components-styles` + surcharges Tailwind Bleu sarcelle / Or.
5. **Câblage** : `IncomingCallScreen` "Accepter" navigue vers `/call/:callId` (remplace l'ancien `CallRoom` inline). `CallRequestDialog` fait pareil après création.
6. **Nettoyage** : supprimer `useWebRTCCall.ts`, l'ancien `CallRoom.tsx`, `CallParticipantTile.tsx`, `CallDiagnosticPanel.tsx`, `get-ice-servers/`. Retirer l'import du panneau diagnostic dans `AppShell.tsx`.
7. **Validation** : test manuel à 3+ participants sur 4G (webcam + partage d'écran), vérification de la bascule qualité auto de LiveKit sous throttling réseau. Ajout d'un test E2E Playwright basique (joindre une room, publier micro, quitter) — la partie média réelle reste vérifiée manuellement, Playwright ne joue pas de flux WebRTC de façon fiable.

## M2 (hors périmètre M1, à confirmer plus tard)

- Enregistrement composite via egress LiveKit → `call-recordings` bucket, réutilise la RPC existante `set_call_recording`.
- Webhook `livekit-webhook` pour synchroniser `call_requests.status` et l'URL d'enregistrement.
- Sous-titres/transcription (LiveKit + Whisper) si demandé.

## Hors périmètre

- Création et facturation du compte LiveKit Cloud.
- Choix de la région LiveKit (par défaut, `wss://*.livekit.cloud` route vers le POP le plus proche — OK pour Guinée/UE, on n'a pas de contrainte de résidence des flux temps réel).
- Migration des enregistrements existants (aucun : la fonctionnalité n'a jamais été utilisée en production).