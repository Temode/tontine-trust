## Objectif

Créer une page **Discussions** de premier niveau (style WhatsApp) accessible depuis le menu principal, permettant à un membre de basculer rapidement entre toutes ses tontines et de discuter avec ses cercles. La fonctionnalité chat existe déjà côté backend (`group_messages` + Realtime via `db/19_group_chat.sql`, composant `GroupChat`, API `src/lib/api/chat.ts`) — il s'agit d'une refonte UX/navigation, pas d'un nouveau backend.

## 1. Nouvelle route & navigation

- Ajouter `/discussions` et `/discussions/:groupId` dans `src/App.tsx` (lazy-loaded `Messages.tsx`).
- **Sidebar desktop** (`DesktopSidebar.tsx`) : ajouter une entrée "Discussions" (icône `MessageCircle`) dans la section Essentiel, juste après "Mes tontines", avec un badge de messages non lus.
- **Bottom-nav mobile** (`BottomNav.tsx`) : remplacer "Payer" par "Discussions" (5 entrées : Accueil, Tontines, Créer, **Discussions**, Payer reste accessible via le dashboard et `/cotisations`). Alternative à valider : ajouter une 5e entrée. → Retenu : remplacer "Payer" pour rester à 4 entrées + bouton central, car la doctrine demande "une seule action primaire" et "Payer" est déjà sur l'accueil via `DueCard`.

## 2. Page Messages (`src/pages/Messages.tsx`)

Layout deux-colonnes inspiré WhatsApp, conforme à `docs/DESIGN_DOCTRINE.md` (sarcelle + or, beaucoup d'air, `font-display`, tabular-nums, pas d'emoji décoratif) :

```text
┌──────────────────────┬─────────────────────────────────┐
│ Discussions          │ [Avatar] Famille Moussa         │
│ [recherche compacte] │ 12 membres · Cycle actif        │
│ [Toutes][Actives][Non│─────────────────────────────────│
│  lues]               │                                 │
│──────────────────────│        zone messages            │
│ ● Famille Moussa  3  │       (GroupChat existant)      │
│   Bob: J'ai payé… 14:│                                 │
│ ○ Tontine Bureau     │                                 │
│   Alice: Merci   12: │─────────────────────────────────│
│ ○ Voisinage          │ [+] [Entrez un message…] [Send] │
└──────────────────────┴─────────────────────────────────┘
```

**Colonne gauche — `ConversationsList`** (nouveau composant `src/components/messages/ConversationsList.tsx`) :
- En-tête : titre `Discussions` (font-display), bouton "Nouveau" (lien vers `/nouveau`).
- Recherche compacte (`h-9`) filtrant par nom de groupe.
- Onglets `Toutes / Actives / Non lues` (pills sarcelle, pas ALL CAPS).
- Liste des tontines du membre, triées par `last_message_at desc` puis `updated_at`. Pour chaque ligne :
  - Avatar (initiales sur fond sarcelle si pas d'`image_url`),
  - Nom du groupe (`text-sm font-semibold`),
  - Dernier message tronqué + auteur (`text-xs text-muted-foreground`),
  - Heure relative (HH:mm si aujourd'hui, sinon date courte, `tabular-nums`),
  - Badge or `bg-accent text-accent-foreground` avec compteur de non-lus.
- État sélectionné : bandeau gauche sarcelle 3px + fond `secondary`, conforme au pattern sidebar existant.
- Empty state via `EmptyState` réutilisable.

**Colonne droite — conversation active** :
- En-tête sticky : avatar groupe, nom, sous-titre (`N membres · Cycle actif|En pause`), cluster icônes `gap-3` : `Phone` (désactivé, tooltip "Bientôt disponible — Appels vocaux"), `Video` (désactivé, même tooltip), bouton info qui ouvre la page du groupe.
- Corps : réutiliser le composant existant `<GroupChat groupId={…} />` sans le modifier (il gère déjà Realtime + scroll + auteur).
- Sur mobile (`<lg`) : afficher soit la liste soit la conversation (drilldown via route `/discussions/:groupId`), avec bouton retour `ArrowLeft` en en-tête.

**Empty state global** (aucune tontine) : illustration `MessageCircle`, titre "Aucune discussion", CTA "Créer une tontine" + "Rejoindre une tontine".

## 3. Compteurs de non-lus & dernier message

Ajout d'une nouvelle requête côté client (sans nouvelle migration nécessaire dans cette première itération) :

- `src/lib/api/chat.ts` → nouvelle fonction `listConversationsForUser()` qui fait :
  1. `select id, name, image_url, status, member_count from groups` joint via `group_members where user_id = auth.uid() and status = 'active'`.
  2. Pour chaque groupe : récupère le dernier `group_messages` (`order by created_at desc limit 1`) avec auteur.
  3. Calcule `unread_count` côté client en comparant `created_at > localStorage[chat-last-seen:{groupId}]`.
- À l'ouverture d'une conversation, écrire `localStorage[chat-last-seen:{groupId}] = new Date().toISOString()` et invalider la query.
- Souscription Realtime globale sur `group_messages` filtrée sur les groupes du user pour rafraîchir la liste sans reload (incrémente le badge, remonte la conversation en tête).

> Note : un vrai compteur serveur (`group_chat_reads` table + RPC) pourra être ajouté dans une itération suivante si l'UX localStorage devient limitante (multi-appareils). Cette étape n'est pas dans ce ticket pour éviter une migration DB.

## 4. Appels vocaux/vidéo — préparation visuelle uniquement

Conformément à la demande "plutard nous aussi on doit integré l'appel vocal" :
- Boutons `Phone` et `Video` présents dans l'en-tête de conversation mais `disabled` avec tooltip "Appels vocaux — bientôt disponible".
- Aucun backend ni intégration WebRTC dans ce ticket.

## 5. Fichiers touchés

**Créés**
- `src/pages/Messages.tsx`
- `src/components/messages/ConversationsList.tsx`
- `src/components/messages/ConversationItem.tsx`
- `src/components/messages/ConversationHeader.tsx`
- `src/components/messages/EmptyConversation.tsx`

**Modifiés**
- `src/App.tsx` (2 nouvelles routes)
- `src/components/layout/DesktopSidebar.tsx` (entrée Discussions + badge)
- `src/components/layout/BottomNav.tsx` (remplacer Payer par Discussions)
- `src/lib/api/chat.ts` (ajout `listConversationsForUser` + `subscribeUserConversations`)

**Non modifiés** : `GroupChat.tsx` (réutilisé tel quel), `db/19_group_chat.sql`, schémas, RLS.

## 6. Validation

1. `/discussions` charge la liste des tontines du user, triée par dernier message.
2. Cliquer sur une tontine ouvre le chat existant sans recharger.
3. Sur mobile (712px), la liste seule est visible ; cliquer ouvre `/discussions/:id` plein écran avec retour.
4. Un nouveau message reçu d'une autre tontine fait remonter celle-ci en tête et incrémente le badge sans refresh.
5. La sidebar desktop affiche le badge cumulé de non-lus.
6. Les boutons appel sont visibles mais disabled avec tooltip explicite.
7. Tokens couleur respectés (sarcelle/or), `tabular-nums` sur les heures, aucune couleur hardcodée.
