# SAM Phénologie

Application web/PWA SudExpé de suivi des stades phénologiques du pommier par degrés-jours.

## Organisation de l'interface

La configuration n'est plus affichée en permanence.

Dans l'encart **Parcelle active** :

- choisir d'abord l'**exploitation** ;
- choisir ensuite la **parcelle** ;
- cliquer sur **Configuration** pour afficher les paramètres de la parcelle active ;
- cliquer sur **Nouvelle parcelle** pour ouvrir un formulaire vide, renseigner les paramètres, puis enregistrer la nouvelle parcelle.

Le bouton **Nouvelle parcelle** n'est pas disponible en lecture seule.

## Fichiers GitHub

Les noms restent volontairement stables pour que les nouveaux fichiers écrasent les anciens :

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

## Supabase

Le fichier `supabase-config.js` contient le Project URL et la Publishable key utilisés par l'application.

Le script `supabase-schema.sql` crée les tables :

- `public.parcels`
- `public.observations`

avec lecture publique et écriture réservée aux utilisateurs authentifiés.

## Connexion

La connexion se fait par Magic Link Supabase :

1. cliquer sur **Connexion** ;
2. saisir l'adresse mail ;
3. cliquer sur **Recevoir le lien de connexion** ;
4. ouvrir le lien reçu par e-mail ;
5. revenir dans SAM Phénologie connecté.

Le bouton d'envoi du lien reste désactivé pendant 60 secondes après un clic.

## Modèles phénologiques

- Gala : seuils variétaux intégrés lorsque disponibles ;
- Cripps Pink / Pink Lady : seuils variétaux intégrés lorsque disponibles ;
- Golden Delicious, Joya, Reine des reinettes, Granny Smith, Ariane, Dalinette, Opal et autre variété : modèle générique lorsque aucun modèle complet compatible n'est intégré.

Les observations terrain restent prioritaires pour recaler les estimations.
