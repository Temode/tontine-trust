## Diagnostic

Do I know what the issue is? Oui.

Ton compte `terriumplus1@gmail.com` existe bien en base avec les rôles `participant` et `super_admin`. Le problème vient du chargement côté app : `rolesLoading` peut rester `false` pendant un court instant juste après la connexion, avant que la requête `user_roles` démarre réellement. Pendant ce trou, l'app croit que tes rôles sont vides/participant, te laisse arriver sur `/dashboard`, et le garde admin affiche ensuite “Cette zone est réservée…” si tu forces `/admin/*` trop tôt.

Il y a aussi un second détail : dans le header utilisateur, le badge prend simplement `roles[0]`. Comme ton compte a aussi `participant`, le badge peut afficher `PARTICIPANT` même si `super_admin` est présent.

## Plan de correction

1. **Rendre le chargement des rôles déterministe**
   - Modifier `src/hooks/useAuth.tsx` pour passer `rolesLoading` à `true` immédiatement dès qu'un utilisateur connecté est détecté.
   - Ne plus laisser une fenêtre où `user` existe mais `rolesLoading=false` avec des rôles pas encore chargés.
   - Gérer les erreurs de chargement des rôles explicitement au lieu de les ignorer silencieusement.

2. **Centraliser la décision admin après connexion**
   - Ajuster `src/pages/Auth.tsx` pour que la redirection post-login attende une lecture fiable des rôles.
   - Si `super_admin` est trouvé, rediriger vers `/admin/overview`.
   - Si l'utilisateur venait explicitement d'une route `/admin/*`, conserver ce chemin seulement si le rôle admin est confirmé.

3. **Corriger le badge affiché dans le header utilisateur**
   - Modifier `src/components/layout/TopBar.tsx` pour prioriser `super_admin` dans l'affichage du badge.
   - Résultat attendu : ton compte affichera `SUPER_ADMIN` ou `SUPER ADMIN`, pas `PARTICIPANT`.

4. **Renforcer le garde back-office**
   - Garder `AdminShell` bloqué sur le loader tant que les rôles ne sont pas définitivement chargés.
   - Ne déclencher le toast “Accès réservé” qu'après chargement complet et absence confirmée du rôle `super_admin`.

5. **Validation**
   - Vérifier avec le compte admin restauré/session preview que :
     - connexion admin → `/admin/overview`,
     - accès forcé `/admin/overview` → back-office visible,
     - header admin affiche le badge `Super admin`,
     - aucune sidebar “Mes groupes / Mes cotisations” sous `/admin/*`.