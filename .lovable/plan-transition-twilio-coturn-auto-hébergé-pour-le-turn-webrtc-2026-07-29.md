# Transition Twilio → Coturn auto-hébergé pour le TURN WebRTC

## Faisabilité

Oui, faisable sans changement d'architecture. La fonction actuelle `supabase/functions/get-ice-servers/index.ts` a déjà la bonne forme : elle renvoie `{ iceServers, turn, reason }` au frontend, et le hook `useWebRTCCall` + `src/lib/api/calls.ts` consomment déjà cette structure. Il suffit de remplacer la branche « mint Twilio Token » par une génération locale d'identifiants éphémères Coturn signés en HMAC-SHA1, en gardant STUN Google en fallback.

Coturn supporte nativement l'authentification `use-auth-secret` (REST API long-term credential) : le serveur ne stocke aucun user, il vérifie que `password = base64(HMAC_SHA1(secret, username))` où `username = "<expiry-unix-ts>:<label>"`. C'est le standard utilisé par Twilio, Jitsi, LiveKit, etc. — donc côté client rien ne change.

## 1. Adaptation de la fonction `get-ice-servers`

Remplacement de la branche Twilio par une génération 100 % locale, sans appel HTTP sortant :

1. Lire les env vars Coturn (voir §2). Si absentes → renvoyer STUN-only avec `reason: "coturn_not_configured"` (comportement inchangé pour le frontend).
2. Générer un `username` éphémère : `${expiry}:${userLabel}` où :
   - `expiry = Math.floor(Date.now()/1000) + TTL` (TTL par défaut 6 h, borné 1 h–24 h).
   - `userLabel = auth.uid()` si l'utilisateur est authentifié (extrait du JWT `Authorization` reçu par la fonction), sinon `"anon"`. Ça permet de tracer côté logs Coturn qui utilise le relais, sans exposer d'info sensible.
3. Calculer `credential = base64(HMAC_SHA1(TURN_SHARED_SECRET, username))` via `crypto.subtle.sign("HMAC", key SHA-1, username)`.
4. Construire la liste d'ICE servers, en incluant plusieurs URLs pour maximiser la traversée NAT/firewall :
   - `turn:<host>:3478?transport=udp`
   - `turn:<host>:3478?transport=tcp`
   - `turns:<host>:5349?transport=tcp` (TLS, indispensable derrière pare-feu strict / réseau d'entreprise)
   - + les 2 STUN Google actuels en secours de découverte srflx.
5. Retourner `{ iceServers, turn: true, reason: "coturn", ttlSeconds: TTL, username }` (username utile pour le panneau Diagnostic, jamais le secret).
6. Logs non sensibles : `coturn_configured`, `coturn_credential_ok`, TTL, host — jamais le secret ni le HMAC.

Aucun changement au contrat renvoyé au frontend (`iceServers`, `turn`, `reason`), donc `fetchIceServers` et `useWebRTCCall` continuent de fonctionner sans modification.

## 2. Variables d'environnement à fournir

À ajouter côté backend Lovable Cloud (formulaire sécurisé, jamais dans le code ni dans `.env` frontend) :

| Nom | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `TURN_HOST` | oui | `turn.tontinedigitale.com` | FQDN public du serveur Coturn (résolvable en A/AAAA). |
| `TURN_SHARED_SECRET` | oui | chaîne aléatoire ≥ 32 caractères | Correspond à `static-auth-secret` dans `turnserver.conf`. Sert au HMAC. |
| `TURN_TTL_SECONDS` | non (défaut 21600) | `21600` | Durée de vie des identifiants éphémères. |
| `TURN_REALM` | non (défaut = `TURN_HOST`) | `tontinedigitale.com` | Champ realm annoncé par Coturn. Doit matcher `realm` dans `turnserver.conf`. |
| `TURN_TLS_PORT` | non (défaut 5349) | `5349` | Port TURNS/TLS. |
| `TURN_UDP_TCP_PORT` | non (défaut 3478) | `3478` | Port TURN UDP + TCP. |

Côté serveur Coturn (à toi de configurer sur ton VPS, hors périmètre code), `turnserver.conf` doit au minimum contenir : `use-auth-secret`, `static-auth-secret=<le même secret>`, `realm=<TURN_REALM>`, `listening-port=3478`, `tls-listening-port=5349`, un certificat TLS (Let's Encrypt), `fingerprint`, `no-multicast-peers`, `no-cli` ou CLI sécurisée. Je peux te fournir un `turnserver.conf` de référence quand tu attaques la partie infra.

Rien à mettre côté frontend : `TURN_*` restent des secrets backend, seul le résultat de `get-ice-servers` (URL + credential éphémère) transite vers le navigateur.

## 3. Comportement du frontend et fallback

Aucun changement d'API :

- `fetchIceServers()` continue de renvoyer `{ iceServers, turn, reason }`. Si la fonction backend ne peut pas générer (secret manquant, erreur crypto), elle retourne les 2 STUN Google avec `turn: false` — le hook `useWebRTCCall` détecte déjà ce cas et affiche la bannière « Connexion audio impossible sans relais réseau » lorsque l'ICE échoue en STUN-only.
- Fallback réseau ultime côté client : si l'appel à `get-ice-servers` échoue lui-même (edge function down, réseau), `calls.ts` renvoie déjà les 2 STUN Google publics — comportement conservé.
- Le panneau Diagnostic affichera `reason: "coturn"` au lieu de `"twilio_error"`/`"twilio_not_configured"`, ce qui facilite le support.
- Les identifiants étant éphémères (TTL 6 h), on ne rafraîchit pas pendant un appel en cours : la session ICE négocie une seule fois au démarrage. Pour un appel > TTL, `iceRestart` re-appellera `get-ice-servers` et obtiendra de nouveaux identifiants automatiquement.

## Plan d'action

1. **Backend** : réécrire `supabase/functions/get-ice-servers/index.ts` pour générer les identifiants HMAC-SHA1 Coturn, garder STUN en fallback, logs non sensibles. Supprimer toute référence à Twilio dans cette fonction.
2. **Secrets** : ouvrir un formulaire sécurisé pour saisir `TURN_HOST` et `TURN_SHARED_SECRET` (les autres sont optionnels avec valeurs par défaut). Les secrets `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` peuvent être supprimés dans un second temps une fois la nouvelle fonction validée.
3. **Tests** : test Deno unitaire vérifiant le format `username = "<expiry>:<label>"` et que `credential` est bien un base64 de 28 caractères (HMAC-SHA1 = 20 octets).
4. **Validation en preview** : lancer un appel à 2, exporter le diagnostic, vérifier `turnAvailable: true`, présence d'un candidat `relay` et d'une paire sélectionnée `relay/relay` ou `relay/srflx`, et flux d'octets audio non nul dans les deux sens.
5. **Nettoyage** : supprimer la doc/mentions Twilio dans le panneau Diagnostic une fois la validation OK.

## Hors périmètre

- Installation et configuration du serveur Coturn sur ton VPS (je peux fournir un `turnserver.conf` de référence + reco firewall, mais je n'exécute rien côté infra).
- Certificat TLS pour TURNS (Let's Encrypt sur ton VPS).
- Monitoring / rotation du `TURN_SHARED_SECRET` (à planifier séparément — la rotation invalidera uniquement les nouvelles négociations, pas les sessions ICE en cours).