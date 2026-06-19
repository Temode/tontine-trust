
# Modification de la configuration d'une tontine

## Objectif

L'organisateur (admin) doit pouvoir réviser les paramètres d'un groupe à deux moments clés, comme dans une vraie tontine :

1. **Avant le démarrage** du tout premier cycle (`status = draft` ou `open`) — tout est modifiable.
2. **Entre deux cycles**, c.-à-d. quand le cycle précédent est clôturé (`cycles.ended_at IS NOT NULL` pour tous les cycles) et qu'aucun nouveau n'a démarré — tout est modifiable, avec confirmation explicite et notification des membres.
3. **Pendant un cycle actif**, seuls les champs « cosmétiques » et non structurants restent modifiables (voir tableau).

## Règles métier (esprit tontine)

| Champ | Avant 1er cycle | Entre cycles | Pendant un cycle |
|---|---|---|---|
| Nom, description, catégorie, visibilité | Oui | Oui | Oui |
| Co-organisateurs | Oui | Oui | Oui (ajout seulement) |
| Pénalité de retard (%, délai) | Oui | Oui | Non (gel) |
| Montant de cotisation | Oui | Oui (avec consentement) | **Non** |
| Fréquence | Oui | Oui (avec consentement) | **Non** |
| Nombre max de membres | Oui | Oui (≥ membres actuels) | **Non** |
| Type de rotation | Oui | Oui | **Non** |

Tout changement structurel entre deux cycles déclenche :
- une entrée dans `audit_log` (acteur, anciennes/nouvelles valeurs) ;
- une notification à chaque membre actif (`notifications`) ;
- un enregistrement dans `group_consent_log` quand le montant/la fréquence/la rotation change, pour traçabilité « digne d'une tontine digitale ».

## Backend (migration SQL)

1. **Nouvelle fonction `public.group_edit_window(_group_id)`** retournant `('pre_cycle' | 'between_cycles' | 'in_cycle' | 'locked')` en se basant sur `groups.status` + existence d'un `cycles` avec `ended_at IS NULL`.
2. **Refonte de `update_group_settings(_group_id, _payload)`** :
   - Lit la fenêtre d'édition.
   - `pre_cycle` / `between_cycles` : applique tous les champs autorisés ; vérifie que `max_members ≥ count(group_members actifs)`.
   - `in_cycle` : n'accepte que `name`, `description`, `category`, `visibility`, co-organisateurs ; lève `STRUCTURAL_CHANGE_FORBIDDEN` sur les autres.
   - `locked` (completed/cancelled) : lève `GROUP_LOCKED`.
   - Insère dans `audit_log` avec diff JSON, et dans `group_consent_log` pour les champs sensibles entre cycles.
   - Notifie les membres via `notifications` (titre : « Paramètres du groupe mis à jour »).
3. Conservation des erreurs typées existantes (`AUTH_REQUIRED`, `FORBIDDEN`, …) + ajouts `STRUCTURAL_CHANGE_FORBIDDEN`, `MAX_MEMBERS_TOO_LOW`, `GROUP_LOCKED`.

## Frontend (`src/pages/GroupSettings.tsx` + API)

1. `getGroupEditWindow(id)` via nouvelle RPC, affiché en bandeau en haut de la page :
   - **Pré-cycle** : bandeau vert « Configuration libre ».
   - **Entre cycles** : bandeau orange « Vous êtes entre deux cycles — toute modification structurelle sera notifiée aux membres et nécessitera leur consentement au prochain démarrage ».
   - **En cycle** : bandeau gris « Cycle en cours — seuls le nom, la description et la visibilité peuvent être modifiés ».
2. Désactivation conditionnelle (`disabled` + icône cadenas + tooltip) sur les champs structurants quand la fenêtre est `in_cycle`.
3. Pour les champs structurants modifiés en `between_cycles`, ouvrir un `AlertDialog` de confirmation qui récapitule le diff et coche « Je comprends que les membres seront notifiés ».
4. Mise à jour de `UpdateGroupSettingsPayload` et de la table de libellés d'erreurs (`UPDATE_ERROR_LABELS`) pour les nouveaux codes.
5. Ajout d'un petit `EditHistoryPanel` (lecture des dernières entrées `audit_log` filtrées sur `update_group_settings`) sous le formulaire, visible par l'organisateur uniquement.

## Hors périmètre

- Vote des membres pour valider un changement structurel (à proposer plus tard si besoin) ; pour l'instant on se contente du consentement journalisé + notification.
- Démarrage du cycle suivant : déjà couvert par les actions existantes.

## Vérifications

- Test manuel des trois fenêtres (draft, in-cycle, between-cycles) sur un groupe de démo.
- `bunx vitest run src/test/tontine-invariants.test.ts` doit toujours passer.
