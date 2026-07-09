## Diagnostic provisoire

- Le domaine email Lovable a bien été supprimé : il ne doit plus piloter les emails Tontine Digitale.
- Resend envoie bien des emails OTP : le backend a enregistré des envois `signup` et `recovery` acceptés par Resend avec identifiant fournisseur.
- Les logs récents ne montrent aucun appel au flux OTP depuis l’app au moment du problème signalé : cela indique probablement que le test a été fait sur une version publiée/stale qui utilise encore l’ancien flux natif.
- Les captures suggèrent aussi une confusion possible entre deux boîtes/adresses différentes : Resend affiche un OTP envoyé à une adresse de test, tandis que Yopmail montre un ancien email “Tontine-Trust” venant du sender Lovable par défaut.
- Le bouton “Publier la correction” est visible : la correction OTP semble disponible en prévisualisation, mais pas encore appliquée au domaine publié/custom domain.

## Plan de correction

1. **Audit de bout en bout sur la même adresse email**
   - Tester l’inscription depuis la prévisualisation.
   - Vérifier que l’app appelle le flux OTP Resend, pas l’ancien flux email natif.
   - Vérifier que le code reçu dans Resend correspond bien à l’écran “Vérifiez votre email”.

2. **Verrouiller le flux d’inscription**
   - S’assurer qu’aucun chemin de signup, reset password ou vérification email ne déclenche encore l’email natif par défaut.
   - Garder Resend comme canal unique pour les codes OTP d’inscription et de réinitialisation.
   - Ne pas recréer le domaine email Lovable `notify.tontinedigitale.com`, car Hostinger ne permet pas la délégation NS nécessaire.

3. **Redéployer la partie backend OTP**
   - Redéployer la fonction d’envoi OTP pour garantir que la version active est bien celle qui utilise Resend.
   - Vérifier les logs après un test réel : email envoyé, code généré, statut accepté par Resend.

4. **Publier la correction sur le domaine public**
   - Publier l’app pour que `tontinedigitale.com` utilise le même flux OTP que la prévisualisation.
   - C’est probablement l’étape manquante qui explique pourquoi l’ancien email `auth.lovable.cloud` continue d’arriver côté domaine public.

5. **Validation finale à la hauteur de Tontine Digitale**
   - Créer un compte test avec une adresse unique.
   - Confirmer que l’email reçu vient de `Tontine Digitale <noreply@tontinedigitale.com>`.
   - Confirmer que l’email contient un code OTP à 6 chiffres.
   - Saisir ce code dans l’app et vérifier l’accès au tableau de bord.
   - Confirmer qu’aucun nouvel email `Tontine-Trust <no-reply@auth.lovable.cloud>` n’est généré pendant ce test.

## Résultat attendu

Après approbation, je corrige et vérifie le flux complet : l’inscription et la réinitialisation passent uniquement par Resend, avec code OTP visible, puis je publie la correction pour que le domaine public arrête d’utiliser l’ancien email Lovable.