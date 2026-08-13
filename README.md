# SAM Phéno.

Application web/PWA de suivi de la phénologie du pommier par degrés-jours.

## Identité de l'application

- Nom affiché sur le téléphone : **SAM Phéno.**
- Nom de l'onglet / page internet : **SAM Phéno.**
- Titre visible dans le bandeau : **SAM Phénologie**
- Bandeau supérieur harmonisé avec SAM Tavelure et SAM Piégeage.
- Le bandeau utilise le logo SudExpé.
- L'illustration phénologique fournie est utilisée uniquement comme icône de l'application téléphone (`icon-192.png` et `icon-512.png`).

## Connexion

Le bandeau contient directement :
- Adresse mail
- Mot de passe
- Connexion

Sans connexion, l'application est en lecture seule et affiche uniquement l'onglet Historique & courbes.
Après connexion avec un compte Supabase existant, le mode édition est activé.

## Fichiers à déposer sur GitHub

- `index.html`
- `style.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `supabase-config.js`
- `supabase-schema.sql`
- `logo-sudexpe.png`
- `icon-192.png`
- `icon-512.png`
- `README.md`

Les noms `app.js` et `style.css` restent fixes afin que chaque mise à jour remplace directement les fichiers précédents sur GitHub.
