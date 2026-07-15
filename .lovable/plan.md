## Objectifs

1. Permettre à l'utilisateur d'éditer ses informations depuis la page Profil (nom, téléphone avec indicatif pays).
2. Ajouter un sélecteur d'indicatif pays lors de l'inscription (Auth) + validation du format national par pays.
3. Fiabiliser l'envoi SMS : normalisation qui accepte tous les formats E.164 (pas uniquement guinéen) pour éviter les échecs "numéro invalide". (Nimba sms ne peut envoyer de sms que pour ceux qui sont en guinée, donc pour les numeros etranger cela est un cas à gerer plustard)

## Détail des changements

### 1. Nouvelle librairie phone multi-pays — `src/lib/phone.ts`

- Ajouter une liste `COUNTRIES` (Guinée en tête, puis autres pays Afrique de l'Ouest + France : GN +224, CI +225, SN +221, ML +223, BF +226, TG +228, BJ +229, NE +227, FR +33, BE +32, CA +1) : `{ code, name, dial, flag, nationalLength, nationalPrefixes }`.
- `normalizePhone(national, dialCode)` → renvoie `"611599395"` (sans `+`) ou `null` si longueur ne correspond pas au pays.
- `parseE164(raw)` → détecte pays et partie nationale à partir d'un numéro complet stocké.
- `formatPhone(raw)` → affichage `+224 611 59 93 95`.
- Conserver `normalizeGNPhone` (compat rétro : délègue à `normalizePhone` avec `+224`).

### 2. Composant réutilisable — `src/components/ui/PhoneInput.tsx`

- Combobox `<select>` compact (drapeau + indicatif) + `<input type="tel">` pour la partie nationale.
- Valeurs contrôlées : `value: { dial: string; national: string }`, `onChange`.
- Auto-suppression du `0`/`+dial` en tête si l'utilisateur colle un numéro complet.
- Affiche une aide contextuelle : ex. « Guinée : 9 chiffres commençant par 6 ».

### 3. Inscription — `src/pages/Auth.tsx`

- Remplacer l'input téléphone unique par `PhoneInput` (défaut Guinée `+224`).
- Sur submit : appeler `normalizePhone` → stocker E.164 (`+224611599395`) dans `phoneNumber`.
- Toast d'erreur si numéro rempli mais invalide pour le pays sélectionné.

### 4. Page Profil éditable — `src/pages/Profile.tsx`

- Ajouter un mode édition (bouton « Modifier ») qui bascule le bloc en formulaire :
  - Champ **Nom complet** (input texte).
  - Champ **Téléphone** via `PhoneInput` (pré-rempli à partir de `profileQ.data.phone_number` parsé avec `parseE164`).
  - Boutons **Enregistrer** / **Annuler**.
- Nouvelle fonction `updateMyProfile({ full_name, phone_number })` dans `src/lib/api/profile.ts` (UPDATE sur `profiles` où id = auth.uid, aucune migration RLS nécessaire — la policy existante autorise déjà l'auto-update).
- Mutation React Query + toast succès/erreur + invalidation `["profile","mine"]`.
- L'email reste non-modifiable ici (redirection vers flux Auth existant).

### 5. Fiabilité SMS — `supabase/functions/_shared/nimbasms.ts`

- Généraliser `normalizeGNPhone` (renommer en interne `normalizePhoneForNimba`, garder export nom) :
  - Accepter tout numéro déjà E.164 (`+CCXXXX…`, `00CCXXXX…)` où CC est un indicatif connu).
  - Fallback historique : 9 chiffres commençant par 6 → préfixer +`224`.
  - Retourner le numéro nettoyé (sans `+`) plutôt que `null` quand le format est E.164 plausible (8-15 chiffres) — évite les rejets silencieux qui font échouer l'envoi.
- Log clair (`recipient_normalized`) en cas de fallback.
- Aucune modif de la logique retry / kill-switch.

### 6. Alignement client `src/lib/phone.ts`

- La normalisation Nimba doit être cohérente avec celle du client : exporter une même fonction pure (dupliquée côté Deno vu la contrainte no cross-import) et couvrir par tests unitaires `src/lib/phone.test.ts` (Vitest) : cas GN local, GN international, CI, FR, invalides.

## Ce qui NE change pas

- Aucune migration SQL (colonnes `profiles.full_name`, `phone_number` déjà présentes).
- Aucun changement des politiques RLS.
- Le fournisseur SMS reste Nimba ; l'envoi vers un numéro non-guinéen reste sujet à la couverture Nimba mais ne sera plus bloqué côté application.

## Fichiers touchés

- `src/lib/phone.ts` (refonte + garde compat)
- `src/lib/phone.test.ts` (nouveau)
- `src/components/ui/PhoneInput.tsx` (nouveau)
- `src/pages/Auth.tsx`
- `src/pages/Profile.tsx`
- `src/lib/api/profile.ts` (ajout `updateMyProfile`)
- `supabase/functions/_shared/nimbasms.ts` (normalisation élargie)