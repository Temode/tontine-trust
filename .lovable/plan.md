# Suivi par membre des appels de tontine

## Objectif
Pendant un appel, l'appelant voit sous chaque membre appelé son état réel : Sonne, Refusé, Indisponible, En ligne, Parti. Cela règle aussi l'appelant qui ne sait pas qu'on a refusé (aujourd'hui il reste sur « Sonnerie en cours » jusqu'à 90 s).

## État constaté
- `call_requests` ne porte que `group_id`, `requested_by` et un `status` global. Aucune liste de destinataires n'est enregistrée.
- `call_participants` (call_id, user_id, joined_at, left_at, is_muted) existe, mais l'app n'appelle jamais `join_call` ni `leave_call`.
- L'appelant ne s'abonne à aucun changement de statut.

## Ce qui sera construit

1. **Liste des appelés figée au lancement.** Une table `call_recipients` (call_id, user_id, status, rang_at, responded_at, reason). `request_group_call` y insère un instantané des membres actifs de la tontine, sans l'appelant.
2. **États par membre** : `ringing` (sonne), `delivered` (le push est arrivé sur l'appareil, quand on peut le savoir), `declined` (refusé), `accepted` (a décroché), `missed` (pas de réponse à 60 s), `unreachable` (aucun appareil enregistré), `left` (a quitté).
3. **Une seule écriture.** `respond_call_request` met à jour la ligne du membre qui répond, depuis l'écran web comme depuis l'écran Android natif. Le statut global de l'appel en découle : refusé seulement si tout le monde a refusé, et l'appel reste en cours tant qu'une personne sonne encore ou est en ligne. Une fois terminé, un état ne peut plus être rouvert (règle déjà en place).
4. **Présence dans l'appel.** On branche `join_call` et `leave_call` à la connexion et à la déconnexion de l'appel. `accepted` passe ensuite à `left` au départ.
5. **Temps réel côté appelant.** L'appelant s'abonne aux lignes de son appel. Écran audio : un état sous chaque vignette (« Sonne… », « A refusé », « Indisponible »). Appel à deux : un refus ferme l'écran et affiche « <Prénom> a refusé l'appel ». Le panneau Membres liste tous les appelés avec leur état.
6. **Confidentialité.** Seuls l'appelant et les membres actifs de la tontine lisent les lignes d'un appel. Chacun ne peut modifier que sa propre ligne, et uniquement via les fonctions prévues.

## Hors périmètre (à arbitrer séparément)
- Délai de 26 à 31 s avant la sonnerie du téléphone (envoi des push par lot chaque minute) : à corriger dans un autre chantier.
- Bouton « accepter en vidéo » : il n'existe pas aujourd'hui.

## Détails techniques
- Migration : `CREATE TABLE public.call_recipients` + GRANT (authenticated select ; service_role all) + RLS + index (call_id). Ajout à la publication `supabase_realtime`.
- Mise à jour de `request_group_call`, `respond_call_request` et de l'expiration à 60 s / 90 s. `unreachable` est posé à l'insertion quand le membre n'a aucun `push_tokens` et aucune présence web.
- Front : `CallContext.tsx` (abonnement à canal unique dans un useEffect, join/leave), `AudioCallStage.tsx` (libellé d'état, mêmes tokens et rôles typographiques), panneau Membres.
- Tests : SQL dans `db/tests/call_recipients.test.sql` (un refus sur trois laisse l'appel en cours ; trois refus le passent à refusé ; un état terminé n'est jamais rouvert ; un non-membre ne lit rien) et mise à jour de `CallContext.test.tsx`.
- `AGENTS.md` : règle « l'état par destinataire vit dans call_recipients ; le statut global en dérive ».
