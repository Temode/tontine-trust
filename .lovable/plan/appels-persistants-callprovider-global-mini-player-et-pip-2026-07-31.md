# Appels persistants : CallProvider global, mini-player et PiP

Objectif : un appel qui ne se coupe jamais par accident, survit à la navigation, et se réduit en widget flottant ou en Picture-in-Picture natif — au niveau Google Meet / WhatsApp Web.

## État actuel (vérifié)

- `CallRoom.tsx` est monté **4 fois** dans l'app, à chaque fois localement : `IncomingCallScreen`, `IncomingCallSheet`, `CallRequestDialog`, `CallHistoryDrawer`. Chaque instance porte son propre state `open`/`callId`.
- Le rendu passe par `<Dialog>` shadcn : un clic sur l'overlay (ou Échap) déclenche `onOpenChange(false)` → `handleOpenChange` → `respond_call_request(ended)` + démontage de `LiveKitRoom`. L'appel est réellement raccroché par accident.
- Le composant est monté sous des écrans (`ConversationHeader` dans `/messages`) : quitter la page démonte l'arbre et coupe la connexion LiveKit.
- Aucun mode réduit, aucun PiP.

## Ce qu'on livre

### 1. `CallProvider` global (source unique de vérité)

Nouveau `src/hooks/CallContext.tsx`, monté dans `AppShell` (à côté de `IncomingCallScreen`) pour rester à l'intérieur du Router et de `AuthProvider`.

État exposé :

```text
callId | null
groupId, groupName, initialPrefs
mode: "full" | "mini" | "pip"
status: "idle" | "connecting" | "connected" | "error"
startCall({callId, groupId, groupName, prefs, manageLifecycle, cancelOnCloseBeforeJoin})
minimize() / expand() / hangup()
```

Le `<LiveKitRoom>` est rendu **une seule fois**, par le provider, dans un conteneur permanent monté sur `document.body` via portail. Il n'est jamais démonté lors d'un changement de route ni d'un changement de mode : seul le conteneur change de style/position. C'est la condition pour que l'appel survive à la navigation.

Les quatre appelants actuels perdent leur `<CallRoom>` local et appellent `startCall(...)` du contexte.

### 2. Fermeture accidentelle impossible

- Le mode plein écran n'utilise plus `Dialog` shadcn : c'est un overlay plein écran custom (portail + `fixed inset-0 z-[70]`), sans fermeture au clic sur le fond.
- `Échap` ne raccroche pas : il **réduit** en mini-player (comportement Meet).
- Le seul chemin vers `hangup()` : bouton rouge « Raccrocher », avec confirmation légère si d'autres participants sont présents.
- `beforeunload` avertit l'utilisateur si un appel est actif.

### 3. Modes d'affichage

**Full** — layout actuel conservé (header discret, FocusStage partage d'écran, carrousel participants, dock). Ajout d'un bouton « Réduire » (`Minimize2`) dans le dock, à gauche du raccrochage ; le bouton retour du header réduit au lieu de fermer.

**Mini-player** — carte flottante ~200×130 px ancrée en bas à droite (`fixed bottom-24 right-4 lg:bottom-6`, au-dessus de la `BottomNav`) :

- vidéo du speaker actif (repli sur la première caméra, puis sur avatar + initiales si tout est coupé) ;
- pastille micro (`Mic`/`MicOff`) + durée d'appel (`useCallTimer` existant) ;
- boutons : toggle micro, **Agrandir** (`Maximize2`), **Raccrocher** (rouge) ;
- déplaçable au doigt/à la souris, s'aimante aux coins ;
- respecte les safe-areas mobile.

Transition `full ↔ mini` animée (scale + opacity, 200 ms), sans remount du `LiveKitRoom`.

### 4. Picture-in-Picture natif

- Bouton PiP dans le dock (mode full) et dans le mini-player, affiché seulement si `document.pictureInPictureEnabled`.
- `video.requestPictureInPicture()` sur l'élément vidéo du speaker actif ; écoute de `enterpictureinpicture` / `leavepictureinpicture` pour synchroniser `mode`.
- Auto-PiP : quand `document.visibilityState` passe à `hidden` pendant un appel avec vidéo active, bascule automatique en PiP (silencieuse si le navigateur refuse — Safari/mobile).
- Repli propre : si PiP indisponible, on reste en mini-player, sans message d'erreur bloquant.

### 5. Détails UX qui font la différence

- Bandeau fin persistant en haut de l'app quand l'appel est en mini/PiP : « Appel en cours — 03:12 · Revenir », cliquable pour repasser en full (pattern WhatsApp/Discord).
- Le mini-player ne s'affiche jamais par-dessus la modale d'appel entrant.
- Un seul appel à la fois : `startCall` sur un appel déjà actif propose de basculer.
- Le son continue en mini/PiP : `RoomAudioRenderer` vit dans le provider, jamais démonté.
- Cycle de vie serveur (`accepted` / `cancelled` / `ended`) déplacé dans le provider, inchangé fonctionnellement.

## Fichiers touchés

- `src/hooks/CallContext.tsx` — **nouveau** : provider, état, cycle de vie, PiP, portail permanent.
- `src/components/messages/CallOverlay.tsx` — **nouveau** : rendu plein écran (extrait de `CallRoom`) sans Dialog.
- `src/components/messages/CallMiniPlayer.tsx` — **nouveau** : widget flottant draggable.
- `src/components/messages/CallActiveBanner.tsx` — **nouveau** : bandeau « Appel en cours ».
- `src/components/messages/CallRoom.tsx` — allégé : `RoomShell`, `CallHeader`, `AudioOutputMenu`, `FocusStage`, `ControlDock` (ajout Réduire + PiP) réexportés pour l'overlay.
- `src/components/layout/AppShell.tsx` — montage de `CallProvider` + overlay / mini / bandeau.
- `src/components/messages/IncomingCallScreen.tsx`, `IncomingCallSheet.tsx`, `CallRequestDialog.tsx`, `CallHistoryDrawer.tsx` — remplacement du `<CallRoom>` local par `useCall().startCall(...)`.

## Hors périmètre

Aucun changement backend : `livekit-token`, `livekit-moderate`, `respond_call_request`, RLS et tables d'appel restent identiques. Pas de nouvelle capacité (chat en appel, réactions, sous-titres, enregistrement).