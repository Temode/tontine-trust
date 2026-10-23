# Correctif audio WebRTC après diagnostic

## Diagnostic confirmé par le rapport

Le problème principal n’est pas l’attachement HTML audio : le transport WebRTC échoue.

Constats du JSON fourni :

- `turnAvailable: false` : l’appel tourne en STUN uniquement.
- Tous les candidats ICE exportés sont `host` ; aucun candidat `srflx`, `relay` ni paire sélectionnée.
- La connexion passe en boucle `checking → disconnected/failed`, puis abandonne après 3 tentatives.
- Les pistes sont bien négociées au départ (`local addTrack audio`, `ontrack audio`), mais la piste distante reste `muted=true` car aucun chemin média utilisable n’est établi.
- `peers` est vide dans l’export final parce que le peer a été supprimé après `conn-failed`.

Conclusion : il faut traiter en priorité l’absence de TURN / relais média, puis renforcer la renégociation et le diagnostic audio.

## Plan de correction

### 1. Rendre le diagnostic d’appel explicite

Dans l’interface d’appel :

- Afficher un état clair quand l’appel est en STUN-only et que l’ICE échoue : “Connexion audio impossible sans relais réseau”.
- Dans l’export diagnostic, ajouter :
  - statistiques ICE via `getStats()` ;
  - paire candidate sélectionnée si disponible ;
  - type local/remote (`host`, `srflx`, `relay`) ;
  - nombre de bytes audio envoyés/reçus ;
  - état `muted/unmuted` des pistes audio.

Objectif : ne plus confondre “appel reçu” avec “média connecté”.

### 2. Corriger le flux ICE/TURN

Côté fonction `get-ice-servers` :

- Conserver STUN en fallback, mais remonter une raison explicite quand TURN est absent.
- Ajouter des logs non sensibles indiquant : `turn_configured`, `turn_token_ok`, `turn_token_failed`, `stun_only`.
- Normaliser la réponse pour que le frontend sache si le relais média est réellement disponible.

Côté frontend :

- Si `TURN=false` et que l’ICE échoue, arrêter les retries silencieux et afficher une action claire au lieu de boucler.
- Si `TURN=true`, basculer automatiquement en `iceTransportPolicy: relay` après un premier échec ICE.
- Journaliser explicitement `relay candidate received` et `selected pair relay`.

### 3. Sécuriser la renégociation audio

Dans `useWebRTCCall` :

- Garder `addTransceiver('audio', { direction: 'sendrecv' })` dès la création du peer.
- Quand une piste micro devient disponible ou change via le sélecteur :
  - utiliser `replaceTrack` si un sender audio existe ;
  - sinon `addTrack` + renégociation ;
  - journaliser après renégociation les senders/receivers audio réellement présents.
- Éviter les offres simultanées en ajoutant un verrou de négociation par peer.

### 4. Améliorer la sortie audio locale

Dans `CallParticipantTile` et le panneau diagnostic :

- Journaliser le résultat de `audio.play()` : succès ou blocage autoplay.
- Afficher “Activer le son” seulement si `play()` est réellement bloqué.
- Ajouter une action “Tester sortie audio” pendant l’appel pour jouer un bip local, séparé du flux WebRTC.

### 5. Configuration nécessaire pour corriger la voix en conditions réelles

Le rapport montre que le relais média n’est pas configuré. Pour que la voix passe entre réseaux mobiles/Wi‑Fi/NAT stricts, il faut activer TURN via les secrets backend déjà prévus par la fonction :

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Si ces secrets ne sont pas disponibles, le correctif frontend améliorera le diagnostic, mais certains appels resteront sans audio selon les réseaux.

## Validation

Après implémentation :

1. Lancer un nouvel appel.
2. Exporter le diagnostic.
3. Vérifier :
   - `turnAvailable: true` ;
   - au moins un candidat `relay` ou une paire candidate sélectionnée ;
   - `connectionState: connected` ;
   - piste audio distante `unmute` ;
   - bytes audio reçus/envoyés qui augmentent.
4. Tester à deux : un participant parle, l’autre confirme l’audio dans les deux sens.

## Hors périmètre

- Pas de refonte générale de l’UI d’appel.
- Pas de changement du modèle de permissions ou des groupes.
- Pas d’accès manuel à des comptes utilisateurs depuis le sandbox.
