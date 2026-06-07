# Instrumentation du journal d'audit

Objectif : que toutes les actions sensibles atterrissent dans `audit_log` automatiquement, sans modifier le code front.

## Approche

Une seule migration `db/25_audit_instrumentation.sql` qui **redéfinit (CREATE OR REPLACE)** les 5 RPC concernées en repartant de leur dernière version (db/15 → db/18) et en injectant un appel `perform public.log_audit(...)` au bon endroit. Aucune logique métier modifiée — uniquement des appends.

## Évènements enregistrés

| Action                  | Acteur          | entity_type   | entity_id        | Metadata                                           |
| ----------------------- | --------------- | ------------- | ---------------- | -------------------------------------------------- |
| `start_cycle`           | organisateur    | `cycle`       | `cycle_id`       | `{ members_count, total_turns }`                   |
| `release_payout`        | organisateur    | `turn`        | `turn_id`        | `{ turn_number, gross, fee, net, receipt_id }`     |
| `update_group_settings` | organisateur    | `group`       | `group_id`       | `{ changed_fields: [...] }`                        |
| `approve_member`        | organisateur    | `group_member`| `member_id`      | `{ user_id, full_name }`                           |
| `reject_member`         | organisateur    | `group_member`| `member_id`      | `{ user_id }`                                      |
| `record_payment`        | payeur          | `contribution`| `contribution_id`| `{ amount, penalty_amount, provider, turn_id }`    |

Insertion via `public.log_audit(_group_id, _action, _entity_type, _entity_id, _metadata)` (déjà SECURITY DEFINER, créé en db/24).

## Détails techniques

- Pour chaque RPC : copier l'intégralité du corps de la dernière migration (db/15, db/16, db/17, db/18), insérer `perform public.log_audit(...)` **après succès** (juste avant le `return`).
- `record_mock_payment` log uniquement à la confirmation (status devient `confirmed`), pas pour un paiement encore `pending`.
- `update_group_settings` calcule `changed_fields` en comparant l'ancien et le nouveau JSON.
- Garder `security definer set search_path = public` partout (déjà le cas).
- Pas de changement de signature → aucun impact sur le front.

## Vérification

Après exécution de la migration :
1. Recharger la fiche d'un groupe en tant qu'organisateur, ouvrir l'onglet **Audit** — vide.
2. Faire une action (modifier un paramètre, approuver un membre, etc.) — l'évènement doit apparaître.

## Livrable

- `db/25_audit_instrumentation.sql` (idempotent, à exécuter manuellement dans le SQL Editor).
- Aucune modification front nécessaire.

Confirme et je passe en build.
