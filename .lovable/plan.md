## Problème

L'appel `djomy-init-payment` retourne **400 Bad Request** → aucune redirection.

Cause : dans `src/lib/api/djomy.ts`, `returnUrl`/`cancelUrl` sont construits à partir de `window.location.origin`. En preview Lovable / localhost, l'origine est `http://localhost:8080` (HTTP). Or l'edge function (`supabase/functions/djomy-init-payment/index.ts`) refuse toute URL non-HTTPS :

```ts
if (!/^https:\/\//.test(body.returnUrl)) return json({ error: "RETURN_URL_NOT_HTTPS" }, 400);
```

Djomy exige effectivement du HTTPS en sandbox/prod, donc on ne peut pas simplement enlever la garde — il faut fournir une URL HTTPS publique.

## Correctif

### 1. `src/lib/api/djomy.ts` — calculer un `returnUrl` HTTPS robuste
- Si `window.location.protocol === 'https:'` → utiliser `window.location.origin` (cas production / preview Lovable publiée).
- Sinon (localhost/HTTP) → utiliser une variable d'env `VITE_PUBLIC_APP_URL` si définie, sinon fallback sur l'URL Lovable publiée du projet (`https://tontine-digitale.lovable.app`).
- Construire `returnUrl = ${base}/payment/return?pid=...` et `cancelUrl = ${base}/payment/cancel?pid=...` pour permettre à `PaymentReturn` de re-poller le statut même hors de l'origine d'init.

### 2. `supabase/functions/djomy-init-payment/index.ts` — message d'erreur exploitable
Au lieu de `{ error: "RETURN_URL_NOT_HTTPS" }` sec, renvoyer aussi l'URL reçue + un `hint` pour qu'on voie immédiatement la cause dans le toast frontend.

### 3. `DjomyPaymentModal` — afficher le message détaillé
Le `catch` actuel n'affiche que `(e as Error).message`. Pour les erreurs `FunctionsHttpError` de supabase-js, lire `error.context?.json()` quand dispo pour récupérer `{error, details, hint}` et l'afficher dans le toast (parité avec ce qu'on a fait pour `start_cycle`).

### Vérification
- Re-tester depuis la preview : modal Djomy → "Continuer vers Djomy" → vérifier que la redirection sandbox Djomy s'ouvre.
- Vérifier `payments` (status=`initiated` puis `pending` au retour webhook).
- Vérifier que `PaymentReturn` reçoit bien le `pid` et poll le statut.

Aucune migration DB nécessaire.
