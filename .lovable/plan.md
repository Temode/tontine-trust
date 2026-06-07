# Audit Tontine Digital — Écart avec le dossier de soutenance

Comparaison ligne à ligne des fonctionnalités listées dans le PDF (§5) avec ce qui est déjà livré dans le code (Phases A → I).

## Légende
- ✅ Fait — disponible en production
- 🟡 Partiel — présent mais incomplet ou en mode simulation
- ❌ Manquant — à construire

---

## 1. État des lieux par chapitre du PDF

### 5.1 Gestion des utilisateurs
| Fonction PDF | Statut | Détail |
|---|---|---|
| Inscription téléphone + OTP SMS | ❌ | Email/password uniquement (choix mémoire projet) |
| Profil (photo, nom, contact) | 🟡 | Nom + téléphone OK, **photo absente** |
| Vérification d'identité (KYC premium) | ❌ | Aucune |
| Connexion PIN / biométrie | ❌ | Aucune |
| Paramètres de notification | ❌ | Pas d'écran de préférences |

### 5.2 Création et gestion de groupes
| Fonction | Statut | Détail |
|---|---|---|
| Création paramétrable | ✅ | Wizard 5 étapes |
| Règles montant/fréquence/membres | ✅ | |
| Code d'invitation | ✅ | + lien partageable |
| Demandes d'adhésion (approve/reject) | ✅ | |
| **Modification paramètres avant cycle** | ❌ | Aucun écran d'édition |
| Co-organisateurs | 🟡 | Champ saisi mais pas de gestion ni de droits effectifs côté RPC |

### 5.3 Cotisations
| Fonction | Statut | Détail |
|---|---|---|
| Paiement Orange/MTN | 🟡 | **Mode simulation** (`record_mock_payment`), Djomy pas branché |
| Confirmation instantanée | 🟡 | Simulation seulement |
| Historique transactions | ✅ | `my_payments_history` |
| Reçus numériques | ✅ | `my_receipts` + hash |
| **Rappels automatiques avant échéance** | ❌ | Pas de cron/edge function |
| **Pénalités de retard appliquées** | 🟡 | Paramètres stockés, **non calculées** au runtime |

### 5.4 Rotation et versements
| Fonction | Statut | Détail |
|---|---|---|
| Ordre rotation (aléatoire/fixe/choix) | ✅ | |
| Mode **enchères** | ❌ | Mappé silencieusement sur `choice` |
| Versement auto au bénéficiaire | 🟡 | RPC `release_payout` manuel, pas de déclenchement auto |
| Notifications bénéficiaire | 🟡 | In-app uniquement |
| Calendrier visuel des tours | ❌ | Liste plate, pas de vue calendrier |
| **Échange de tours entre membres** | ❌ | `swap_policy` stocké mais pas implémenté |

### 5.5 Tableau de bord & transparence
| Fonction | Statut | Détail |
|---|---|---|
| Vue d'ensemble groupes | ✅ | |
| État cotisations temps réel | ✅ | |
| Progression cycle | ✅ | |
| Statistiques personnelles | 🟡 | KPI basiques |
| **Graphiques et visualisations** | ❌ | Aucun chart (Recharts non utilisé) |

### 5.6 Confiance et réputation
| Fonction | Statut | Détail |
|---|---|---|
| Score fiabilité auto | ✅ | Phase E |
| **Badges / récompenses bons payeurs** | ❌ | |
| **Avis / commentaires entre membres** | ❌ | |
| Visibilité score pour organisateur | 🟡 | Score visible, pas exposé sur la liste des demandes d'adhésion |

### 5.7 Communication
| Fonction | Statut | Détail |
|---|---|---|
| Notifications in-app | ✅ | Phase F |
| **Chat de groupe** | ❌ | |
| **Messages privés** | ❌ | |
| **Annonces organisateur** | ❌ | |
| **Notifications SMS / Email / Push** | ❌ | Aucun canal externe |

### 5.8 Sécurité
| Fonction | Statut | Détail |
|---|---|---|
| 2FA | ❌ | |
| Chiffrement données sensibles | 🟡 | RLS + TLS, pas de chiffrement applicatif |
| **Audit logs** | ❌ | Pas de table `audit_log` |
| Protection fraude | 🟡 | Aucune règle anti-doublon paiement côté front |

