## Diagnostic

Moussa's call est bien créé en base (j'ai vérifié : la ligne `call_requests` est passée de `pending` → `ended`). Donc l'insertion réussit. Le problème vient **du côté réception (Moïse)** :

1. **Pas de sonnerie du tout** — Le code actuel (`IncomingCallSheet`) ouvre simplement une boîte de dialogue silencieuse. Aucun fichier audio n'est joué. Si l'onglet de Moïse est en arrière-plan, il ne voit/n'entend rien.
2. **`useIncomingCalls` ne s'abonne que dans `AppShell`** (routes protégées). Si Moïse est sur `/auth`, sur une page publique, ou pas connecté, il ne reçoit aucun event.
3. **Souscription instable** — l'effet a `dismissed` et `current?.id` dans ses dépendances, donc le canal Realtime est détruit/recréé à chaque update local → fenêtre de quelques ms pendant laquelle un INSERT peut être manqué. Le nom de canal (`"incoming-calls"`) est aussi statique et peut entrer en conflit.
4. **Aucune notification système** — pas d'utilisation de l'API `Notification` du navigateur, donc même un onglet en arrière-plan reste muet.
5. **Pas de fallback toast** — si la modale est bloquée pour une raison X, aucun signal visible.

## Plan de correction

### 1. Ringtone audible (priorité 1)
- Ajouter un asset `public/sounds/incoming-call.mp3` (boucle douce ~3s, style TONTINE — cloche feutrée).
- Dans `IncomingCallSheet`, créer une ref `<audio loop>` lancée dès que `current` devient non-nul, arrêtée à l'acceptation/refus/timeout.
- Respecter les politiques d'autoplay : si `play()` rejette, fallback sur vibration (`navigator.vibrate`) + toast persistant sonner.

### 2. Notification navigateur (onglet en arrière-plan)
- Demander la permission `Notification` au premier login (bouton discret dans le header Messages, comme pour le micro).
- Quand un INSERT arrive et que `document.hidden`, déclencher une `new Notification("Appel entrant – {groupe}", { body, requireInteraction: true, tag: callId })`.
- Click sur la notification → focus de l'onglet + ouvre la modale.

### 3. Robustesse de la souscription Realtime
- Refactor `useIncomingCalls` :
  - Sortir `dismissed` et `current` des dépendances de l'effet (utiliser des refs).
  - Nom de canal unique : `incoming-calls:${user.id}`.
  - Ajouter un log de statut (`channel.subscribe((status) => …)`) pour détecter `CHANNEL_ERROR` / `TIMED_OUT`.
  - Au montage, faire un **catch-up** : `SELECT call_requests WHERE status='pending' AND group_id IN (mes groupes) AND created_at > now() - 60s AND requested_by != me` — couvre les events ratés pendant un reload.
- Re-souscrire automatiquement après reconnexion réseau (`window.addEventListener("online")`).

### 4. Toast de secours
- En plus de la modale, afficher un `sonner` toast non-dismissable ("📞 Appel entrant de Moussa — Rejoindre / Refuser") avec actions, au cas où la `Dialog` ne s'affiche pas (route bloquante, autre modale ouverte).

### 5. Indicateur côté émetteur
- Dans `CallRequestDialog`, après création de l'appel, afficher un état "Sonnerie en cours… X membres connectés / Y au total" basé sur `user_call_presence` ou un compteur de répondants. Permet à Moussa de savoir si Moïse a au moins reçu le ping.

### 6. (Optionnel, phase 2) Notifications push hors-ligne
- Service Worker + Web Push (VAPID) pour faire sonner même app fermée. Plus complexe — à décider après les fixes 1-5.

## Fichiers impactés
- **Nouveau** : `public/sounds/incoming-call.mp3` (ou généré), `src/hooks/useIncomingCallRingtone.ts`, `src/hooks/useBrowserNotificationPermission.ts`.
- **Modifié** : `src/hooks/useIncomingCalls.ts` (stabilité + catch-up), `src/components/messages/IncomingCallSheet.tsx` (ringtone + notif + toast fallback), `src/components/messages/CallRequestDialog.tsx` (indicateur de réception), `src/components/layout/AppShell.tsx` (montage déjà OK, vérifier qu'il englobe bien toutes les routes loguées).

## Questions
- OK pour générer un son de sonnerie (cloche douce style TONTINE) ou tu préfères fournir un fichier ?
- On garde le scope sur les fixes 1-5 et on reporte les push notifications (point 6) à plus tard ?
