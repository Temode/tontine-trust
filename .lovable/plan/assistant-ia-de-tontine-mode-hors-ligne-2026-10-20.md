# Assistant IA de tontine + mode hors ligne

## 1. Assistant « Conseiller Tontine » (Premium)

**Ce que voit le membre**
- Sur la page d'une tontine, un nouvel onglet « Assistant ». Il contient une seule discussion par tontine, qui est conservée.
- Le membre pose ses questions : « Quand est mon tour ? », « Combien je dois encore ? », « Pourquoi ai-je une pénalité ? », « Que se passe-t-il si je paie en retard ? ».
- L'assistant répond en français, simplement, à partir des règles du groupe et des cotisations du membre. Il cite les montants en GNF et les dates.
- Les non-abonnés voient l'onglet avec un cadenas et un bouton « Passer à Premium » qui mène à /abonnement.
- L'assistant ne lit que les données du membre qui pose la question et de son groupe. Il ne voit jamais les données privées des autres membres (téléphone, solde). Il n'exécute aucun paiement : c'est un conseiller en lecture seule.

**Données utilisées par l'assistant** (préparées par le serveur à chaque question)
- Les règles du groupe : montant, fréquence, mode de rotation, pénalités de retard, caution, échange de tours, frais.
- Le cycle en cours, le calendrier des tours et le prochain bénéficiaire.
- Les cotisations du membre : payées, en attente, en retard, pénalités.
- Son score de fiabilité et son solde.

## 2. Mode hors ligne

**Ce que voit le membre**
- Sans Internet, l'app ouvre quand même les dernières informations chargées : ses tontines et leur calendrier, ses cotisations et reçus, son solde et les discussions du groupe.
- Un bandeau discret indique « Hors ligne — données du 20/10 à 14:32 ».
- Les actions qui ont besoin du réseau (payer, envoyer un message, poser une question à l'assistant) sont désactivées, avec une explication.
- Les données sont effacées à la déconnexion.
- Cela fonctionne dans l'app mobile et sur le site déjà ouvert. Une ouverture à froid du site sans réseau ne marche que sur le site publié, jamais dans l'aperçu.

## Détails techniques

**Base de données** (une migration)
- `group_assistant_messages` : id uuid, group_id, user_id, role ('user'|'assistant'), parts jsonb, created_at. GRANT authenticated/service_role, RLS : le membre lit et écrit seulement ses propres lignes, et seulement s'il est un membre actif du groupe.
- Une fonction `assistant_context(p_group_id)` (security definer, vérifie l'appartenance au groupe) renvoie un JSON avec les règles, le cycle, les tours, les cotisations, le score et le solde du membre appelant.

**Fonction serveur `tontine-assistant`**
- Vérifie la connexion, l'appartenance au groupe et l'abonnement Premium/Business actif (`user_subscriptions`). Sinon, renvoie 403.
- Lit l'historique, appelle `assistant_context`, puis fait un `streamText` via AI SDK vers `/v1/responses` avec le modèle `openai/gpt-6-astra`, reasoning low, store:false. Le contexte est injecté dans les instructions système.
- Les messages sont enregistrés dans `onFinish`. Les erreurs 402/429/403 sont relayées avec leur message.
- Ajout de `LOVABLE_API_KEY` s'il manque.

**Interface**
- Composants AI Elements (Conversation, Message, MessageResponse, PromptInput) dans `GroupAssistant.tsx`, avec `useChat` et l'id = groupId. Identité visuelle : sceau Tontine Digitale.
- Accès Premium via `useEntitlements`.

**Hors ligne**
- Persistance du cache React Query dans IndexedDB (`@tanstack/react-query-persist-client` + `idb-keyval`), limitée aux clés groupes/tours/cotisations/reçus/solde/messages, avec une conservation de 7 jours. Le cache est vidé à la déconnexion.
- `networkMode: 'offlineFirst'` et un hook `useOnlineStatus` qui affiche le bandeau et désactive les actions réseau.
- Le site publié s'ouvre sans réseau grâce à `vite-plugin-pwa` (generateSW, NetworkFirst pour les pages, /~oauth exclu), avec un enregistrement protégé : jamais en dev, jamais dans l'aperçu ou un iframe, et coupure possible avec `?sw=off`. Dans l'app mobile, les fichiers sont déjà présents sur le téléphone.

**Tests**
- Test SQL : un non-membre ne peut pas appeler `assistant_context` et ne voit pas les messages d'un autre membre.
- Test vitest : la règle d'accès Premium.
- Vérification de bout en bout : une vraie question posée sur une tontine de test.
