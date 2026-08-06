# SAM Phénologie — Version 2.4

Application web/PWA de suivi des stades phénologiques du pommier par degrés-jours.

## Points clés de cette version

- identité visuelle SudExpé (logo et couleur du logo) ;
- intitulé : **Suivi des stades phenologiques du pommier par degrés-jours** ;
- station météo fixe : **Marsillargues** — Latitude 43,6343 · longitude 4,1706 · altitude 2 m ;
- onglets **Suivi actuel** et **Historique & courbes** ;
- encart **Parcelle active** séparé de la configuration ;
- changement de parcelle active mettant automatiquement à jour toute la configuration ;
- calcul des degrés-jours démarrant au **stade C** ;
- import d'un tableau des stades via fichier CSV / TXT / TSV ;
- historique des stades et courbe cumulée des degrés-jours ;
- arrêt des prévisions et de la courbe lorsque le dernier stade **J — taille noisette** est atteint.

## Fichiers à garder dans GitHub

- `README.md`
- `index.html`
- `style-v6.css`
- `app-v6.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`
- `sudexpe-logo.jpg`

Supprimer les anciens fichiers `app.js`, `app-v3.js`, `app-v4.js`, `app-v5.js`, `style.css`, `style-v3.css`, `style-v4.css`, `style-v5.css` s'ils sont encore présents dans le dépôt.

## Import du tableau des stades

Format accepté :

```csv
date;stade
2026-03-18;C
2026-03-25;D
2026-04-10;F
```

Ou encore :

```csv
18/03/2026;C
25/03/2026;D
10/04/2026;F2
```

## Remarque agronomique

Cette version utilise un **modèle générique de pommier** en degrés-jours base 5 °C à partir du stade C. Les variétés sont toutes affichées, même lorsqu'aucun modèle variétal spécifique n'est intégré dans cette version.

## Mise à jour GitHub Pages

1. Décompresser le ZIP.
2. Envoyer tous les fichiers à la racine du dépôt GitHub.
3. Vérifier que `index.html` charge bien `style-v6.css` et `app-v6.js`.
4. Recharger le site avec `Ctrl + F5`.
