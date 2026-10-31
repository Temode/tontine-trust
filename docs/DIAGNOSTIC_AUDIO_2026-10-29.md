# Diagnostic audio — 29 octobre 2026

## Résultat et limites

Deux sessions authentifiées A/B dans Chromium sandbox, microphone synthétique, même tontine de test. Deux essais : 16:43:24–16:43:55 UTC, puis 16:44:34–16:45:20 UTC. Les appels de test ont été terminés et le statut `ended` relu.

- Les deux demandes `livekit-token` réussissent ; le serveur de signalisation annonce les deux participants.
- Aucun événement `connected` ni `reconnected` pendant les fenêtres mesurées.
- Passage `connecting` → `reconnecting` après environ 15 secondes, sur les deux clients.
- Aucun audio publié/reçu mesuré : 0 octet et 0 piste audio distante. Le microphone synthétique n'a donc pas établi de transport média.
- À 44 secondes, les deux côtés restent en reprise ; ils ne se sont pas rétablis automatiquement pendant l'observation. Ne pas extrapoler au-delà de cette durée.
- La sonnerie entrante et ses boutons sont visibles, sans visite guidée. Décrocher ouvre l'écran audio ; cela ne signifie pas que l'audio est connecté.

## Contrôle indépendant

Une `RTCPeerConnection` hors LiveKit, avec un canal de données et STUN public, ne produit aucun candidat local en 6 secondes ; l'état reste `gathering`. L'observation des connexions LiveKit donne également des collectes sans candidat au moment du relevé. Cela établit une anomalie de collecte ICE dans cet environnement, indépendante de la tontine et de sa fonction de jeton. Ce n'est pas une preuve de bon fonctionnement de LiveKit sur les téléphones.

Conclusion circonscrite : l'échec sandbox se situe avant l'établissement du transport média ; aucune preuve ici d'un jeton expiré, d'un serveur de signalisation injoignable, ni d'une négociation entre les deux navigateurs. La cause réseau/ICE exacte nécessite le relevé continu des candidats avant fermeture des connexions et une comparaison hors sandbox.

## Sortie si le transport reste bloqué sur TECNO

Ne pas consacrer une heure à recopier du Java pour ce diagnostic. Ce chantier ne change aucun fichier Android natif.

1. Sur le PC relié au TECNO, ouvrir Chrome `chrome://inspect/#devices`, sélectionner la WebView Tontine Digitale. Utiliser une version de développement : `window.__callDiagnostic.enable()` avant l'appel, puis `window.__callDiagnostic.read()` après 30–45 secondes. Cet interrupteur est volontairement absent en production. Si le build installé est de production, ne pas tenter de l'activer : relever les états ICE via l'inspection WebRTC et demander un essai de développement au lieu d'activer les journaux chez les clients.
2. Sur le navigateur de l'autre membre, ouvrir `chrome://webrtc-internals` avant l'appel. Noter l'heure UTC, le passage ICE `checking` → `connected/completed` ou `failed`, la présence de candidats `host/srflx/relay`, et la paire sélectionnée. Ne partager ni SDP, ni adresses, ni identifiants ICE/TURN.
3. Côté TECNO, collecter les mêmes états pour les connexions vers le SFU. Si la WebView ne les expose pas, la preuve manquante est précisément **le journal ICE de la connexion média du TECNO**, à obtenir par une instrumentation temporaire de développement, pas par la simple capture d'écran de l'appel.
4. Sur chaque client, comparer deux relevés espacés de 5 secondes : `bytesSent` et `bytesReceived` audio doivent augmenter. Une liste de participants ou un chronomètre ne remplace pas cette preuve.
5. Dans le projet **LiveKit Cloud**, rechercher la salle `call_<identifiant de l'appel>` et les sessions des deux clients dans la fenêtre UTC de l'essai. Relever la raison de départ, les étapes de connexion média et le transport UDP/TCP/TURN observé. L'accès au tableau de bord et la disponibilité exacte de ces journaux ne sont pas vérifiés depuis Lovable ; la trace manquante est le relevé serveur de ces deux sessions, détenu par l'administrateur du projet LiveKit.

## Interprétation utile

- Pas de candidat local même hors LiveKit : commencer par l'environnement client/WebView et l'accès réseau.
- Candidats présents, ICE échoue : corréler la paire et les réponses de transport avec LiveKit ; essayer Wi-Fi puis data mobile, sans changer la logique d'appel.
- ICE connecté mais audio envoyé seulement d'un côté : examiner permissions, publication et abonnement de piste.
- Octets audio reçus en hausse mais silence : examiner lecture/autoplay et sortie audio, pas le jeton.
- `reconnected` puis octets audio en hausse : reprise établie ; chronométrer l'interruption.

Les traces ajoutées sont bornées à 600 entrées, temporaires en mémoire, réservées au développement, désactivées par défaut. Elles ne contiennent ni jeton, ni email, ni nom de participant, ni contenu de conversation et ne sont pas envoyées à un service.