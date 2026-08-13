# SAM Phéno

Application web/PWA de suivi des stades phénologiques du pommier par degrés-jours.

## Fonctionnement des accès

- **Lecture seule** : aucun compte nécessaire. Seul l’onglet **Historique & courbes** est visible.
- **Mode édition** : connexion par **adresse mail + mot de passe** avec un compte créé manuellement dans Supabase.
- L’application ne contient **aucun formulaire d’inscription** et n’appelle jamais `signUp()`.
- Dans Supabase, désactiver **Allow new users to sign up** et ne créer que les comptes autorisés dans `Authentication > Users`.

## Autre variété

Si **Autre variété** est sélectionné, un champ **Nom de la variété** apparaît. Le calcul utilise le modèle générique du pommier. Le nom saisi est enregistré dans Supabase dans la colonne `custom_variety_name`.

## Mise à jour Supabase

Si les tables existent déjà, exécuter `supabase-schema.sql` dans **SQL Editor**. Le script contient notamment :

```sql
alter table public.parcels add column if not exists custom_variety_name text;
```

Les politiques RLS conservent :

- lecture publique pour `anon` et `authenticated` ;
- écriture pour les comptes `authenticated`.

Pour que seuls les comptes créés manuellement puissent écrire, désactiver les inscriptions libres et les autres méthodes d’authentification non utilisées.

## Fichiers GitHub

Conserver à la racine :

- `index.html`
- `app.js`
- `style.css`
- `manifest.webmanifest`
- `service-worker.js`
- `supabase-config.js`
- `supabase-schema.sql`
- `sam-pheno-logo.png`
- `icon-192.png`
- `icon-512.png`
- `README.md`

Les fichiers `app.js` et `style.css` gardent volontairement des noms stables pour remplacer directement les versions précédentes lors d’un upload GitHub.
