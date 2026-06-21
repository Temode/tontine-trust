## Objectif

Compléter l'expérience Discussions avec : conversation realtime déjà existante, pièces jointes (images + PDF), indicateurs de saisie, accusés de lecture serveur (vu / non vu), notifications in-app pour les autres conversations, et architecture UI complète des appels vocaux (boutons actifs, état disponible/occupé, historique) — canal audio désactivé. Tout doit respecter `docs/DESIGN_DOCTRINE.md` (sarcelle/or, font-display, tabular-nums, beaucoup d'air, une seule action primaire).

## 1. Base de données (une seule migration)

### `group_message_reads` — accusés de lecture serveur
- Colonnes : `user_id`, `group_id`, `last_read_at timestamptz`. PK composite `(user_id, group_id)`.
- RPC `mark_group_read(p_group_id uuid)` : upsert `last_read_at = now()` pour l'utilisateur courant si membre actif.
- Remplace le hack `localStorage[chat-last-seen:*]` : non-lus partagés entre appareils.
- Realtime activé (publication `supabase_realtime`).

### `group_messages` — pièces jointes
- Ajouter colonnes nullables : `attachment_url text`, `attachment_type text` (`image/png`, `application/pdf`…), `attachment_name text`, `attachment_size int`.
- Contrainte : `(body <> '' OR attachment_url is not null)` au lieu de l'actuel `length(trim(body))>0` (migration : drop puis recreate).

### `call_requests` — appels vocaux (UI seulement, canal off)
- Colonnes : `group_id`, `requested_by uuid`, `topic text`, `scheduled_at timestamptz null`, `status` (`pending|accepted|declined|cancelled|missed`), `started_at`, `ended_at`, `created_at`.
- RPC `request_group_call(p_group_id, p_topic, p_scheduled_at)`, `respond_call_request(p_id, p_status)`.
- Realtime activé. RLS : visible aux membres actifs du groupe.

### `user_call_presence` — état disponible / occupé / ne pas déranger
- Colonnes : `user_id pk`, `status` enum `available|busy|dnd`, `updated_at`.
- RLS : lecture par membres partageant un groupe, update self uniquement.

### Stockage
- Bucket `chat-attachments` (privé) créé via `supabase--storage_create_bucket`.
- Policy `storage.objects` : upload/read autorisés aux membres du groupe (chemin `{group_id}/{user_id}/{uuid}.{ext}`).

### GRANTs / RLS — appliqués à chaque table conformément à la doctrine.

## 2. Typing indicator (sans table — Realtime broadcast)

- Canal Supabase Realtime `group_typing:{groupId}` avec presence/broadcast.
- Client envoie un broadcast `{ user_id, name }` à chaque keystroke (throttle 1.5 s), stop après 3 s d'inactivité.
- Affiché sous la conversation : « Alice écrit… », « Alice et Bob écrivent… », « 3 personnes écrivent… ».

## 3. Notifications in-app pour autres conversations

- `useChatToasts()` (hook global monté dans `AppShell`) : souscrit à `group_messages` insert sur tous les groupes du user.
- Filtre : si auteur ≠ moi ET (route ≠ `/discussions/{group_id}`) → toast Sonner cliquable :
  - Avatar groupe + nom + extrait du message.
  - Clic → `navigate(/discussions/{group_id})`.
- Mise à jour de la query `["conversations"]` + badge sidebar/bottom-nav.
- Pas de double notification si la conversation est ouverte.

## 4. Pièces jointes (images + PDF)

- Composant `AttachmentPicker` dans le composer (bouton `Paperclip`) :
  - Accept : `image/png,image/jpeg,image/webp,application/pdf`.
  - Limite : 8 Mo.
  - Upload → bucket privé → renvoie path + signed URL (1 h).
- Prévisualisation avant envoi (vignette image ou icône PDF + nom + taille).
- Affichage dans le message :
  - Images : thumbnail max 240×240, clic = lightbox plein écran.
  - PDF : carte avec icône `FileText`, nom, taille, bouton "Télécharger" / "Aperçu" qui ouvre dans nouvel onglet.
- Body texte facultatif si pièce jointe présente.

## 5. Accusés de lecture (vu / non vu) — UI

- Liste conversations : badge or `unread_count` (déjà en place) calculé désormais via `last_read_at` côté serveur.
- Dans la conversation :
  - Sur mes messages : pictogramme `Check` (envoyé) → `CheckCheck` muted (livré) → `CheckCheck` sarcelle (lu par ≥1 autre membre).
  - Ligne « 95 messages non lus » au-dessus du premier message non lu à l'ouverture (comme WhatsApp).
- À l'ouverture / scroll en bas → RPC `mark_group_read` (debounced 1 s).

## 6. Architecture UI appel vocal

