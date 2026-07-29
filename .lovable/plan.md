# Audit et correctif audio des appels WebRTC

Symptôme : la connexion s'établit, les deux participants apparaissent connectés, mais aucun son ne passe dans un sens ni dans l'autre.

Note : je ne peux pas me connecter avec un mot de passe utilisateur depuis le sandbox (les sessions de test sont gérées par Lovable). Je propose un audit + correctifs ciblés, puis on valide ensemble depuis ta preview.

## Diagnostic (constats de code)

1. Double sink audio dans `CallParticipantTile` : quand le distant a de la vidéo, la `<video>` (non mutée pour un distant) ET l'`<audio>` caché lisent le même MediaStream. Selon le navigateur cela ne crée pas de silence, mais peut causer de l'écho ou fausser le sink actif.
2. Sink audio dépendant du rendu conditionnel : l'élément `<audio>` n'est monté que si `!isLocal && stream`. Si la piste vidéo arrive avant l'audio, l'élément peut recevoir le stream avant qu'une piste audio n'y soit ajoutée. Aucun `play()` explicite — si l'autoplay est refusé, l'échec est silencieux et jamais rejoué.
3. AudioContext d'enregistrement : `startRecording` branche chaque `peer.stream` sur un `MediaStreamSource`. Sur WebKit/Chromium, câbler un stream distant sur un AudioContext peut détourner sa sortie de l'élément `<audio>` si celui-ci n'a pas encore été démarré (`play()`). Impact uniquement si l'enregistrement est déclenché — à confirmer selon le scénario.
4. Pistes locales et transceivers : `createPeerConnection` fait `addTrack` seulement si `localStreamRef.current` existe. `start()` attend `getUserMedia` avant l'abonnement, mais rien ne garantit un transceiver `audio sendrecv` en fallback si `addTrack` échoue silencieusement.
5. Absence de logs runtime confirmant qu'une piste `audio` a été reçue (`ontrack` kind=audio, readyState, muted) et que `HTMLMediaElement.play()` distant a bien démarré.

## Correctifs proposés

Périmètre : `src/components/messages/CallParticipantTile.tsx`, `src/hooks/useWebRTCCall.ts`, `src/components/messages/CallDiagnosticPanel.tsx`.

1. `CallParticipantTile` :
   - Monter l'`<audio>` distant en permanence ; assigner `srcObject` dès qu'un stream est disponible.
   - Muter systématiquement la balise `<video>` (locale ET distante) et router tout l'audio via l'`<audio>` unique — supprime le double sink.
   - Appeler explicitement `audioEl.play().catch(...)` après `srcObject = stream`, avec un bouton "Activer le son" dans la tuile si la promesse échoue (autoplay bloqué).
   - Écouter `stream.onaddtrack` / `onremovetrack` pour réappliquer `srcObject` quand la piste audio arrive tardivement.
2. `useWebRTCCall` :
   - Logger dans `diagEvents` chaque `ontrack` (kind, id, readyState, muted) et chaque `addTrack` local (kind, enabled).
   - Ajouter `pc.addTransceiver('audio', { direction: 'sendrecv' })` en fallback si aucune piste audio locale n'est prête au moment de la création du peer connection.
   - Après négociation, vérifier qu'au moins un `RTCRtpSender` audio existe côté local et un `RTCRtpReceiver` audio côté distant ; sinon logger une erreur explicite dans `diagEvents`.
3. `CallDiagnosticPanel` : ajouter un bouton "Tester le son" qui liste `getSenders()`/`getReceivers()` audio, l'état de l'`AudioContext` global, et force `play()` sur tous les `<audio>` distants (débloque l'autoplay d'un clic).

## Validation

- Je pousse les correctifs. Tu ouvres la preview avec ton second compte, lances l'appel vers ton compte principal, on lit le panneau Diagnostic (évènements `ontrack`, senders/receivers, autoplay).
- Si le silence persiste : capture du panneau Diagnostic pendant l'appel — les lignes `ontrack` et `conn-state` sont décisives.

## Hors périmètre

- TURN/ICE : la connexion s'établit déjà, on ne touche pas à `get-ice-servers`.
- UI générale d'appel : uniquement le chemin audio.
