# Refonte de la messagerie sur les codes de WhatsApp Desktop

## Diagnostic : pourquoi la nôtre fait « exercice d'école »

Comparaison capture WhatsApp / capture Tontine Digitale, sur le même écran (discussion de groupe).

| Ce que fait WhatsApp | Ce qu'on fait aujourd'hui | Effet ressenti |
|---|---|---|
| La conversation occupe **toute** la surface, fond texturé continu | `GroupChat` est une carte `rounded-xl border` de `h-[60vh]` posée dans une page avec `p-4` — une boîte blanche flottante dans une boîte blanche | Vide énorme sous les messages, impression de maquette non finie |
| Bulles compactes, largeur au contenu, ombre douce, coin « queue » du côté auteur | Bulle correcte mais posée sur fond blanc identique → aucun contraste, pas d'ombre | Les messages ne « flottent » pas, aucun rythme visuel |
| Séparateurs de jour (« Aujourd'hui »), groupage par auteur, avatar uniquement sur le dernier message d'une salve | Avatar répété sur **chaque** message, aucun séparateur de date | Bruit visuel, pas de repère temporel |
| Événements d'appel rendus en **carte système** (icône, « Appel vocal · 2 min · 1 personne a rejoint ») | Le lien d'appel est un message texte brut : `Lien d'appel : https://tontinedigitale.com/appel/212e10a3-…` | Amateur : on expose un UUID à l'utilisateur |
| Bandeau épinglé sous le header pour le lien d'appel en cours | Rien | Le lien se perd dans le fil |
| Composer : barre pill pleine largeur, `+`, emoji, champ sans bordure, micro à droite qui devient **avion en papier** dès qu'on tape | Champ rectangulaire bordé + 3 boutons carrés alignés, bouton envoyer toujours visible et désactivé | Look formulaire, pas messagerie |
| Header : avatar, nom, **liste des participants** en sous-titre, caméra / recherche / kebab, séparateur vertical | Avatar initiales, sous-titre « 2 membres · Cycle clôturé », 4 icônes de même poids sans hiérarchie | Aucune identité, aucune hiérarchie |
| Densité typographique maîtrisée (15px corps, 12.5px meta) | 14px partout, meta 10px | Enfantin |

Deux bugs de fond aggravent l'impression : la carte à hauteur fixe `60vh` dans un conteneur déjà `h-full` (double scroll possible + zone morte), et le double cadre (bordure de la section + bordure de la carte).

## Ce qu'on construit

### 1. Surface de conversation plein cadre
- `Messages.tsx` : suppression du padding et du wrapper ; la zone conversation devient `flex-1 min-h-0` et `GroupChat` remplit tout.
- `GroupChat` : plus de `rounded-xl border`, plus de `h-[60vh]` → `h-full`. Fond dédié : nouveau token `--chat-surface` (crème très légère, dans l'esprit sarcelle/or) + motif SVG discret en `background-image` à très faible opacité, comme le papier peint WhatsApp. Un seul scroll.

### 2. Bulles et rythme du fil
- Groupage par auteur **et** par fenêtre de 5 minutes : avatar + nom affichés seulement sur le premier message d'une salve, coins arrondis adaptés (queue uniquement sur le dernier).
- Séparateurs de date centrés en pilule (« Aujourd'hui », « Hier », « 12 juillet »).
- Bulles : largeur au contenu (`max-w-[68%]`), ombre douce, entrantes sur `bg-card`, sortantes sur le sarcelle de la marque avec texte `primary-foreground` (contraste vérifié), heure + accusés intégrés en fin de ligne (float, pas de ligne dédiée) comme WhatsApp.
- Détection des liens dans le corps du message : rendu cliquable, tronqué proprement.

### 3. Messages système d'appel
- Un message dont le corps contient un lien `/appel/<uuid>` n'est plus affiché en texte brut : rendu en **carte d'appel** (icône téléphone dans un rond, titre « Appel de groupe », sous-titre « Lancé par X · il y a N min », bouton « Rejoindre »). L'UUID n'apparaît jamais.
- Même traitement visuel pour un appel terminé (icône barrée, « Appel terminé · durée »).
- Purement présentationnel : le message envoyé garde le même format en base, on le reconnaît côté rendu.

### 4. Bandeau épinglé
Sous le header, bandeau fin (icône épingle + « Appel en cours — Rejoindre », chevron pour masquer) affiché tant qu'un appel du groupe est `pending`/actif. Réutilise la requête `call-requests` déjà présente dans le header.

### 5. Composer façon WhatsApp
Une seule barre pill : `+` (pièce jointe) · emoji · champ auto-grow sans bordure (jusqu'à 5 lignes, `Entrée` envoie, `Maj+Entrée` saute une ligne) · micro à droite qui se **transforme** en bouton d'envoi rond dès qu'il y a du texte ou une pièce jointe. Aperçu de pièce jointe au-dessus de la barre, avec croix.

### 6. Header et liste
- Header : avatar avec vraie photo de groupe si dispo, sous-titre = **prénoms des membres** (« Kankou, Rougui, Vous ») avec repli sur le compte, statut du cycle déplacé en petit badge. Icônes regroupées : appel, vidéo, séparateur vertical, recherche dans la conversation, kebab (historique des appels, détails du groupe, préférences).
- Liste de gauche : hauteur de ligne portée à 72px, aperçu avec préfixe auteur + icône de type (pièce jointe / vocal / appel), pastille non-lus en sarcelle, sélection en surface pleine.

## Détails techniques
- Fichiers touchés : `src/pages/Messages.tsx`, `src/components/group/GroupChat.tsx` (découpé en `MessageBubble`, `DaySeparator`, `CallEventCard`, `Composer` sous `src/components/messages/`), `ConversationHeader.tsx`, `ConversationItem.tsx`, `ConversationsList.tsx`, `src/index.css` (tokens `--chat-surface`, `--chat-bubble-in`, `--chat-bubble-out`, ombre de bulle).
- Aucune modification de schéma, de RPC ni d'Edge Function. `sendGroupMessageV2`, le realtime, les accusés de lecture et tout le système d'appel (`CallContext`, popover, mini-player, PiP) restent inchangés.
- Tokens sémantiques uniquement, pas de couleur en dur ; vérification light/dark.
- Contrôles : build + typecheck, tests unitaires existants, et passe visuelle Playwright sur `/discussions/:id` en desktop et mobile.

## Hors périmètre
Réactions emoji, réponses citées, édition/suppression de message, recherche serveur dans l'historique. À planifier ensuite si vous les voulez.
