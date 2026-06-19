## Audit de la logique tontine actuelle

J'ai relu le moteur de rotation (`start_cycle`, `release_payout`), les vues exposées au front (`next_turn_per_group`, `my_contributions_due`, `turn_settlement`) et les cartes d'accueil (`DuesCard`, `UpcomingTurnsCard`, `DeadlinesList`). Voici ce qui se passe réellement, et pourquoi vous avez vu « Moïse → Moussa » d'un jour à l'autre.

### Ce que fait l'app aujourd'hui

1. **Tous les tours du cycle sont créés d'avance.** Au démarrage du cycle, `start_cycle` insère immédiatement **N tours** (un par membre actif) avec des `due_date` figées : tour 1 = aujourd'hui + intervalle, tour 2 = +2 intervalles, etc. En même temps, **toutes les contributions de tous les tours sont créées en statut `pending`**.
2. **Le tour suivant ne dépend PAS du paiement du tour précédent.** Les dates sont calendaires. Si personne ne paie le tour 1, le tour 2 arrive quand même à sa date. Aucun verrou n'attend le règlement.
3. **Aucun avancement automatique du statut.** Seul `release_payout` (clic manuel de l'organisateur) peut passer un tour à `paid`. Aucun mécanisme ne fait passer le tour suivant en `collecting` une fois le précédent versé — il reste en `upcoming`, mais il est déjà visible et déjà associé à une contribution due.
4. **La vue `my_contributions_due` remonte les contributions de TOUS les tours `upcoming` + `collecting`.** Donc dès que la `due_date` du tour 2 se rapproche (en fréquence quotidienne, c'est le lendemain), la cotisation du tour 2 apparaît dans la carte « À payer » du dashboard, **même si la cotisation du tour 1 n'a pas été réglée**.
5. **La carte « Prochaines échéances » affiche le bénéficiaire**, pas le payeur. « Moïse » puis « Moussa » correspondent aux personnes qui *reçoivent* la cagnotte, pas à celles qui doivent verser. Le libellé peut prêter à confusion.

### Pourquoi vous avez vu Moïse hier puis Moussa aujourd'hui

Dans une tontine quotidienne, `start_cycle` crée immédiatement tous les tours espacés d'1 jour. Le tour 1 (bénéficiaire Moïse) est `collecting` avec échéance demain ; le tour 2 (bénéficiaire Moussa) est `upcoming` avec échéance après-demain. Le lendemain, la vue affiche déjà les **deux** tours, et puisqu'elle est triée par date, le tour 2 devient visiblement « actif » sans que le tour 1 ait été soldé. Ce n'est **pas** le fonctionnement d'une vraie tontine rotative.

### Verdict tontine

❌ **La règle d'or d'une tontine n'est pas respectée :** *« le tour N+1 ne commence que lorsque le tour N a été intégralement collecté et versé au bénéficiaire »*. Aujourd'hui les tours avancent au calendrier, indépendamment de l'état des paiements. C'est pratique pour tester, mais ce n'est pas conforme à la promesse fonctionnelle.

D'autres écarts secondaires : pas de réouverture/clôture automatique d'un tour, pas de blocage si retard, terminologie UI (« qui reçoit » vs « qui paie ») ambiguë, pénalités calculées mais non bloquantes.

---

## Plan de correction proposé

### 1. Verrou métier : un seul tour ouvert à la fois
- Modifier `start_cycle` pour ne créer que **le tour 1** en `collecting` (+ ses contributions). Les tours suivants sont conservés comme planning (`turns` rangée `upcoming` SANS contributions), ou pas créés du tout — on les génère à la volée.
- Ajouter une RPC `advance_cycle(_group_id)` appelée automatiquement à la fin de `release_payout` :
  - marque le tour courant `paid` (déjà fait),
  - **crée les contributions** du tour suivant,
  - passe ce tour en `collecting`,
  - recalcule sa `due_date = today + intervalle` (date réelle, pas date théorique).
- Conséquence : si l'organisateur ne verse pas le tour 1, le tour 2 n'apparaît jamais dans « À payer ». ✅ Logique tontine respectée.

### 2. Vue `my_contributions_due` resserrée
- Filtrer sur `t.status = 'collecting'` uniquement (au lieu de `upcoming` + `collecting`). Une contribution n'apparaît dans « À payer » que si son tour est réellement ouvert.

### 3. Clarifier l'UI « qui paie / qui reçoit »
- Dans `UpcomingTurnsCard` : remplacer le titre par « Prochain bénéficiaire » et le sous-titre par `Tour #N · {nom} reçoit le {date}`.
- Dans `DuesCard` : ajouter explicitement `Pour {beneficiary_name} · tour #{n}` sous le nom du groupe.
- Dans `TurnsTimeline` et `GroupDetail` : badge « Bénéficiaire » à côté du nom, jamais « doit payer ».

### 4. Gestion retard
- Si la `due_date` du tour `collecting` est dépassée et que des contributions restent `pending`, afficher un bandeau « Tour en retard — relancer les membres » à l'organisateur, sans laisser apparaître le tour suivant.
- Option : RPC `force_close_turn` réservée à l'organisateur pour conclure manuellement un tour incomplet (avec audit).

### 5. Mode test cohérent
- Le `TestModePanel` existant doit appeler `advance_cycle` après simulation de paiement, pour valider visuellement le passage Moïse → Moussa **uniquement après** versement.

### Détails techniques (pour mémoire)

```text
turns lifecycle (cible)
  upcoming  ──┐
              ▼
          collecting ──release_payout──► paid ──advance_cycle──► (tour suivant: collecting)
```

Fichiers/objets impactés :
- SQL : nouvelle migration — réécriture de `start_cycle`, nouvelle `advance_cycle`, modification de `release_payout` (appel `advance_cycle`), réécriture de la vue `my_contributions_due`, recalcul `due_date`.
- Front : `UpcomingTurnsCard`, `DuesCard`, `DeadlinesList`, `TurnsTimeline`, `GroupDetail` (libellés), `TestModePanel` (utilise la nouvelle RPC).

### Hors scope (à confirmer)
- Migration des groupes existants : faut-il rétro-fitter les tours déjà créés ? Je propose un script idempotent qui passe tous les tours `upcoming` à `cancelled` puis régénère à la volée, mais à valider.
- Auto-versement Djomy quand toutes les contributions sont confirmées (aujourd'hui c'est manuel) — peut être ajouté dans la foulée si vous voulez une rotation 100% automatique.

Souhaitez-vous que j'implémente ce plan tel quel, ou voulez-vous ajuster (notamment le hors-scope) avant ?