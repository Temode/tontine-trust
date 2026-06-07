## Problème

Le RPC `start_cycle` (db/03_phase_b_rotation.sql) insère dans `turns.status` une valeur **text** :

```sql
case when r.position = 1 then 'collecting' else 'upcoming' end
```

Or la colonne `turns.status` est de type enum `turn_status`. PostgreSQL refuse la conversion implicite → erreur `column "status" is of type turn_status but expression is of type text`. Même problème potentiel sur `contributions.status` (`'pending'` non casté) selon le type de la colonne.

## Correctif

Créer une nouvelle migration `supabase/migrations/<timestamp>_fix_start_cycle_enum_cast.sql` qui **redéfinit** la fonction `public.start_cycle(uuid)` à l'identique, avec deux changements :

1. Cast explicite du statut de tour :
   ```sql
   (case when r.position = 1 then 'collecting' else 'upcoming' end)::public.turn_status
   ```
2. Cast explicite du statut de contribution :
   ```sql
   'pending'::public.contribution_status
   ```

Re-`GRANT EXECUTE` sur la fonction à `authenticated`. Aucune autre logique modifiée, aucune table touchée.

## Vérification

- Sur la page `/groupes/<id>`, cliquer **Démarrer le cycle** → succès, 2 tours créés, statut groupe → `active`, redirection / toast OK.
- Pas de 400 dans la console réseau Supabase.
- Les autres RPC (Phase C/D) qui castent déjà correctement ne sont pas touchés.

## Fichiers

- **Nouveau** : `supabase/migrations/<timestamp>_fix_start_cycle_enum_cast.sql`
- Aucune modif côté frontend.
