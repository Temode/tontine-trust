# Audit profond et correctif appels LiveKit

## Diagnostic vérifié

- Le navigateur bloque l’appel à `livekit-token` parce que la requête preflight CORS reçoit une réponse non-OK.
- Le code source contient bien les headers CORS locaux dans `supabase/functions/livekit-token/index.ts` et `livekit-moderate/index.ts`.
- Le backend déployé répond actuellement `404 Requested function was not found` sur `livekit-token` et `livekit-moderate`.
- Les logs Edge ne montrent aucune exécution de `livekit-token`, ce qui confirme que la requête n’atteint pas la fonction applicative.
- Les RPC nécessaires côté base existent et sont exécutables : `request_group_call`, `respond_call_request`, `get_call_context`, `expire_stale_call_requests`, `can_moderate_call`, `set_call_lock`.
- Il n’y a plus de demande d’appel `pending` actuellement en base ; les deux derniers essais ont été passés en `cancelled`, donc le rollback frontend fonctionne au moins après échec de token.

## Cause probable

La migration LiveKit a été écrite dans le code mais les fonctions Edge `livekit-token` et `livekit-moderate` ne sont pas déployées dans le backend actif. Le navigateur affiche une erreur CORS parce qu’une fonction absente renvoie une erreur de plateforme au preflight OPTIONS au lieu des headers CORS attendus.

## Plan de correction

1. **Déployer les fonctions LiveKit**
   - Déployer `livekit-token`.
   - Déployer `livekit-moderate`.
   - Ne pas modifier `supabase/config.toml` sauf si le test montre explicitement un besoin de configuration non standard.

2. **Tester les fonctions directement**
   - Tester `livekit-token` après déploiement avec une requête directe.
   - Vérifier que la fonction ne renvoie plus `404`.
   - Vérifier que les réponses d’erreur incluent bien les headers CORS.
   - Si la fonction répond `LiveKit non configuré`, vérifier les secrets runtime nécessaires : `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`.

3. **Renforcer le rollback des appels**
   - Conserver le rollback actuel qui marque l’appel `cancelled` si `livekit-token` échoue.
   - Ajouter un cleanup à la fermeture du dialogue côté initiateur si une demande a été créée mais que la salle n’a pas été rejointe.
   - Garder `expire_stale_call_requests()` comme filet de sécurité pour les appels abandonnés.

4. **Corriger les avertissements UI liés à l’appel**
   - Ajouter une description accessible au `DialogContent` de `CallRoom` pour supprimer l’avertissement Radix `Missing Description`.
   - Ignorer l’avertissement `navigator.vibrate` comme non bloquant : il vient du navigateur quand la page vibre sans interaction utilisateur préalable, mais ce n’est pas la cause de l’échec d’appel.

## Validation

- Appel direct à `livekit-token` : plus de `404 Requested function was not found`.
- Depuis `tontinedigitale.com`, la preflight OPTIONS ne bloque plus l’appel.
- Depuis le compte B : l’appel crée la demande, obtient un token LiveKit, puis ouvre la salle.
- Depuis le compte A : l’appel entrant s’affiche uniquement pour un appel récent et réel.
- Après un échec token ou une fermeture avant connexion : la ligne `call_requests` passe à `cancelled` ou expire en `missed`, sans appel fantôme au refresh.