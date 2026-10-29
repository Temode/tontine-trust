# Garder l'écran d'appel ouvert après Décrocher

## Constat
Après Décrocher, l'écran d'appel s'affiche puis disparaît et laisse la discussion de la tontine. Cause la plus probable : le micro est refusé ou indisponible dans l'app Android, la salle d'appel signale une erreur et l'appel se ferme tout seul. Cette cause n'est pas encore confirmée. La première étape du travail sera de la vérifier.

## Ce qui change pour l'utilisateur
- Si le micro ne peut pas s'ouvrir, l'appel ne se ferme plus. L'écran d'appel reste affiché, micro coupé, avec ce message : « Micro indisponible — autorisez l'accès au micro pour parler ».
- L'appel ne se termine plus que par Raccrocher, par une vraie coupure réseau qui dure, ou quand l'autre personne quitte l'appel.

## Détails techniques
1. `src/hooks/CallContext.tsx` :
   - ajouter `onMediaDeviceFailure` sur `LiveKitRoom` : passer le micro à coupé, afficher le message et ne pas fermer l'appel ;
   - dans `onError`, ne plus appeler `handleDisconnected()` pour une erreur de périphérique ;
   - enregistrer la raison de chaque fermeture dans la console, pour la lire dans Logcat.
2. `docs/android-appels/` (copie manuelle) : ajouter un extrait de manifeste avec `RECORD_AUDIO` et `MODIFY_AUDIO_SETTINGS`, et rappeler de demander l'autorisation micro à l'exécution.
3. Vérification : lancer un appel à blanc en preview avec un micro refusé ; l'écran doit rester affiché. Ensuite, appel test réel sur le TECNO après `npm run build` et `npx cap sync android`, lancés depuis la racine du projet.