- Bouton **« Demander un appel »** actif dans `ConversationHeader` (remplace l'icône `Phone` désactivée).
- Modal `CallRequestDialog` : sujet + maintenant / programmer (date/heure) + envoyer.
- Statut **disponible/occupé** dans le menu utilisateur (sidebar bas) : sélecteur 3 états.
- Pastille de présence sur l'avatar du groupe (vert si ≥1 membre disponible, ambre si tous occupés/DND, gris sinon).
- Nouveau panneau **Historique des appels** dans la conversation (drawer accessible via bouton `Clock` du header) :
  - Liste des `call_requests` : demandeur, sujet, état, date.
  - Boutons "Accepter" / "Refuser" sur les demandes pending qui me sont visibles.
  - Sur acceptation : bandeau d'appel "Appel demandé pour 14:30 — module audio bientôt disponible".
- Sur la fiche conversation, badge "Demande d'appel en attente" si `pending` existe.
- **Aucun WebRTC** : tous les boutons "Rejoindre l'appel" affichent un tooltip "Canal audio bientôt disponible" et un toast info.

## 7. Refonte de la page conversation

- `GroupChat` étendu pour gérer : pièces jointes, typing, séparateur "non lus", accusés de lecture, scroll auto vers premier non lu à l'ouverture.
- Header sticky : avatar + nom + nb membres + pastille présence + boutons `Phone` (actif → modal), `History` (drawer appels), `Info` (route groupe).
- Composer : `Paperclip` + textarea autosize + bouton `Send` (sarcelle), Enter envoie, Shift+Enter saut de ligne.
- Loading : skeletons (pas de spinner), respect doctrine.
- Empty : `EmptyState` "Aucun message — soyez le premier à écrire".

## 8. Fichiers créés

- `supabase/migrations/<ts>_chat_v2_reads_attachments_calls.sql`
- `src/lib/api/chatReads.ts` (mark/get reads)
- `src/lib/api/chatAttachments.ts` (upload + signed URL)
- `src/lib/api/calls.ts` (request/respond/list)
- `src/lib/api/presence.ts` (état utilisateur)
- `src/hooks/useChatToasts.ts`
- `src/hooks/useTypingChannel.ts`
- `src/hooks/useGroupCallRequests.ts`
- `src/components/messages/MessageBubble.tsx` (refactor)
- `src/components/messages/MessageComposer.tsx`
- `src/components/messages/AttachmentPicker.tsx`
- `src/components/messages/AttachmentPreview.tsx`
- `src/components/messages/TypingIndicator.tsx`
- `src/components/messages/UnreadSeparator.tsx`
- `src/components/messages/ReadReceipts.tsx`
- `src/components/messages/CallRequestDialog.tsx`
- `src/components/messages/CallHistoryDrawer.tsx`
- `src/components/messages/PresenceDot.tsx`
- `src/components/messages/PresencePicker.tsx`

## 9. Fichiers modifiés

- `src/components/group/GroupChat.tsx` → refactor en utilisant les nouveaux composants.
- `src/components/messages/ConversationHeader.tsx` → boutons appel actifs, drawer historique, présence.
- `src/components/messages/ConversationItem.tsx` → unread_count basé serveur.
- `src/components/messages/ConversationsList.tsx` → idem.
- `src/lib/api/chat.ts` → `listConversationsForUser` lit `group_message_reads`, types étendus avec attachments.
- `src/pages/Messages.tsx` → mark_group_read on open, intégration drawer.
- `src/components/layout/AppShell.tsx` → monte `useChatToasts`.
- `src/components/layout/DesktopSidebar.tsx` → badge non-lus, sélecteur de présence dans la carte user.

## 10. Validation

1. **Realtime** : Alice envoie un message → Bob (autre session) le voit apparaître < 1 s, sans refresh ; toast in-app si Bob est ailleurs ; badge non-lus de la conversation et de la sidebar incrémenté.
2. **Lecture** : Bob ouvre la conversation → badge tombe à 0 (Alice le voit aussi : `CheckCheck` sarcelle sur son message dans la même seconde).
3. **Pièces jointes** : envoi d'une image → thumbnail + lightbox ; envoi d'un PDF → carte téléchargeable ; refus si > 8 Mo ou type non autorisé.
4. **Typing** : Alice tape → "Alice écrit…" chez Bob ; disparaît 3 s après l'arrêt.
5. **Appels** : Bob clique "Demander un appel" → modal → envoi → Alice voit une demande pending + toast ; drawer historique liste toutes les demandes ; bouton "Rejoindre" affiche tooltip "bientôt disponible" — aucune erreur réseau.
6. **Présence** : Bob bascule en "occupé" → pastille de l'avatar du groupe passe à l'ambre chez Alice en realtime.
7. **Doctrine** : aucune couleur hardcodée, montants/tabular-nums respectés, skeletons (pas de spinner), une seule action primaire par écran, viewport 712px et 1280px OK.
