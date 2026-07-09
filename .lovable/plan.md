# Contexte

Hostinger ne propose pas le type d'enregistrement **NS** dans son gestionnaire DNS. C'est précisément pour cette raison que nous avions déjà mis en place **Resend** avec le domaine `tontinedigitale.com` vérifié, et que l'envoi d'emails transactionnels fonctionne (capture Resend : emails "Cotisation en retard" livrés depuis `noreply@tontinedigitale.com`).

Le problème actuel : le hook `auth-email-hook` que nous avons déployé pousse les emails dans la file **Lovable Emails**, qui exige une délégation NS vers `notify.tontinedigitale.com`. Cette délégation ne peut pas être créée chez Hostinger → les emails d'authentification (code OTP à 6 chiffres) ne partent pas.

Les enregistrements MX que vous avez ajoutés ne remplacent pas des NS — MX sert à recevoir du mail, NS sert à déléguer une zone DNS. Techniquement, ces MX n'ont aucun effet sur la vérification de Lovable Emails.

# Solution proposée

Faire envoyer les emails d'auth par **Resend** (comme les emails transactionnels qui marchent déjà), au lieu de la file Lovable Emails. Résultat : les codes OTP arrivent depuis `Tontine Digitale <noreply@tontinedigitale.com>` avec le design déjà harmonisé.

## Étapes

1. **Désactiver la file Lovable Emails** pour ce projet (`toggle_project_emails` off) afin que les auth emails ne retombent pas sur le sender par défaut `auth.lovable.cloud`.

2. **Réécrire `supabase/functions/auth-email-hook/index.ts`** pour :
   - Conserver la vérification de signature du webhook Supabase Auth (inchangée).
   - Conserver le rendu des 6 templates React Email existants (`signup`, `recovery`, `magic-link`, `invite`, `email-change`, `reauthentication`) — aucun changement visuel.
   - Remplacer l'appel `supabase.rpc('enqueue_email', …)` par un `POST` direct à l'API Resend via la gateway de connecteurs Lovable (`connector-gateway.lovable.dev/resend/emails`), en réutilisant la connexion Resend déjà en place.
   - `from: "Tontine Digitale <noreply@tontinedigitale.com>"`, `subjects` en français (« Votre code de vérification », « Réinitialiser votre mot de passe », etc.).
   - Journaliser dans `email_send_log` (statut `sent` / `failed`) pour garder la traçabilité admin.

3. **Redéployer** `auth-email-hook`.

4. **Vérifier** :
   - Créer un compte de test avec un yopmail → l'email « Vérifiez votre adresse email » arrive depuis `noreply@tontinedigitale.com` avec le code à 6 chiffres bien visible.
   - Le code saisi sur `/auth/verifier-email` valide bien le compte.
   - Idem pour « mot de passe oublié » (code recovery).

## Ce que ça ne change pas

- Les templates React Email restent identiques (charte Tontine Digitale déjà appliquée).
- Le flux OTP côté frontend (`Auth.tsx`, `VerifyEmail.tsx`, `ResetPassword.tsx`) n'est pas touché.
- Les emails transactionnels (rappels de cotisation, etc.) continuent d'utiliser leur pipeline actuel.

## Ce qu'il faudra faire côté vous

Rien — la connexion Resend et le domaine `tontinedigitale.com` sont déjà validés. Les MX ajoutés « à la place des NS » chez Hostinger peuvent être retirés (ils ne servent pas à l'envoi sortant), mais ce n'est pas bloquant.

## Détails techniques

- Utilisation de `LOVABLE_API_KEY` + `RESEND_API_KEY` (déjà présents comme secrets) via la gateway — pas de clé Resend en clair.
- Gestion d'erreur : si Resend renvoie ≠ 2xx, on log dans `email_send_log` avec `error_message` et on renvoie 500 pour que Supabase Auth réessaie.
- Pas de migration SQL nécessaire.
