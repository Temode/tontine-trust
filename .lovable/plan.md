# Correctif critique : inscriptions bloquées

## Ce qui se passe réellement

Deux problèmes distincts s'enchaînent.

**1. L'email ne part plus (cause racine).**
Le service d'envoi refuse les emails avec l'erreur suivante, constatée dans les logs de production aujourd'hui à 11:32 :

```text
403 — "The tontinedigitale.com domain is not verified"
```

Le domaine expéditeur `tontinedigitale.com` n'est plus vérifié côté fournisseur d'emails (Resend), donc chaque code de vérification échoue → message « Impossible d'envoyer un mail pour le moment ». Le code applicatif est correct, c'est la configuration du domaine d'envoi qui est cassée.

**2. La 2e tentative est bloquée à tort (bug logique).**
À la première tentative, le compte est bel et bien créé côté authentification, et marqué comme « email confirmé » immédiatement (le code crée l'utilisateur avec `email_confirm: true` avant l'envoi du code). Comme l'envoi échoue ensuite, l'utilisateur reste sans code.
Au 2e essai, la vérification d'inscription regarde uniquement `email_confirmed_at` et conclut « ce compte existe déjà, connectez-vous » — alors que l'utilisateur n'a jamais validé son code. Résultat : l'utilisateur est enfermé, il ne peut ni finir l'inscription ni se connecter (la connexion exige `otp_verified === true`).

## Correctifs prévus

### A. Vérifier l'envoi (domaine Resend re-vérifié)
Le domaine ayant été re-vérifié côté Resend, on commence par un contrôle réel : inscription de test puis lecture des logs d'envoi pour confirmer un statut 200 à la place du 403. Aucun changement du chemin d'envoi si le contrôle passe.

### B. Débloquer les comptes coincés et empêcher la récidive
Dans la fonction d'inscription (`auth-otp`) :

1. Ne plus bloquer un email dont le compte existe mais dont `otp_verified !== true` : on rafraîchit le mot de passe et les métadonnées, puis on renvoie un nouveau code (comportement « reprise d'inscription »). Le message « ce compte existe déjà » ne s'affichera plus que pour un compte réellement vérifié.
2. Ne créer/valider le compte qu'après un envoi d'email réussi, ou à défaut supprimer le compte fraîchement créé si l'envoi échoue — pour ne jamais laisser de compte fantôme.
3. Message d'erreur plus clair côté formulaire quand l'envoi échoue (« Envoi d'email momentanément indisponible, réessayez dans quelques minutes »), et remontée d'une alerte Ops sur échec d'envoi OTP, afin d'être alerté avant les utilisateurs la prochaine fois.

### C. Récupération des utilisateurs déjà bloqués
Recensement des comptes créés récemment avec `otp_verified` absent/faux et sans code consommé. Une fois le correctif B en place, ces utilisateurs pourront simplement refaire une inscription avec le même email et recevront un code — aucune action manuelle nécessaire de leur côté.

## Détails techniques

- `supabase/functions/auth-otp/index.ts` → `startSignup()` : condition `existing?.email_confirmed_at` remplacée par un test sur `user_metadata.otp_verified === true` ; rollback (`auth.admin.deleteUser`) si `issueOtp` échoue pour un utilisateur nouvellement créé.
- `src/hooks/useAuth.tsx` / `src/lib/authOtp.ts` : libellés d'erreur `email_send_failed` / `email_not_configured` affinés.
- Envoi : soit conservation du chemin gateway Resend (voie rapide), soit bascule vers l'infrastructure email Lovable (`enqueue_email` + file d'envoi) pour les OTP.
- Déploiement de `auth-otp` après modification.
