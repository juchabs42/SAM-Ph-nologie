# SAM Phénologie — v2.7

Application web/PWA SudExpé de suivi des stades phénologiques du pommier par degrés-jours.

## Nouveau dans la v2.7

- vraie connexion **SudExpé par Magic Link** Supabase ;
- aucun mot de passe à créer ou à saisir ;
- l'adresse e-mail doit déjà exister dans `Authentication > Users` ;
- `shouldCreateUser: false` empêche SAM Phénologie de créer automatiquement de nouveaux utilisateurs ;
- après configuration de Supabase, les producteurs non connectés sont en **lecture seule** ;
- les comptes SudExpé connectés peuvent créer/modifier les parcelles et observations ;
- choix successif **Exploitation → Parcelle** dans l'encart Parcelle active ;
- choix de la localisation météo par **nom de commune ou code postal**, sans saisie manuelle de latitude/longitude ;
- infobulle interactive sur la courbe cumulée des degrés-jours : date, cumul et stade phénologique ;
- variété **Opal** corrigée ;
- pied de page : `SudExpé · Outil d’aide au suivi`.

## Fichiers à conserver dans GitHub

- `README.md`
- `index.html`
- `app.js`
- `style.css`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`
- `sudexpe-logo.jpg`
- `supabase-config.js`
- `supabase-schema.sql`

Supprimer les anciens fichiers `app-v8.js`, `style-v8.css` et les versions plus anciennes.

## 1. Préparer Supabase

Dans Supabase > SQL Editor, exécuter le contenu de `supabase-schema.sql`.

Le script crée :

- `public.parcels`
- `public.observations`

avec lecture publique et écriture réservée aux utilisateurs authentifiés.

## 2. Utilisateur SudExpé

L'utilisateur SudExpé doit déjà être visible dans :

`Authentication > Users`

Il n'a pas besoin d'avoir un mot de passe pour SAM Phénologie. La connexion se fera par Magic Link.

Pour éviter qu'un visiteur puisse créer son propre compte :

- désactiver les inscriptions libres dans la configuration Auth du projet ;
- SAM utilise en plus `shouldCreateUser: false` lors de la demande de Magic Link.

## 3. Configurer l'URL de redirection

Dans Supabase, ajouter l'URL GitHub Pages de SAM Phénologie dans les URL autorisées de redirection Auth.

Exemple :

`https://votre-compte.github.io/sam-phenologie/`

Utiliser exactement l'URL publique de l'application, avec le `/` final si votre site l'utilise.

## 4. Récupérer Project URL et Publishable key

Dans le projet Supabase, ouvrir le panneau **Connect**.

Récupérer :

- **Project URL** — ressemble à `https://xxxxxxxx.supabase.co`
- **Publishable key** — ressemble à `sb_publishable_...`

Ne jamais utiliser dans GitHub une `secret key` ou une `service_role key`.

## 5. Remplir supabase-config.js

Remplacer :

```js
window.SAM_SUPABASE = {
  url: 'VOTRE_SUPABASE_URL',
  publishableKey: 'VOTRE_SUPABASE_PUBLISHABLE_KEY'
};
```

par exemple par :

```js
window.SAM_SUPABASE = {
  url: 'https://abcdefghijk.supabase.co',
  publishableKey: 'sb_publishable_xxxxxxxxxxxxxxxxx'
};
```

## 6. Connexion dans SAM Phénologie

Une fois les fichiers publiés sur GitHub Pages :

1. cliquer sur **Connexion** ;
2. saisir l'adresse e-mail déjà présente dans Supabase ;
3. cliquer sur **Recevoir le lien de connexion** ;
4. ouvrir l'e-mail reçu ;
5. cliquer sur le Magic Link ;
6. le navigateur revient sur SAM Phénologie ;
7. l'application passe en mode `Supabase · Édition SudExpé`.

Aucun mot de passe n'est demandé.

## 7. Première synchronisation

Si des parcelles existent déjà uniquement dans le stockage local du navigateur :

1. se connecter comme SudExpé ;
2. ouvrir **Connexion / Compte** ;
3. cliquer sur ****.

Vérifier ensuite dans Supabase > Table Editor que les tables `parcels` et `observations` contiennent les données.

## Modèles phénologiques

- Gala : modèle variétal WSU, base 6,1 °C pour les seuils disponibles ;
- Cripps Pink / Pink Lady : modèle variétal WSU, base 6,1 °C pour les seuils disponibles ;
- Golden Delicious, Joya, Reine des reinettes, Granny Smith, Ariane, Dalinette, Opal et autre variété : modèle générique du pommier base 5 °C lorsqu'aucun modèle complet C → J n'est intégré.

Les observations terrain restent prioritaires pour recaler les estimations.
