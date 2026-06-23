## Objectif

SMS Nimba aux 4 moments clés du cycle, **format opérateur** (style Orange Money / UBA) : une ligne dense, factuelle, avec référence courte et signature de marque. Déclenchement temps réel via triggers DB → Edge Function interne (pas de cron).

## Format SMS — style opérateur financier

Règles strictes inspirées d'OM :
- Pas de saut de ligne, pas d'emoji, pas de point d'exclamation.
- Montants : `9 000 GNF` (espace insécable milliers, unité collée).
- Référence courte type `TD{YYMMDD}.{HHMM}.{6 hex}` — ex `TD260622.2231.B23018`.
- Signature finale invariable : **`Tontine Digitale vous remercie.`** (ou `Tontine Digitale vous informe.` pour les avis non-transactionnels).
- ≤ 320 caractères (2 segments GSM).

## Les 4 SMS

**1. Confirmation au payeur** — `contributions.status → confirmed`
```
Bonjour, votre cotisation de 10 000 GNF pour la tontine "Epargne" (tour #1, beneficiaire Rougui D.) a ete confirmee. 2/3 membres ont cotise. Echeance: 22/06/2026. Ref: TD260622.2231.B23018. Tontine Digitale vous remercie.
```

**2. Avis aux membres restants** — même évènement, destinataires = contributions encore `pending` sur ce tour
```
Bonjour, Kankou S. vient de cotiser pour la tontine "Epargne" (tour #1). Votre cotisation de 10 000 GNF reste due le 22/06/2026. Reglez depuis l application. Ref: TD260622.2231.B23018. Tontine Digitale vous informe.
```

**3. Versement au bénéficiaire** — `turns.status → paid` (via `auto_close_turn`)
```
Bonjour, le tour #1 de la tontine "Epargne" est cloture. Montant credite sur votre solde Tontine Digitale: 30 000 GNF. Demandez votre retrait depuis l application. Ref: TD260623.0815.A91204. Tontine Digitale vous remercie.
```

**4. Cycle terminé** — dernier tour passé `paid`, destinataires = organisateur + co-organisateurs
```
Bonjour, le cycle de la tontine "Epargne" est termine. Tous les versements ont ete effectues. Vous pouvez relancer un cycle, ajuster les regles ou inviter de nouveaux membres depuis l application. Ref: TD260623.0815.A91204. Tontine Digitale vous informe.
```

Caractères : ASCII sans accents (compat GSM-7, évite la facturation Unicode et garantit la lisibilité tous combinés).

## Architecture

```text
contributions.status -> confirmed
  ├─ trg_contribution_auto_close            (existant)
  └─ trg_sms_on_contribution_confirmed      (NOUVEAU)
        └─ pg_net -> send-tontine-sms (kind=contribution_confirmed)
              ├─ SMS 1 au payeur
              └─ SMS 2 aux membres encore pending

turns.status -> paid
  └─ trg_sms_on_turn_paid                   (NOUVEAU)
        └─ pg_net -> send-tontine-sms
              ├─ SMS 3 au beneficiaire
              └─ si dernier tour du cycle :
                  SMS 4 organisateur + co-organisateurs
```

Edge function interne, token partagé `X-Internal-Token`, `verify_jwt = false`. Charge le contexte (nom groupe, prénoms via `profiles.full_name` premier mot, montants, `due_date`, état contributions), appelle `sendMessage()` de `_shared/nimbasms.ts`. Idempotence : garde `OLD.status IS DISTINCT FROM NEW.status` + dédup côté logs.

## Fichiers

**Migration `db/48_sms_lifecycle_triggers.sql`**
- Helper `enqueue_tontine_sms(kind text, payload jsonb)` via `pg_net.http_post` (pattern de `db/21_payment_reminders.sql`).
- Triggers `AFTER UPDATE OF status` sur `contributions` et `turns` avec garde anti-doublon.
- Détection cycle terminé : `NOT EXISTS (select 1 from turns where cycle_id = NEW.cycle_id and status <> 'paid')`.
- Ajout valeur ENUM `cycle_completed` à `notification_kind` si absente.

**Secret** : `TONTINE_SMS_INTERNAL_TOKEN` (généré via `generate_secret`).

**Edge function `supabase/functions/send-tontine-sms/index.ts`**
- `verify_jwt = false`, vérifie `X-Internal-Token`.
- Helpers locaux : `fmtGNF(n)` (espace insécable + ` GNF`), `firstName(name)`, `stripAccents(s)`, `makeRef(prefix='TD')`.
- 4 templates ci-dessus, génération de la `Ref` côté edge function.
- Réutilise `sendMessage`, `normalizeGNPhone`, `logSmsAttempt`, filtre `notification_preferences` (défaut ON).

**UI — `src/pages/NotificationPreferences.tsx`**
- Ajouter ligne SMS "Cycle termine" (kind `cycle_completed`). Aucune autre modif UI.

## Hors scope

- Pas de modification du cron `send-tontine-reminders` (rappels J-2/J-1 conservés, complémentaires).
- Pas de modification schéma `contributions` / `turns` / `groups`.
- Pas de nouveau composant visuel — actions "relancer cycle / inviter / paramètres" déjà disponibles dans `CycleAdminPanel.tsx` et `GroupSettings.tsx`.
