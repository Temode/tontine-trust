## Diagnostic

Do I know what the issue is? Oui.

- Le domaine email `notify.tontinedigitale.com` est encore en attente de DNS, car il attend des enregistrements NS que Hostinger ne permet pas de créer correctement.
- Le dernier test de création de compte a bien déclenché le hook d’auth, mais il est passé par le service email Lovable par défaut (`auth.lovable.cloud`), pas par notre envoi Resend.
- Le hook personnalisé `auth-email-hook` n’a aucun log récent : il n’est donc pas celui qui a envoyé l’email reçu.
- Résultat visible dans ta capture : ancien template “Tontine-Trust”, bouton de confirmation, aucun code OTP.

## Plan de correction

1. **Arrêter de dépendre du domaine `notify.tontinedigitale.com` pour l’auth**
   - Ne plus attendre la délégation NS impossible chez Hostinger.
   - Garder Resend comme canal réel d’envoi, puisque `noreply@tontinedigitale.com` fonctionne déjà pour les emails transactionnels.

2. **Créer un flux OTP auth propriétaire via Resend**
   - Ajouter une table sécurisée de codes temporaires : email, usage (`signup` / `recovery`), code haché, expiration, tentatives.
   - Créer des fonctions backend dédiées :
     - démarrer une inscription et envoyer un code OTP Resend ;
     - vérifier le code d’inscription ;
     - envoyer un code de récupération ;
     - vérifier le code de récupération et changer le mot de passe.
   - Les codes seront à 6 chiffres, expirés automatiquement, limités en tentatives, et jamais stockés en clair.

3. **Réutiliser les templates Tontine Digitale existants**
   - Garder la charte email actuelle : bleu sarcelle, or, structure claire, code OTP très visible.
   - Envoyer depuis `Tontine Digitale <noreply@tontinedigitale.com>` via la connexion Resend déjà configurée.

4. **Adapter les écrans `/auth` au vrai flux OTP**
   - Inscription : après soumission, envoyer notre OTP Resend puis rediriger vers `/auth/verifier-email`.
   - Vérification email : remplacer la vérification actuelle par notre vérification backend du code reçu.
   - Mot de passe oublié : envoyer un code OTP au lieu d’un lien classique.
   - Réinitialisation : saisir code + nouveau mot de passe dans le même parcours, avec messages loading/succès/erreur cohérents.

5. **Déployer et vérifier**
   - Déployer les nouvelles fonctions backend.
   - Tester une inscription Yopmail : email reçu depuis `noreply@tontinedigitale.com`, template Tontine Digitale, code OTP visible.
   - Tester la vérification du code et la récupération de mot de passe.
   - Si les secrets Resend ne sont pas disponibles côté backend, reconnecter/rafraîchir la connexion Resend avant le test final.

## Impact utilisateur

- Plus besoin d’enregistrements NS Hostinger pour les emails d’auth.
- Les emails d’auth partiront comme les emails transactionnels qui fonctionnent déjà.
- Le sender `auth.lovable.cloud` et l’ancien nom “Tontine-Trust” ne seront plus utilisés dans le parcours OTP applicatif.

## Point important

Désactiver simplement les emails Lovable ne suffit pas : cela ferait retomber l’auth sur les emails par défaut. La correction fiable consiste à faire passer l’OTP d’inscription et de récupération par notre propre flux Resend.