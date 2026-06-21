## Constat

La documentation Djomy confirme que notre code est conforme :
- Signature : `HMAC_SHA256(message=clientId, key=clientSecret)` ✅
- Header : `X-API-KEY: <clientId>:<signature_hex>` ✅
- Endpoint : `POST /v1/auth` avec body `{}` ✅
- URL `https://prod-api.djomy.africa` répond bien (le 401 prouve qu'on parle au bon serveur)

Pourtant l'auth retourne 401 alors que tu confirmes :
- Clés issues de la **section Production** du dashboard Djomy
- Compte marchand **activé**

Il reste 3 causes plausibles, qu'on ne peut pas distinguer sans tester :
1. Un caractère parasite (espace, retour à la ligne, guillemet) a été copié dans la valeur d'un secret
2. Les clés affichées comme « Production » correspondent en fait à l'API Sandbox côté Djomy
3. Une restriction côté Djomy (IP whitelisting, activation API distincte de l'activation compte)

## Ce que je vais faire

### 1. Améliorer `djomy-validate-credentials` pour tester **les deux environnements en parallèle**

À chaque clic sur « Tester maintenant », la fonction appellera :
- `POST https://prod-api.djomy.africa/v1/auth`
- `POST https://sandbox-api.djomy.africa/v1/auth`

…avec les mêmes secrets et renverra les deux résultats. Cela permet de savoir immédiatement si les clés sont en réalité des clés Sandbox malgré l'étiquette « Production ».

Ajouts au payload de réponse :
- `clientIdHasWhitespace` (bool) et `clientSecretHasWhitespace` (bool) pour détecter les copier-coller fautifs
- `clientIdTrimmedLength` vs `clientIdLength` (pour signaler un trim qui changerait la valeur)
- Corps brut de la réponse Djomy (utile pour voir les codes d'erreur explicites comme `INVALID_CLIENT`, `UNKNOWN_MERCHANT`, etc.)

### 2. Mettre à jour `src/pages/admin/DjomySettings.tsx`

Afficher côte à côte les deux résultats (Prod / Sandbox) avec un badge vert/rouge, le code HTTP, la latence, le corps de réponse Djomy, et un avertissement explicite si :
- Sandbox ✅ et Prod ❌ → « Vos clés sont des clés Sandbox. Bascule `DJOMY_ENV=sandbox` ou récupère des clés Production. »
- Whitespace détecté → « Une valeur de secret contient des espaces / sauts de ligne. Recolle-la sans espace. »
- Les deux ❌ → « Identifiants invalides côté Djomy. Contacte le support Djomy avec le `clientIdPreview` affiché. »

### 3. Aucune modification de l'intégration paiement réelle

Ce diagnostic est purement en lecture, il ne touche ni `djomy-init-payment`, ni `djomy-webhook`, ni les autres flux.

## Détails techniques

Fichiers modifiés :
- `supabase/functions/djomy-validate-credentials/index.ts` — appel parallèle Prod + Sandbox, ajout des champs de diagnostic
- `src/pages/admin/DjomySettings.tsx` — affichage double colonne + verdict automatique

Aucune migration, aucun nouveau secret, aucune dépendance ajoutée.

## Résultat attendu

Après un seul clic sur « Tester maintenant » tu sauras avec certitude laquelle des 3 causes est la bonne, et l'écran t'indiquera l'action à faire.
