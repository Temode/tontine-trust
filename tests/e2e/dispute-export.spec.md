# Chantier 3 — Scénarios E2E « Contrat numérique & export de litige »

## Scénario F — Garde-fou `start_cycle` sur signature
1. Connexion organisateur d'un groupe « open » comportant 3 membres actifs (M1, M2, M3) où aucun n'a signé.
2. Appeler RPC `start_cycle(group_id)`.
3. **Attendu :** erreur `CONTRACT_NOT_SIGNED`, `groups.status` reste `open`.
4. Faire signer M1 et M2 via `/groupes/:id` (dialog SMS OTP). Relancer.
5. **Attendu :** échec encore (`CONTRACT_NOT_SIGNED` car M3 manquant). Faire signer M3, relancer.
6. **Attendu :** succès, cycle créé, `audit_log.action='contract_signed'` (×3) + `cycle_started`.

## Scénario G — Signature OTP complète
1. Sur `/groupes/:id` un membre non signataire voit le bandeau orange « Signature requise ».
2. Cliquer « Signer le contrat » → afficher le texte → cocher accepté → recevoir SMS (mock `kyc-send-otp`).
3. Saisir le code 6 chiffres → cliquer « Signer ».
4. **Attendu :** ligne dans `contract_signatures` avec `hash_sha256` (64 hex), `otp_ref` non NULL, `ip` & `user_agent` renseignés.

## Scénario H — Édition admin du modèle plateforme
1. Connecté en super-admin, ouvrir `/admin/contrat`.
2. Modifier le texte (≥ 50 caractères), incrémenter la version → « Publier ».
3. **Attendu :** nouvelle ligne dans `group_contracts` avec `group_id IS NULL`, `is_default=true`, entrée `audit_log.action='contract_template_published'`.
4. Vérifier qu'une nouvelle adhésion sur un groupe sans surcharge récupère bien la nouvelle version via `get_active_contract`.

## Scénario I — Export de litige : parcours complet
1. Organisateur sur `/groupes/:id` ouvre le panneau défaillants, clique « Export litige » sur le membre M3 et saisit un motif ≥ 20 caractères.
2. **Attendu :** ligne `dispute_exports.status='queued'` → bascule rapidement à `processing` puis `ready`.
3. Vérifier `pdf_path` non NULL dans le bucket privé `dispute-exports`, `sha256` longueur 64 hex, `signed_url` présent, `expires_at` ≈ now()+24 h.
4. Télécharger le PDF via l'URL signée — il contient les **7 sections** (couverture, identité KYC, ledger, reçus & paiements, contrat signé + empreinte, payouts reçus, preuve du défaut + SMS).
5. Re-calculer SHA-256 sur le PDF téléchargé → doit matcher `dispute_exports.sha256`.

## Scénario J — Accès restreint au bucket
1. En tant que membre lambda (non organisateur du groupe, non admin) tenter `storage.from('dispute-exports').download(path)` → **403**.
2. En tant qu'organisateur, même téléchargement direct via storage → **403** (lecture bucket réservée aux admins).
3. Mais l'organisateur peut récupérer l'URL signée 24 h via `dispute_exports.signed_url` (RLS le permet) → téléchargement OK.
4. Après expiration de 24 h, l'URL renvoie **403** (Supabase signed URL expirée). Re-demander un export pour en générer une nouvelle.

## Scénario K — Audit & idempotence
1. Chaque `request_dispute_export` → ligne `audit_log.action='dispute_export_requested'` avec `member_id` et `reason_length`.
2. Chaque signature → ligne `audit_log.action='contract_signed'` avec `contract_id` et `version`.
3. Relancer le même export sans changer le motif → crée une nouvelle ligne (intentionnel : chaque dossier est horodaté), mais le bouton frontend désactive le double-clic pendant la génération.