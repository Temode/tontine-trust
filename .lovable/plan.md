# Audit : Tontine Solo et Tontine Internationale

Les deux blocages sont côté base de données, pas côté interface. Les causes exactes ont été identifiées et vérifiées sur la base réelle.

## 1. Tontine Solo — création impossible

Vérifié : la base ne contient aujourd'hui **aucune** tontine de type solo, cohérent avec un blocage systématique.

Trois problèmes cumulés :

**a) Contradiction entre deux règles automatiques (cause bloquante principale)**
- Une règle force toute tontine solo à `max_members = 1`.
- Une autre règle de validation refuse toute tontine dont le nombre de membres n'est pas entre 2 et 50.
- La seconde s'exécute après la première : la création échoue toujours avec « Le nombre de membres doit être compris entre 2 et 50. »

**b) Double inscription du créateur**
- Un automatisme ajoute déjà le créateur comme organisateur dès la création du groupe.
- La fonction de création solo réinsère la même personne → violation d'unicité (un membre ne peut exister qu'une fois par groupe). Ce second échec apparaîtrait dès que (a) est corrigé.

**c) Quota du plan**
- Le plan Free autorise `max_solo = 0`. Même techniquement corrigé, un utilisateur Free reste bloqué (bouton désactivé + erreur `QUOTA_SOLO_EXCEEDED`). À trancher : ouvrir 1 solo en Free, ou garder la restriction et afficher un message clair d'upsell.

## 2. Tontine Internationale — candidature impossible

**a) Incohérence entre la liste affichée et la fonction de candidature (cause principale)**
- L'annuaire a été élargi : il liste désormais aussi les tontines `public-link` / `directory`, pas uniquement les tontines marquées « internationales ».
- La fonction de candidature, elle, exige toujours `is_international = true`.
- Vérifié : **0 tontine** en base n'est marquée internationale. Donc toute candidature échoue avec « Groupe introuvable » (`group_not_found_or_not_international`).

**b) Statuts incompatibles**
- L'annuaire liste les groupes en statut `draft`, `open` **et** `active`.
- La candidature n'accepte que `draft` et `open` → « Ce groupe n'accepte plus de candidatures » sur tous les groupes déjà lancés et affichés.

**c) Quota du créateur**
- L'ajout d'un candidat compte dans le quota de membres du **créateur** du groupe (5 en Free). Sur un groupe Free déjà à 5 membres/invités, la candidature est rejetée avec un message technique `QUOTA_MEMBERS_EXCEEDED`, non traduit dans l'interface.

## Correctifs proposés

Base de données (migrations) :
1. Exempter les tontines solo de la règle « 2 à 50 membres » (autoriser 1 membre quand `kind = 'solo'`).
2. Rendre l'insertion du créateur idempotente dans la création solo (ne plus dupliquer la ligne déjà créée par l'automatisme).
3. Aligner la fonction de candidature sur l'annuaire : accepter les groupes internationaux **ou** publics (`directory` / `public-link`), et les statuts `draft`, `open`, `active`.
4. Renvoyer un code d'erreur explicite en cas de quota atteint côté créateur.

Interface :
5. Traduire les erreurs restantes en messages clairs (quota membres, groupe complet, plan Solo indisponible) dans `src/lib/api/solo.ts` et `src/lib/api/international.ts`.
6. Sur la page Solo, remplacer le bouton simplement désactivé par un message explicite + lien d'abonnement quand le quota est 0.

Vérification :
7. Après migration, créer une tontine solo réelle et envoyer une candidature réelle sur un groupe listé, puis contrôler les lignes créées en base.
