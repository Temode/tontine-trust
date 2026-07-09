## Objectif

Envoyer tous les emails de Tontine Digitale depuis `noreply@tontinedigitale.com` avec le libellé **Tontine Digitale** — sans jamais toucher aux nameservers du domaine chez Hostinger. Pour ça on abandonne Lovable Emails (qui exige une délégation NS impossible chez Hostinger) et on branche **Resend**, qui vérifie le domaine uniquement via des enregistrements **CNAME + TXT + MX** — tous disponibles dans l'éditeur DNS Hostinger.

## Étape 1 — Créer le compte Resend et vérifier le domaine (côté utilisateur)

Actions que tu fais toi-même, une seule fois :

1. Créer un compte gratuit sur resend.com (plan Free : 3 000 emails/mois, 100/jour — largement suffisant au démarrage).
2. Dans Resend → **Domains** → **Add Domain**, saisir `tontinedigitale.com` (ou `send.tontinedigitale.com` si tu préfères isoler l'envoi ; je recommande le sous-domaine `send` pour ne pas polluer d'éventuels emails reçus sur le domaine racine).
3. Resend affiche 3 enregistrements à ajouter (tous supportés par Hostinger) :
   - 1× **MX** (host `send`, valeur `feedback-smtp.eu-west-1.amazonses.com`, priorité 10)
   - 1× **TXT** (host `send`, valeur `v=spf1 include:amazonses.com ~all`)
   - 1× **TXT** DKIM (host `resend._domainkey.send`, long token fourni par Resend)
4. Coller ces 3 enregistrements dans Hostinger → DNS Zone Editor → Add Record.
5. Cliquer **Verify DNS Records** dans Resend (propagation : 5 min à 2 h).
6. Une fois vérifié, générer une **API Key** dans Resend → API Keys → Create → permissions "Sending access" → copier la valeur `re_…`.

Quand tu me confirmes que le domaine est vérifié dans Resend, je te demande la clé API via le formulaire sécurisé.

## Étape 2 — Brancher Resend dans le code (côté agent)

1. Connecter le connecteur Resend via l'outil `standard_connectors--connect` (ça installe la clé dans les secrets edge functions sans que je la voie).
2. Créer une edge function unifiée `send-email` (Deno) qui appelle `POST https://connector-gateway.lovable.dev/resend/emails` avec :
   ```
   from: "Tontine Digitale <noreply@tontinedigitale.com>"
   to, subject, html, text, reply_to: "support@tontinedigitale.com"
   ```
3. Refactorer les appels existants `send-tontine-sms` / notifications tontines pour utiliser `send-email` pour le canal *email* (le SMS reste sur son propre outbox, inchangé).
4. Ajouter les mêmes garde-fous que côté SMS : opt-in via `notification_preferences`, déduplication 24 h via `email_outbox.dedupe_key`, rate-limit global.

## Étape 3 — Templates email de base

Créer les 4 templates HTML minimalistes (React Email inline styles, palette bleu sarcelle `#0D7377` + or `#E8AA14`) :
- `contribution_confirmed` — reçu de cotisation
- `beneficiary_payment_received` — X a payé, prochaine échéance le …
- `turn_started` — c'est à ton tour, dépôt attendu le …
- `manual_reminder` — rappel envoyé par l'organisateur

Copie sobre, française, tutoiement, signature "L'équipe Tontine Digitale — support@tontinedigitale.com".

## Étape 4 — Boîte support

`support@tontinedigitale.com` est une **adresse de réception**, pas d'envoi. Deux options :
- **Forwarding gratuit Hostinger** : configurer un forward `support@tontinedigitale.com` → ton adresse Gmail perso. Zéro coût, tu réponds depuis Gmail avec l'alias.
- **Boîte mail Hostinger Business** (~1 €/mois) si tu veux une vraie webmail dédiée.

Je te laisse choisir hors code — aucun impact sur l'app.

## Étape 5 — Désactiver Lovable Emails

Une fois Resend opérationnel, désactiver Lovable Emails pour éviter les doublons et les tentatives d'envoi qui échouent en silence. Les emails d'auth Supabase (confirmation d'inscription, reset password) repasseront sur les templates par défaut Lovable jusqu'à ce qu'on les migre aussi vers Resend en Phase 2 si tu veux.

## Détails techniques

**Nouveaux fichiers**
- `supabase/functions/send-email/index.ts` — wrapper unifié Resend via gateway
- `supabase/functions/_shared/emailTemplates.ts` — rendu HTML (mirror de `smsTemplates.ts`)
- `supabase/functions/_shared/__tests__/emailTemplates.test.ts` — tests Deno
- Migration : table `email_outbox` (même schéma que `sms_outbox` : `dedupe_key unique`, `status`, `attempts`, FIFO)

**Fichiers édités**
- `supabase/functions/send-tontine-sms/index.ts` — enqueue aussi un email si `notification_preferences.channel='email'.enabled`
- `supabase/functions/consume-sms-outbox/index.ts` → renommer en `consume-notifications-outbox` (traite SMS + email dans le même worker FIFO)

**Secrets ajoutés**
- `RESEND_API_KEY` (via connecteur, ne transite jamais par le chat)

## Ce que tu dois valider avant que je code

Confirme juste : **sous-domaine `send.tontinedigitale.com`** (recommandé) ou domaine racine `tontinedigitale.com` pour la vérification Resend ? Ensuite tu crées le compte Resend, tu ajoutes les 3 records dans Hostinger, tu me pings quand c'est vérifié et je démarre l'implémentation.
