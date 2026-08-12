# SAM Phéno

Application web/PWA de suivi des stades phénologiques du pommier par degrés-jours, optimisée pour ordinateur et téléphone.

## Version téléphone

- nom installé et affiché : **SAM Phéno** ;
- icône et logo : image fournie pour SAM Phéno (`sam-pheno-logo.png`) ;
- icônes PWA 192×192 et 512×512 incluses ;
- interface responsive pour écrans à partir de 320 px ;
- boutons et champs dimensionnés pour le tactile ;
- sélection Exploitation → Parcelle simplifiée ;
- tableaux transformés en cartes sur téléphone ;
- onglets accessibles pendant le défilement ;
- courbe des degrés-jours compatible souris et tactile ;
- prise en compte des zones sûres Android/iOS ;
- fonctionnement PWA et hors connexion conservé.

## Fichiers à mettre sur GitHub

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

Les noms `app.js` et `style.css` restent stables : il suffit de remplacer les fichiers existants sur GitHub.

## Installation sur téléphone

Ouvrir l'adresse GitHub Pages de SAM Phéno dans Chrome/Edge sur Android, puis utiliser **Installer l'application** ou **Ajouter à l'écran d'accueil**. Sur iPhone/iPad, utiliser **Partager → Sur l'écran d'accueil**.
