# Relance d'un nouveau cycle de tontine (opt-in des membres)

## Ce qui existe déjà (vérifié)
- Table `cycles` avec un drapeau `awaiting_renewal`, table `cycle_renewal_votes` (cycle, membre, accord, date) avec unicité par membre.
- Trois fonctions serveur déjà présentes mais **jamais utilisées dans l'application** : marquer un cycle en attente de renouvellement, voter, lister les votes. Aucune interface ne les appelle.
- Limites actuelles : pas de seuil minimum, pas de date limite, pas de notification de fin de délai, et le démarrage d'un cycle n'est possible que si le groupe est en statut « brouillon » ou « ouvert » (donc impossible après un cycle terminé).

## Ce qu'on construit

### 1. Demande de relance (organisateur)
Sur un groupe dont le cycle est terminé, un encart « Relancer une nouvelle tontine » apparaît pour l'organisateur. Il saisit :
- le nombre minimum de participants pour que le cycle soit viable (pré-rempli avec l'effectif du cycle précédent, minimum 2),
- la date limite de réponse (choix rapides : 3 / 7 / 14 jours, ou date personnalisée).

À la validation : le cycle passe en attente de renouvellement, chaque ancien membre reçoit une notification in-app + email/SMS (via la file existante), et le compteur démarre.

### 2. Réponse des membres (opt-in)
Carte dédiée en haut de la page du groupe pour chaque ancien membre :
- rappel des conditions du prochain cycle (montant, fréquence, durée estimée, nombre de tours),
- deux actions claires : « Je participe » / « Je ne participe pas », réponse modifiable tant que le délai court,
- barre de progression temps réel : acceptés / refusés / en attente, plus compte à rebours.

### 3. Lancement (organisateur)
- Dès que le seuil est atteint, ou dès l'expiration du délai, l'organisateur est notifié.
- Il voit la liste définitive des participants confirmés, peut relancer les indécis en un clic, et démarre le nouveau cycle.
- Au démarrage : seuls les membres ayant accepté sont repris, les autres passent en « sorti », les positions et compteurs de retard sont réinitialisés, un nouveau cycle est créé avec de nouveaux tours.
- Si le délai expire sous le seuil : l'organisateur peut prolonger le délai, abaisser le seuil, ou clôturer définitivement le groupe.

### 4. Recalcul du pot et de la rotation (point de vigilance)
- **Pot réajusté en temps réel** : la cagnotte d'un tour vaut cotisation × nombre de participants confirmés. Si le groupe passe de 10 à 7, le pot baisse automatiquement. Un encart de simulation affiche en direct, avant le clic sur « Démarrer le cycle » : nouveau montant du pot par tour, nombre de tours, durée totale estimée, date du dernier tour, et l'écart par rapport au cycle précédent (« pot 12 000 000 → 8 400 000 GNF »).
- **Confirmation explicite** : si le pot diminue de plus de 20 % par rapport au cycle précédent, une confirmation supplémentaire est demandée à l'organisateur, et l'information figure dans la notification de démarrage envoyée aux membres (réassurance et absence de mauvaise surprise).
- **Rotation régénérée** : les rangs sont entièrement recalculés sur les seuls membres confirmés — nouveau tirage au sort si l'ordre est aléatoire, réattribution séquentielle sans trous sinon. Aucun rang du cycle précédent n'est conservé, aucun membre sorti ne peut rester dans le calendrier.
- **Vérification serveur** : le montant du pot et les rangs sont recalculés côté base au moment du démarrage (jamais depuis une valeur envoyée par le client) ; la simulation affichée provient de la même fonction de calcul afin qu'aperçu et résultat soient toujours identiques.

## Analyse UX / psychologie de l'engagement
- **Preuve sociale** : afficher « 7 membres sur 10 ont déjà confirmé » avec avatars des confirmés — l'adhésion visible des pairs est le premier levier de décision dans une tontine.
- **Engagement progressif** : la décision est décomposée (voir le bilan du cycle précédent → consulter les conditions → confirmer), plutôt qu'un bouton isolé.
- **Réassurance financière** : rappel explicite « aucun prélèvement maintenant », bilan personnel du cycle écoulé (total versé, cagnotte reçue, ponctualité), et mention que la place n'est réservée qu'après démarrage validé par l'organisateur.
- **Rareté honnête, pas artificielle** : compte à rebours réel sur la date limite fixée par l'organisateur, jamais de fausse urgence.
- **Aversion à la perte, cadrée positivement** : « Sans réponse avant le [date], votre place sera proposée à un autre membre » — factuel, sans culpabilisation.
- **Réduction de friction** : réponse en un clic depuis la notification et depuis l'email, choix réversible jusqu'à la date limite (le droit de changer d'avis augmente le taux de réponse initial).
- **Continuité et fierté** : mise en avant du bilan collectif du cycle terminé (montant total brassé, taux de ponctualité, score de fiabilité du groupe) comme argument de reconduction.
- **Clarté des notifications** : une relance à mi-parcours et une à J-1, jamais plus ; ton informatif, action unique par message.
- **Transparence de gouvernance** : chaque membre voit qui a confirmé (pas les refus nominatifs, seulement le décompte) — équilibre entre preuve sociale et respect de la décision individuelle.

## Détails techniques
- Migration : ajouter à `cycles` les colonnes `renewal_min_members`, `renewal_deadline`, `renewal_opened_at`, `renewal_closed_at` ; ajouter les types de notification liés au renouvellement.
- Fonctions serveur (SECURITY DEFINER, organisateur uniquement sauf le vote) :
  - `open_cycle_renewal(cycle_id, min_members, deadline)` — remplace l'usage direct de la fonction actuelle, crée les notifications et les entrées SMS/email via les files existantes.
  - `vote_cycle_renewal` — étendue : refus du vote après la date limite, notification à l'organisateur quand le seuil est franchi.
  - `renewal_status(group_id)` — visible par tous les membres : décompte accepté/refusé/en attente, seuil, date limite, mon vote (le listing actuel est réservé à l'organisateur, il reste pour la vue nominative).
  - `start_renewed_cycle(group_id)` — reprend uniquement les votants favorables, sort les autres, remet le groupe en état démarrable et réutilise la logique de démarrage de cycle existante (rotation, tours, échéances, contrat).
  - `extend_cycle_renewal` / `cancel_cycle_renewal`.
  - Tâche planifiée quotidienne : notifier l'organisateur à l'expiration du délai.
- Temps réel : abonnement sur `cycle_renewal_votes` et `cycles` pour rafraîchir le décompte sans rechargement.
- Frontend : `src/lib/api/renewal.ts`, `src/components/group/RenewalPanel.tsx` (vue membre) et `RenewalAdminPanel.tsx` (vue organisateur), branchés dans `src/pages/GroupDetail.tsx` sous le bandeau de statut ; réutilisation des composants existants (progression, compte à rebours, avatars).
- Tests : test SQL de non-régression sur le cycle de vie du renouvellement (seuil atteint, délai expiré, membres exclus) et test E2E Playwright du parcours organisateur → membre → démarrage.
