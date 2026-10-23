# Refonte CallRoom — ergonomie Google Meet Mobile

Refonte visuelle et structurelle de `src/components/messages/CallRoom.tsx` pour adopter l'UX de Google Meet mobile, en conservant la doctrine Tontine Digitale (infrastructure calme, bleu sarcelle #0D7377, or #E8AA14, hairlines discrets, tokens sémantiques).

Aucune logique métier (LiveKit token, RPC, modération, cycle accepted/ended, rollback) n'est modifiée. Le travail reste front-end / présentation.

## Ce qu'on livre

### 1. Layout dynamique du Stage

Détection dynamique de la présence d'une piste `Track.Source.ScreenShare` parmi les tracks.

- **Mode Focus (partage d'écran actif)**
  - Stage principal (partage) : ~68% de la hauteur utile, ratio préservé (`object-contain`), fond noir profond.
  - Bouton "Plein écran" (icône `Maximize2` / `Minimize2`) posé en overlay haut-droit du stage : bascule le `<video>` du partage en Fullscreen API natif.
  - Bandeau participants : sous le stage, carrousel horizontal scroll-x de vignettes 96×96 arrondies (`rounded-2xl`), nom tronqué, pastille micro, anneau lumineux `ring-2 ring-primary` quand `isSpeaking`.
- **Mode classique (pas de partage)**
  - 1 participant : tuile plein cadre.
  - 2 : split vertical mobile / horizontal desktop.
  - 3+ : grille équilibrée (`GridLayout` conservé, styling repris).

### 2. Header discret

Refonte du `<header>` actuel en barre translucide fine (`bg-background/60 backdrop-blur`, `border-hairline`) :

- Bouton retour (`ArrowLeft`) — remplace le "Quitter" texte, ferme la modale.
- Badge participants (`Users` + compte) — cliquable pour ouvrir la liste.
- Sélecteur de sortie audio (`Volume2` / `Speaker`) — menu compact listant les `AudioOutput` disponibles via `MediaDevices.enumerateDevices()` + `setSinkId`.
- Menu "..." (`MoreVertical`) réservé aux hôtes : regroupe **Verrouiller / Déverrouiller** et **Modérer (N)**. Remplace les deux boutons flottants actuels en haut-droite du stage.

### 3. Dock de contrôle flottant

Remplacement de `<ControlBar>` de `@livekit/components-react` par un dock custom composé de contrôles LiveKit primitifs (`useLocalParticipant`, `TrackToggle`) pour garder la logique intacte :

- Pilule flottante centrée, `absolute bottom-4 inset-x-0 mx-auto w-fit`, `rounded-full bg-card/90 backdrop-blur border border-hairline shadow-elegant`, `safe-area-inset-bottom`.
- Boutons ronds 48px : Micro, Caméra, Partage d'écran, Options (menu overflow), et bouton **rouge** Raccrocher (`bg-destructive text-destructive-foreground`).
- Marge basse suffisante pour ne pas chevaucher la nav mobile (`pb-[max(1rem,env(safe-area-inset-bottom))]`).

### 4. Cohérence Tontine Digitale

- Tokens sémantiques uniquement (`bg-background`, `text-foreground`, `border-hairline`, `bg-primary`, `bg-destructive`) — pas de hex en dur.
- Anneau "speaking" en `ring-primary` (bleu sarcelle), badges hôte en `bg-accent/20 text-accent` (or).
- Transitions douces `transition-all duration-200`, pas d'effet tape-à-l'œil.
- Reste responsive : dock et header safe-area, stage plein viewport sur mobile via `h-[100dvh]` dans la `DialogContent`.

## Fichiers touchés

- `src/components/messages/CallRoom.tsx` — refonte du JSX de `CallRoom` et `RoomStage` (header, stage dynamique, dock, menu hôte). Les hooks LiveKit, callbacks (`handleConnected`, `handleOpenChange`, `moderate`), et le cycle accepted/cancelled/ended restent identiques.

Aucun autre fichier n'est modifié : `CallRequestDialog`, `IncomingCallScreen`, `useIncomingCalls`, edge functions et RPC sont hors périmètre.

## Détails techniques

- Détection partage : `useTracks([Track.Source.ScreenShare])` → si `length > 0`, mode Focus.
- Fullscreen : `ref.current?.requestFullscreen()` sur l'élément vidéo du partage, écoute `fullscreenchange` pour synchroniser l'icône.
- Speaking ring : `participant.isSpeaking` exposé par LiveKit sur chaque `Participant`.
- Sortie audio : `navigator.mediaDevices.enumerateDevices()` filtré `kind === "audiooutput"`, appliqué via `room.switchActiveDevice("audiooutput", deviceId)`.
- Menu hôte : `DropdownMenu` shadcn existant.
- Dock : `TrackToggle` de `@livekit/components-react` pour micro/caméra/screenshare, bouton raccrocher = `room.disconnect()` puis `handleOpenChange(false)`.

## Hors périmètre

- Aucune modification backend, SQL, edge function.
- Pas de changement du flux d'appel entrant, sonnerie, ni des permissions micro.
- Pas d'ajout de nouvelles capacités (chat en appel, réactions, sous-titres).