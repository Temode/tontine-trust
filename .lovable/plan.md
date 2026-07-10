## Constats de l’audit

- Le dernier test ne passe pas par le flux OTP Resend : la table des OTP n’a aucun enregistrement récent pour l’adresse testée, alors que les logs auth montrent un appel natif `POST /signup` à 07:38.
- Ce `POST /signup` déclenche `user_confirmation_requested`, puis le hook email natif Lovable, ce qui explique l’email envoyé par Lovable au lieu de Resend.
- Le backend hébergé est sain, mais l’infrastructure email Lovable du projet est dans un état incohérent : le domaine email projet est indiqué comme supprimé/changé (`notify.tontinedigitale.com`), et la table de logs Lovable email n’existe pas. Donc si un chemin natif est déclenché, il retombe sur l’expéditeur/template natif.
- Le code actuel de `auth-otp` envoie bien via Resend avec `from: Tontine Digitale <noreply@tontinedigitale.com>`, mais il ne suffit pas tant que le chemin natif `/signup` reste autorisé.

## Plan de correction

1. **Bloquer définitivement le signup natif**
   - Désactiver les inscriptions publiques natives côté auth backend.
   - Garder le flux `auth-otp` opérationnel, car il crée les utilisateurs côté serveur puis envoie le code via Resend.
   - Résultat attendu : tout appel accidentel au chemin natif `/signup` échoue et ne peut plus envoyer d’email Lovable.

2. **Supprimer/neutraliser les chemins email auth natifs restants**
   - Vérifier que les pages inscription, mot de passe oublié et reset utilisent uniquement `auth-otp`.
   - Retirer ou neutraliser le hook email auth Lovable si nécessaire, afin qu’il ne soit plus considéré comme chemin valide d’envoi.
   - Garder Resend comme seul chemin applicatif pour inscription/récupération.

3. **Renforcer les tests anti-régression**
   - Étendre le test existant pour échouer si le code réintroduit un appel client ou serveur à `auth.signUp`, `resetPasswordForEmail`, `signInWithOtp`, `generateLink`, ou tout endpoint natif équivalent.
   - Ajouter une vérification que `auth-otp` est le seul flux autorisé pour signup/recovery.
   - Ajouter un test documentaire/CI qui vérifie que le signup natif backend est désactivé ou explicitement bloqué.

4. **Vérifier en conditions réelles**
   - Déployer la fonction `auth-otp` après ajustements.
   - Lancer un test d’inscription.
   - Contrôler trois signaux :
     - un nouvel OTP est bien enregistré côté backend ;
     - aucun log auth `POST /signup` natif n’apparaît ;
     - l’email reçu vient de `noreply@tontinedigitale.com` via Resend.

## Point important

Le problème observé n’est pas un échec Resend : c’est un contournement du flux Resend par le chemin d’inscription natif. La correction principale est donc de bloquer ce chemin natif au niveau backend, pas seulement dans le frontend.