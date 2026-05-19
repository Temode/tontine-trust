## 1. Audit de l'existant

### Ce qui est réellement fonctionnel (branché à la BDD)
- **Authentification** : signup / login / logout via Lovable Cloud, `mapAuthError` FR, redirection `/dashboard`.
- **Schéma DB** : `profiles`, `user_roles` (enum `admin | organisateur | participant`), fonction `has_role` SECURITY DEFINER, trigger `handle_new_user` qui crée profil + rôle `participant` par défaut, RLS activée.
- **Garde de routes** : `ProtectedRoute` + `RoleGuard` (utilisé sur le bloc "État des cotisations" du dashboard).
- **Formulaire profil** : `ProfileUpdateForm` (full_name + phone_number) RLS-safe.

### Ce qui est UI seulement (mock-data, non persistant)
Toutes les pages métier lisent `src/lib/mock-data.ts` :
- `Dashboard` (KPIs, transactions, échéances, statut membres temps réel)
- `MyGroups`, `GroupDetail`, `CreateGroup` (wizard 5 étapes), `JoinGroup`, `InviteMembers`
- `Contributions`, `Rotations`, `History`, `Calendar`, `Notifications`, `Settings`
- `PaymentModal` (simulation Orange/MTN, aucun appel réseau)

### Lacunes critiques pour un produit utilisable
1. Aucune table métier (groupes, membres, cotisations, tours, transactions, notifications).
2. Création de groupe non persistée → boutons "Créer" sans effet réel.
3. Aucun système d'invitation réel (code/lien non vérifié serveur).
4. Aucune intégration paiement, même en mode "simulation traçable".
5. Aucune logique de rotation automatique ni de calcul du score de fiabilité.
6. Pas de notifications (ni in-app ni email/SMS).
7. Page d'accueil `/` publique = mock — pas de landing claire pour visiteurs non connectés.
8. Aucun rôle attribué à l'organisateur lorsqu'il crée un groupe (tout le monde reste `participant`).

## 2. Définition du MVP

Objectif MVP : **un organisateur peut créer un groupe, inviter des membres, recevoir leurs cotisations (mode simulation traçable) et déclencher la rotation, avec preuve complète côté BDD.**

### Périmètre inclus dans le MVP

**MVP-1 — Comptes & profils** (déjà ~80% fait)
- Auth email/mot de passe ✓
- Profil éditable (nom, téléphone) ✓
- Score de fiabilité (lecture seule, calculé serveur)

**MVP-2 — Groupes**
- Créer un groupe (nom, description, montant, fréquence, nb membres, ordre de rotation)
- Devenir automatiquement `organisateur` sur ce groupe (rôle scoped au groupe, pas global)
- Lister mes groupes (en tant que membre ou organisateur)
- Page détail d'un groupe : membres, paramètres, tour en cours

**MVP-3 — Invitations**
- Générer un code d'invitation unique côté serveur
- Rejoindre un groupe via le code (vérification serveur)
- L'organisateur voit / révoque les invitations en attente

**MVP-4 — Cycle & rotation**
- Démarrer un cycle quand le groupe est plein
- Génération automatique de l'ordre (aléatoire ou manuel)
- Tour courant visible, prochain bénéficiaire identifié

**MVP-5 — Cotisations (mode simulation, traçable)**
- Échéances générées automatiquement à chaque période
- Un membre marque sa cotisation comme payée (référence transaction Mobile Money saisie manuellement OU bouton "Simuler paiement")
- L'organisateur confirme la réception
- Historique des transactions par membre et par groupe
- Note : intégration API Orange/MTN repoussée en post-MVP, mais le modèle de données est prêt à l'accueillir

**MVP-6 — Versement de la cagnotte**
- Quand toutes les cotisations du tour sont confirmées, marquer le tour comme "versé" au bénéficiaire (référence de versement)
- Passage automatique au tour suivant

**MVP-7 — Notifications in-app**
- Échéance à venir, cotisation reçue, tour versé, invitation reçue
- Inbox `/notifications` alimentée par la BDD

**MVP-8 — Landing publique**
- `/` devient une vraie landing (proposition de valeur, CTA → `/auth`) pour visiteurs non connectés

### Hors MVP (post-V1)
- Intégration réelle API Orange Money / MTN Mobile Money
- Notifications SMS / Email / Push
- App mobile native (React Native) — le web responsive suffit pour le MVP
- Enchères, swaps de tour, KYC avancé, pénalités automatiques
- Tableau d'administration plateforme
- Annuaire public de groupes
- Multi-cycles / re-démarrage automatique

## 3. Plan d'avancement proposé

```text
Phase A — Fondations data (1 étape)
  A1. Schéma BDD complet : groups, group_members, invitations,
      cycles, turns, contributions, transactions, notifications
      + RLS par groupe (helper is_group_member, is_group_organizer)
  A2. Brancher useAuth → rôles scoped par groupe (pas seulement global)

Phase B — Création & adhésion (MVP-2, MVP-3)
  B1. CreateGroup → vraie insertion + redirection /groupes/:id
  B2. MyGroups → query réelle
  B3. GroupDetail → query réelle (membres, paramètres)
  B4. Invitations : génération code, page JoinGroup fonctionnelle

Phase C — Cycle & cotisations (MVP-4, MVP-5, MVP-6)
  C1. Démarrage cycle + génération ordre rotation
  C2. Génération des échéances par tour
  C3. PaymentModal → enregistre une contribution (mode simulation)
  C4. Confirmation organisateur + passage tour suivant

Phase D — Surface utilisateur (MVP-7, MVP-8)
  D1. Notifications branchées sur BDD
  D2. Dashboard / Contributions / History / Calendar : remplacer
      mock-data par queries réelles
  D3. Landing publique sur /

Phase E — Qualité
  E1. Score de fiabilité (fonction SQL recalculée à chaque cotisation)
  E2. Audit RLS complet + tests de privilege escalation
  E3. États vides, erreurs réseau, loading skeletons partout
```

## 4. Décisions à valider avant de coder

1. **Rôles** : on garde `admin | organisateur | participant` **global**, et on ajoute un rôle **par groupe** dans `group_members.role` (organisateur/membre). OK ?
2. **Paiements MVP** : on part bien sur **mode simulation traçable** (saisie référence Mobile Money + bouton "simuler") pour la soutenance, et l'intégration API Orange/MTN est planifiée séparément ?
3. **Notifications MVP** : in-app uniquement (pas de SMS/email pour la V1) ?
4. **Landing** `/` : on remplace la page actuelle par une vraie landing publique avec CTA `/auth`, ou on garde l'accès direct dashboard si connecté ?

Dès que tu valides ces 4 points (ou que tu m'indiques tes préférences), je passe en mode build et j'attaque la **Phase A** (schéma BDD + RLS) en premier.
