# Inviter & partager depuis le détail d'un groupe

## Objectif
Permettre à l'organisateur, depuis `/groupes/:id`, de :
1. Copier le **code d'invitation** et le **lien partageable** du groupe.
2. **Inviter par e‑mail** (ouvre le client mail pré‑rempli + lien `mailto:` / `wa.me`).
3. Voir et gérer les **codes existants** (révoquer, générer un nouveau).

Et corriger l'incohérence affichée « 0 membres actifs » alors que le créateur doit déjà être membre actif (organisateur).

## UX sur `GroupDetail.tsx`

Ajouter, juste sous l'en‑tête (et visible **uniquement pour l'organisateur**), une nouvelle section `SectionCard` « Inviter des membres » contenant :

- **Bloc code** : code en grand (`font-mono tracking-wide`), bouton « Copier le code ».
- **Bloc lien** : input lecture seule `https://tontine.digital/join/<code>` + bouton « Copier le lien ».
- **Boutons rapides** : 
  - « Partager par e‑mail » → ouvre `mailto:?subject=...&body=...` pré‑rempli (nom du groupe, montant, fréquence, code, lien).
  - « WhatsApp » → ouvre `https://wa.me/?text=...` pré‑rempli.
  - « Nouveau code » → génère via `createInvitation(groupId)`.
- **Liste compacte des codes** (max 3 récents) avec statut + bouton « Révoquer ».

Ajouter aussi dans l'en‑tête sticky un bouton secondaire « Inviter » (icône `UserPlus`) qui scrolle vers la section, pour la rendre découvrable immédiatement.

Aucun changement de logique métier — réutilise `listGroupInvitations`, `createInvitation`, `revokeInvitation` déjà présents dans `src/lib/api/invitations.ts`.

## Invitation par e‑mail

Pas d'envoi serveur dans cette itération (pas d'infra email configurée). On utilise un `mailto:` riche :

```text
Sujet : Rejoignez la tontine "<nom>"
Corps : 
  Bonjour,
  Je vous invite à rejoindre notre tontine "<nom>".
  • Cotisation : <montant> GNF (<fréquence>)
  • Code : <CODE>
  • Lien : <url>
```

Une note discrète indique : « L'envoi automatique d'e‑mails sera activé prochainement. »

## Correction « 0 membres actifs »

Cause probable : pour les groupes créés avant la mise en place du trigger `on_group_created`, le créateur n'a pas de ligne dans `group_members`. Le trigger existe (`db/02_tontine_schema.sql`), mais les anciens groupes ne sont pas rattrapés.

Ajouter un script SQL `db/08_backfill_organizer_membership.sql` (idempotent) :

```sql
insert into public.group_members (group_id, user_id, role, status, position)
select g.id, g.created_by, 'organisateur', 'active', 1
from public.groups g
where not exists (
  select 1 from public.group_members gm
  where gm.group_id = g.id and gm.user_id = g.created_by
)
on conflict (group_id, user_id) do nothing;
```

À exécuter manuellement dans Supabase SQL Editor. Aucun changement de schéma — uniquement un rattrapage de données.

## Détails techniques

**Fichiers créés**
- `src/components/groups/InvitePanel.tsx` — section autonome (code + lien + actions de partage + liste codes).
- `db/08_backfill_organizer_membership.sql` — rattrapage organisateur.

**Fichiers modifiés**
- `src/pages/GroupDetail.tsx` — montage de `<InvitePanel groupId={grp.id} groupName={grp.name} contribution={grp.contribution_amount} frequency={frequency} />` sous l'en‑tête si `isOrganizer`, et ajout du bouton « Inviter » dans la barre sticky.

**Hors scope**
- Envoi d'e‑mails transactionnels via edge function (à proposer ensuite via Lovable Cloud Emails).
- Génération de QR code (déjà présent dans `InviteMembers`, peut être réutilisé plus tard si besoin).

## Action utilisateur requise
Exécuter `db/08_backfill_organizer_membership.sql` dans le SQL Editor Supabase pour corriger les anciens groupes affichant « 0 membres actifs ».
