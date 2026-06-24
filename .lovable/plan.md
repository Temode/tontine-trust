## Pourquoi Rougui a pu retirer immédiatement alors que la règle existe

La règle « +7 j de blocage si retard » est bien implémentée (voir ma réponse précédente), mais **elle ne s'est pas déclenchée pour Rougui** à cause de la chaîne en amont. Voici l'audit factuel.

### Ce que disent les données

**Cycle « Epargne » — fréquence quotidienne**

| Tour | Bénéficiaire | Payeur | Échéance | Confirmé le | Retard |
|------|--------------|--------|----------|-------------|--------|
| 1 | Rougui | Hadja Kankou | 22/06 | 22/06 00:02 | non |
| 1 | Rougui | Elhadj Mamadou | 22/06 | 21/06 23:28 | non |
| 1 | Rougui | **Rougui** | 22/06 | **24/06 21:44** | **+2 j** |

- `turns.paid_at` = 24/06 21:44
- `turns.payout_hold_until` = 24/06 21:44 (= `paid_at + 0 j`)
- `group_members.was_late_in_cycle` (Rougui) = **false**

→ Au moment où `auto_close_turn` a fermé son tour, le flag retard valait `false`, donc `compute_hold_until` a appliqué `standard_days=0` (quotidienne) + `0 j` de pénalité = libération immédiate. Elle a pu demander son retrait.

### Pourquoi le flag est resté à false

`was_late_in_cycle` n'est pas calculé en direct au moment du paiement. Il est posé **uniquement par le cron `enqueue_payment_reminders`** (cf. `db/26_notification_preferences.sql` + migration `20260623030227`), qui scanne les cotisations en retard à J+1 et met à jour le flag.

Or dans le cas Rougui :
1. Échéance : 22/06.
2. Sa cotisation est restée `pending` du 22 au 24/06.
3. La validation manuelle a probablement été faite **avant** que le cron ne flague son retard (et le cron ignore les `confirmed`).
4. `auto_close_turn` s'est exécuté juste après → flag toujours `false` → aucun hold.

Bref, la règle existe mais **la détection du retard est asynchrone** et ne couvre pas le cas où l'admin confirme une cotisation tardive avant le passage du cron.

### Ce qu'il faut décider

Trois options possibles — dis-moi laquelle tu veux :

**(A) Détection synchrone du retard à la confirmation**
À chaque passage d'une cotisation en `confirmed`, comparer `confirmed_at` (ou `submitted_at`) à `due_date` et poser `was_late_in_cycle = true` immédiatement. Le hold s'appliquera donc systématiquement, même pour les confirmations admin tardives. Recommandé.

**(B) Recalcul du hold après auto_close**
Garder la détection cron, mais permettre de **prolonger un hold a posteriori** si on découvre un retard rétroactif (et notifier le bénéficiaire). Plus complexe, surtout si la personne a déjà retiré.

**(C) Ne rien changer**
On considère que les retards confirmés rapidement par l'admin ne « comptent pas ». C'est la situation actuelle.

### Cas Rougui en particulier

Son retrait est déjà parti et son solde est à 0. Aucune correction rétroactive n'est applicable (sauf à ouvrir une dette/régularisation manuelle). Ma recommandation : appliquer **l'option A** pour que ça ne se reproduise plus, sans toucher au passé.

Confirme l'option (A, B ou C) et je passe en build pour l'implémenter.
