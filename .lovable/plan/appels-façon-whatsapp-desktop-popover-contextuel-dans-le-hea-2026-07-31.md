# Appels façon WhatsApp Desktop : popover contextuel dans le header de discussion

## Objectif

Supprimer la friction du lancement d'appel : plus de modale plein écran avec fond sombre, mais un popover compact ancré sous l'icône d'appel du header, avec lancement immédiat en un clic.

## Audit de l'existant

- `ConversationHeader` expose 3 boutons (téléphone, historique, caméra) ; téléphone et caméra ouvrent tous les deux **la même** `CallRequestDialog` — la distinction vocal/vidéo n'existe donc pas aujourd'hui.
- `CallRequestDialog` impose 3 décisions avant l'appel (sujet, maintenant/programmer, test micro) et un bouton ambigu « Tester puis lancer ». C'est le principal point de friction.
- Côté base, `request_group_call(group_id, topic, scheduled_at)` fait sonner **tous** les membres actifs : il n'y a pas de ciblage par personne. Décision retenue : on garde ce comportement, la liste de membres sert d'aperçu du groupe appelé (aucun changement de base).
- Le cycle de vie de l'appel est déjà global (`CallProvider` / `startCall`), donc le popover peut se fermer immédiatement après le lancement sans casser l'appel.

## Analyse UX critique

- Cocher des personnes alors que tout le groupe sonne serait mensonger. La liste sera donc affichée **en lecture** (avatars + noms + compteur « N membres seront notifiés »), sans cases à cocher trompeuses. C'est le seul écart assumé au brief, pour ne pas mentir à l'utilisateur.
- Deux boutons distincts (vocal / vidéo) remplacent le bouton unique ambigu : le mode vidéo est `camOff: false`, le vocal `camOff: true`.
- Le test micro disparaît : le navigateur demande l'autorisation en entrant dans l'appel, et les sélecteurs de périphériques restent disponibles pendant l'appel. Si l'autorisation est refusée, un toast explicite le rappelle.
- Actions secondaires en liens discrets, pas en boutons : hiérarchie visuelle nette (primaire = appeler).

## Ce qui sera construit

### 1. `CallLauncherPopover` (nouveau composant)

Popover shadcn ancré sous le bouton d'appel, largeur ~320 px, sans overlay bloquant :

- **En-tête** : avatar/initiales + nom du groupe, sous-titre « Membres notifiés ».
- **Corps** : liste défilante (max ~200 px) des membres actifs avec avatar, nom, organisateur repéré. Squelettes pendant le chargement.
- **Actions** : deux boutons côte à côte — `Appel vocal` et `Appel vidéo`. Un clic crée la demande d'appel et entre immédiatement dans la salle LiveKit via `startCall`, popover fermé instantanément, toast d'erreur si la création échoue.
- **Actions secondaires** : « Envoyer un lien d'appel dans le groupe » et « Planifier un appel », en liens texte avec icônes.

### 2. Lien d'appel + nouvelle route `/appel/:callId`

- Le lien crée une demande d'appel puis poste dans le tchat du groupe un message contenant `https://<domaine>/appel/<callId>`.
- Nouvelle page `CallJoin` : vérifie l'accès via les règles existantes, rejoint la salle LiveKit et renvoie vers la discussion. Message lisible si l'appel est terminé ou inaccessible.

### 3. Planification

Petite vue en deux temps **à l'intérieur du popover** (pas de nouvelle modale) : sujet facultatif + date/heure, boutons Retour / Programmer. Utilise la RPC existante avec `scheduled_at`.

### 4. Header

- Le bouton téléphone ouvre le popover ; le bouton caméra lance directement un appel vidéo (raccourci, comme WhatsApp).
- Suppression de `CallRequestDialog` une fois tous ses appelants migrés.

## Détails techniques

- `Popover` shadcn (`modal={false}`) pour garder le fil visible et le scroll actif.
- Membres via `listGroupMembers(groupId)` filtrés sur `status = 'active'`, en React Query avec `staleTime` court.
- Lancement : `requestGroupCall(groupId, "", null)` → `startCall({ callId, groupId, groupName, prefs: { micMuted: false, camOff: <vocal>, screenShare: false }, manageLifecycle: true })`.
- Lien : `sendGroupMessage(groupId, texte)` déjà disponible.
- Route ajoutée dans `App.tsx` sous le shell authentifié, avec `RouteBoundary`.
- Responsive : sur mobile largeur `w-[min(20rem,calc(100vw-1.5rem))]`, cibles tactiles ≥ 40 px, tokens du design system uniquement.
- Aucun changement de base de données.