### Modèle économique (§7)
| Source | Statut |
|---|---|
| Commission 1–2 % sur cagnotte | ❌ Non prélevée par `release_payout` |
| Abonnement Premium | ❌ |
| Partenariats / publicité | ❌ (hors MVP) |

---

## 2. Priorisation proposée pour atteindre le niveau soutenance

### 🔴 P0 — Indispensables pour la démo (1–2 jours)
1. **Édition du groupe avant démarrage** (nom, montant, fréquence, règles) — corrige un manque évident.
2. **Application des pénalités de retard** dans `record_mock_payment` / vue `my_contributions_due` (calcul au moment du paiement).
3. **Prélèvement de commission** (1 %) dans `release_payout` avec écriture ledger `fee`.
4. **Calendrier visuel des tours** sur la page détail du groupe (timeline + dates).
5. **Graphiques dashboard** : 1 ligne cotisations vs reçus + 1 donut répartition statuts (Recharts est déjà dispo dans shadcn).

### 🟠 P1 — Crédibilité produit (2–4 jours)
6. **Chat de groupe** (table `group_messages`, realtime Supabase, vue conversation simple).
7. **Annonces organisateur** (variante épinglée du chat).
8. **Rappels automatiques** : edge function CRON quotidienne → insère notifications J-3, J-1, J+1.
9. **Photo de profil** (storage bucket `avatars`, upload côté `Profile.tsx`).
10. **Badges fiabilité** (Or/Argent/Bronze) calculés à partir du score existant + composant `ReliabilityBadge` enrichi.
11. **Audit log** : table `audit_log` + triggers sur `groups`, `turns`, `payments`, `payouts`.

### 🟡 P2 — Confort & complétude (3–5 jours)
12. **Échange de tours** entre membres (proposition + acceptation + journalisation).
13. **Mode enchères** réel (table `turn_bids`, attribution au meilleur enchérisseur).
14. **Préférences de notification** par canal/type.
15. **Avis & commentaires** post-cycle (note 1–5 + texte, agrégée dans le score).
16. **Email transactionnels** (Resend) : invitation, reçu, rappel.
17. **SMS** : à coupler avec Djomy ou opérateur séparé (à arbitrer).

### 🟢 P3 — Sécurité avancée et monétisation (à cadrer)
18. **2FA** (TOTP via `supabase.auth.mfa`).
19. **KYC premium** (upload pièce + statut vérifié).
20. **Abonnement Premium** organisateur (Stripe ou Paddle, décision à prendre).
21. **Intégration Djomy réelle** (Phase J — déjà planifiée, dépend des credentials).

---

## 3. Détails techniques par chantier P0

### 3.1 Édition du groupe
- Nouvelle RPC `update_group_settings(_group_id, _payload)` (org only, refuse si `status != 'forming'`).
- Page `/groupes/:id/parametres` accessible depuis `GroupDetail` via `RoleGuard admin/organizer`.

### 3.2 Pénalités
- Ajouter colonne `penalty_amount` sur `contributions`.
- À la confirmation, si `now() > due_date + late_after_days`, calculer `amount * penalty_pct / 100`, l'ajouter au paiement et écrire une ligne `penalty` dans `ledger`.

### 3.3 Commission
- Dans `release_payout` : `fee = payout * 0.01`, virement = `payout - fee`, ledger `fee`.
- Afficher la commission sur le reçu.

### 3.4 Calendrier des tours
- Nouveau composant `TurnsTimeline` (vertical, statut couleur) + `TurnsCalendar` (mois) basé sur `listGroupTurns`.

### 3.5 Graphiques
- `DashboardCharts.tsx` consommant `my_contributions_due` + `my_payments_history` (déjà exposés), Recharts `AreaChart` + `PieChart`.

---

## 4. Hors périmètre confirmé
- React Native (mobile natif) — le dossier le mentionne mais on reste web responsive pour la soutenance.
- AWS/GCP / Firebase — remplacés par Lovable Cloud (à expliquer dans la soutenance, pas à recoder).

---

## 5. Ce que je propose pour la suite immédiate
Démarrer **P0 (1 → 5)** dans cet ordre, en une seule passe de build, en finissant par les graphiques pour avoir un dashboard impressionnant à montrer au jury.

**Question** : tu valides ce périmètre P0 pour la prochaine itération, ou tu veux qu'on ajoute / décale un item (ex. monter le chat P1 en P0, ou commencer par brancher Djomy) ?
