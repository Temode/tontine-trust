## Cause racine identifiée

En comparant avec le projet Paxefy (qui utilise Djomy avec succès), 3 écarts expliquent les échecs :

| Élément | Notre code | Paxefy (qui marche) |
|---|---|---|
| URL production | `https://prod-api.djomy.africa` ❌ | `https://api.djomy.africa` ✅ |
| Valeur `DJOMY_ENV` pour la prod | `prod` | `production` |
| Header obligatoire | absent | `X-PARTNER-DOMAIN: dcaa27935b4920eb5e7c2c9a1d35a5040493b177bed92d9b69966c46eca6a627` |

Test manuel précédent : `https://api.djomy.africa/v1/auth` renvoyait 403 quand on l'appelait sans `X-PARTNER-DOMAIN` → ça confirme.

La signature HMAC (`hmacSha256(message=clientId, key=clientSecret)`) est déjà correcte de notre côté, rien à changer là-dessus.

## Corrections à apporter

### 1. `supabase/functions/_shared/djomy.ts`
- URL prod → `https://api.djomy.africa`
- Accepter `prod` ET `production` comme valeur de `DJOMY_ENV` (rétrocompatible avec le secret actuel)
- Ajouter la constante `DJOMY_PARTNER_DOMAIN = "dcaa27935b4920eb5e7c2c9a1d35a5040493b177bed92d9b69966c46eca6a627"`
- Ajouter automatiquement le header `X-PARTNER-DOMAIN` dans :
  - `getDjomyBearer()` (appel `/v1/auth`)
  - `djomyFetch()` (tous les autres appels Djomy)

### 2. `supabase/functions/djomy-validate-credentials/index.ts`
- Mettre à jour les URLs sondées : `https://api.djomy.africa` pour prod (sandbox inchangée)
- Ajouter `X-PARTNER-DOMAIN` aux deux probes
- Garder l'affichage Prod/Sandbox côte à côte

### 3. UI `src/pages/admin/DjomySettings.tsx`
- Aucune modif fonctionnelle nécessaire
- Mettre à jour la note sur `DJOMY_ENV` pour mentionner `production` (au lieu de `prod`)

### 4. Vérifier `djomy-webhook` et autres fonctions Djomy
Lecture seule pour confirmer qu'elles passent toutes par `_shared/djomy.ts` — si oui, le fix est automatiquement propagé. Sinon, ajouter le header là où elles appellent Djomy directement.

## Hors-scope

- Pas de modification de secrets (les clés Djomy déjà collées sont bonnes)
- Pas de modification des flux paiement / webhook côté logique métier
- Pas de migration DB

## Validation

Après les changements, cliquer sur « Tester maintenant » dans Admin → Identifiants Djomy doit retourner :
- Prod ✅ HTTP 201 avec un Bearer token
- Sandbox ❌ (normal, ce sont des clés prod)
- Verdict : `OK_PROD` (ou éventuellement `WRONG_ENV_SHOULD_BE_PROD` si le secret `DJOMY_ENV` est encore à `sandbox`, auquel cas l'UI te dira de le changer en `production`).
