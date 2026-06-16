# Plan — Correctif FK + E2E destructif complet

## Partie 1 — Correctif SQL : FK `turns.beneficiary_user_id`

Origine du bug : `db/02_tontine_schema.sql:121` déclare `beneficiary_user_id uuid not null references auth.users(id)`. La requête `src/lib/api/turns.ts:18` utilise l'embed PostgREST `beneficiary:profiles!turns_beneficiary_user_id_fkey(full_name)` qui exige une FK vers `public.profiles`. Résultat : 400 PGRST200 dès qu'on charge `GroupDetail`.

Solution la plus propre : ajouter une **seconde FK** vers `profiles` (en plus de celle vers `auth.users`) — `profiles.id` est déjà la PK qui pointe sur `auth.users.id`, donc l'invariant est conservé.

Fichier : `db/44_fk_turns_profiles.sql`

```sql
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'turns_beneficiary_user_id_fkey'
      and conrelid = 'public.turns'::regclass
  ) then
    alter table public.turns
      add constraint turns_beneficiary_user_id_fkey
      foreign key (beneficiary_user_id)
      references public.profiles(id)
      on delete restrict;
  end if;
end $$;

-- Force PostgREST schema cache reload
notify pgrst, 'reload schema';
```

Idempotent, zéro impact sur l'existant.

## Partie 2 — Scénario E2E destructif complet

Fichier : `/tmp/browser/e2e_full/script.py` (Playwright headless, deux contextes Alice/Bob).

### Préparation
- Capture screenshots à chaque étape (`screenshots/NN_label.png`).
- Hook `page.on("response", ...)` qui enregistre tous les 4xx/5xx Supabase avec corps de réponse.
- Hook `page.on("console")` pour erreurs front.

### Étapes
1. **Login Alice + Bob** en parallèle (deux `BrowserContext`).
2. **Alice crée un groupe dédié** via `/nouveau` : nom `Tontine E2E <timestamp>`, cotisation 10 000 GNF, 5 membres, hebdomadaire, rotation aléatoire, visibilité « lien partageable ». Récupère le **code d'invitation** dans le wizard final.
3. **Alice copie le code** depuis la page (sélecteur sur le champ code généré).
4. **Bob rejoint** via `/rejoindre`, saisit le code, **coche la case CGU (Phase D)**, valide.
5. **Alice approuve** Bob depuis l'onglet Membres (`/groupes/:id`, bouton Accepter).
6. **Vérifie l'audit** : Alice ouvre l'onglet Audit, vérifie présence d'entrées `member_approved` / `invitation_created`.
7. **Alice → « Gérer les membres »** → suspend Bob avec motif « test e2e suspend ».
   - Assert : badge « Suspendu » + motif visible sur la ligne.
   - Côté Bob : `/notifications` doit montrer une notif `member_suspended` ; tentative d'envoi de message dans `/groupes/:id` chat → bloquée (toast erreur).
8. **Alice réactive Bob**.
   - Assert : badge « Actif » revenu.
   - Côté Bob : notif `member_reactivated` reçue.
9. **Alice promeut Bob co-organisateur** via `/groupes/:id/co-organisateurs` avec `can_suspend_member` + `can_send_announcements`.
   - Assert : card Bob avec matrice ; côté Bob, badge « Co-organisateur » visible dans l'en-tête.
10. **Alice exclut Bob (kick)** avec motif « test e2e kick ».
    - Assert : Bob n'apparaît plus dans la liste active.
    - Côté Bob : notif `member_kicked` ; tentative d'accéder à `/groupes/:id` → redirect ou message d'accès refusé.
11. **Alice → onglet Audit** : vérifie présence d'entrées `member_suspended`, `member_reactivated`, `admin_role_granted` (ou équivalent), `member_kicked` avec motifs.
12. **Cleanup** : Alice archive le groupe via `CycleAdminPanel` (status `cancelled`) pour ne pas polluer.

### Sélecteurs
- Boutons confirmation : `get_by_role("button", name=re.compile(r"confirmer|suspendre|exclure|réactiver|promouvoir", I))`.
- Saisie code : `input[placeholder*="code" i]` ou input visible le plus court sur `/rejoindre`.
- Onglets tabs : `get_by_role("tab", name="...")` avec fallback `locator('button:has-text("...")')`.
- Wait : `page.wait_for_url` ou `wait_for_selector` au lieu de `wait_for_timeout` fixes quand possible.

### Robustesse
- Si une étape échoue, on capture screenshot + on continue les vérifications indépendantes (notifications, audit) pour maximiser l'info.
- Rapport final : tableau ✅/❌ par étape + liste des erreurs réseau 4xx/5xx capturées.

## Livrables

```text
+ db/44_fk_turns_profiles.sql
+ /tmp/browser/e2e_full/script.py
+ /tmp/browser/e2e_full/screenshots/*.png
```

Rapport synthétique en réponse finale après exécution.

## Ordre

1. Créer la migration `db/44_fk_turns_profiles.sql` (utilisateur l'exécute, ou auto via tool de migration).
2. Écrire le script E2E.
3. Lancer le script, itérer si sélecteur cassé.
4. Produire l'audit.
