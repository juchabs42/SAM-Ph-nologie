# SAM Phénologie — version 2.6

Application web/PWA SudExpé de suivi des stades phénologiques du pommier par degrés-jours.

## Nouveautés 2.6

- choix de la localisation météo par **nom de commune ou code postal** via l'API de géocodage Open-Meteo ;
- aucune saisie manuelle de latitude/longitude nécessaire ;
- la localisation météo est enregistrée **par parcelle** ;
- encart **Parcelle active** organisé en deux niveaux : **Exploitation → Parcelle** ;
- correction de la variété **Opal** ;
- infobulle interactive sur la courbe cumulée : date, degrés-jours et stade phénologique ;
- préparation complète d'une base **Supabase** pour conserver les parcelles et les observations ;
- consultation publique en lecture seule lorsque Supabase est configuré ;
- modifications réservées aux comptes Supabase authentifiés utilisés par SudExpé ;
- pied de page simplifié : `SudExpé · Outil d’aide au suivi`.

## Fichiers GitHub

Conserver à la racine du dépôt :

- `index.html`
- `app-v8.js`
- `style-v8.css`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`
- `sudexpe-logo.jpg`
- `supabase-config.js`
- `supabase-schema.sql`
- `README.md`

Les anciens fichiers `app-v7.js`, `style-v7.css`, etc. peuvent être supprimés.

## Choix de la localisation météo

Dans la configuration d'une parcelle :

1. saisir une commune ou un code postal ;
2. cliquer sur **Rechercher** ;
3. choisir le lieu dans la liste proposée ;
4. enregistrer la parcelle.

Le résultat Open-Meteo fournit automatiquement le nom, la latitude, la longitude, l'altitude et le fuseau horaire nécessaires aux requêtes météo.

La localisation par défaut des anciennes parcelles reste Marsillargues :

`Latitude 43,6343 · longitude 4,1706 · altitude 2 m`.

## Supabase — mise en place

### 1. Créer le projet

Créer un projet Supabase, puis ouvrir **SQL Editor**.

### 2. Créer les tables et les droits

Copier tout le contenu du fichier :

`supabase-schema.sql`

et l'exécuter dans SQL Editor.

Deux tables sont créées :

- `parcels` : exploitation, parcelle, variété, date du stade C, modèle thermique et localisation météo ;
- `observations` : historique des observations phénologiques.

Les politiques RLS fournies dans le fichier donnent :

- lecture aux visiteurs non connectés ;
- ajout/modification/suppression uniquement aux utilisateurs Supabase authentifiés.

N'ajouter comme utilisateurs authentifiés que les personnes SudExpé autorisées à modifier les données.

### 3. Récupérer l'URL et la clé publique

Dans Supabase, récupérer :

- l'URL du projet ;
- la **Publishable key** (ou l'ancienne `anon key`).

Ne jamais mettre une `secret key` ou une `service_role key` dans GitHub.

### 4. Modifier `supabase-config.js`

Remplacer :

```js
window.SAM_SUPABASE = {
  url: 'VOTRE_SUPABASE_URL',
  publishableKey: 'VOTRE_SUPABASE_PUBLISHABLE_KEY'
};
```

par les deux valeurs de votre projet.

### 5. Créer le compte SudExpé

Dans Supabase > Authentication > Users, créer les comptes des personnes SudExpé qui auront le droit d'écrire.

Une fois Supabase configuré :

- un producteur non connecté peut consulter les données ;
- les champs et boutons de modification sont verrouillés ;
- le bouton **Connexion SudExpé** permet à une personne autorisée de passer en mode édition.

### 6. Premier envoi des données locales

Après connexion SudExpé, ouvrir le panneau de connexion puis cliquer sur :

**Envoyer les données locales vers Supabase**

Cela transfère les parcelles et les observations déjà présentes dans le navigateur.

## Courbe interactive

Dans **Historique & courbes**, déplacer la souris sur la courbe. Une infobulle affiche :

- la date ;
- le cumul de degrés-jours ;
- le stade phénologique correspondant ;
- l'observation terrain lorsqu'une observation existe exactement à cette date.

## Modèles thermiques

La version 2.6 conserve les modèles de la version 2.5 :

- Gala : modèle variétal WSU intégré ;
- Cripps Pink / Pink Lady : modèle variétal WSU intégré ;
- Golden Delicious, Joya, Reine des reinettes, Granny Smith, Ariane, Dalinette, **Opal** et Autre variété : modèle générique du pommier.

Le point de départ est le stade Fleckinger **C**.

## GitHub Pages

Après envoi des fichiers :

1. vérifier que `index.html`, `app-v8.js` et `style-v8.css` sont à la racine ;
2. Settings > Pages ;
3. `Deploy from a branch` ;
4. branche `main` ;
5. dossier `/ (root)` ;
6. enregistrer.

Le service worker 2.6 utilise une nouvelle version de cache et privilégie le réseau pour `index.html`, afin de réduire les problèmes d'ancienne version lors des mises à jour.
