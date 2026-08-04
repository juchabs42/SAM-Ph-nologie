# SAM Phénologie

Application web progressive (PWA) de suivi des stades phénologiques du pommier à partir des degrés-jours et des données Open‑Meteo.

## Fonctions

- plusieurs parcelles enregistrées localement ;
- coordonnées saisies ou récupérées par GPS ;
- historique météo depuis le stade B et prévisions sur 16 jours ;
- calcul simple des degrés-jours : `max(0, ((Tmin + Tmax) / 2) - Tbase)` ;
- modèle générique base 5 °C à partir du stade B ;
- affichage Fleckinger + BBCH ;
- recalage automatique à chaque observation terrain ;
- alertes de stade proche et de gel pour les stades sensibles ;
- fonctionnement hors connexion avec les dernières données enregistrées ;
- installation possible sur téléphone ;
- onglet **Historique & courbe** avec la date de passage des stades atteints ;
- courbe cumulée des degrés-jours, séparation historique/prévision, seuils de stades et observations terrain.

## Mise en ligne avec GitHub Pages

1. Créer un dépôt GitHub.
2. Déposer tous les fichiers à la racine du dépôt.
3. Ouvrir **Settings > Pages**.
4. Dans **Build and deployment**, choisir **Deploy from a branch**.
5. Sélectionner la branche `main` et le dossier `/ (root)`.
6. Ouvrir l’adresse fournie par GitHub Pages.

Le GPS et le service worker nécessitent une connexion HTTPS. GitHub Pages fournit HTTPS automatiquement.

## Modèle agronomique

La version actuelle utilise un modèle générique de travail, exprimé en degrés-jours base 5 °C à partir du stade B observé. Les seuils sont définis dans `app.js`, constante `STAGES`.

Le modèle doit être considéré comme indicatif : la phénologie du pommier dépend de la variété, de la satisfaction des besoins en froid, du site et de l’année. L’application est conçue pour être recalée par les observations terrain.

### Seuils utilisés dans cette version

| Fleckinger | BBCH | Description | DJ depuis B |
|---|---:|---|---:|
| B | 51 | Bourgeon gonflé | 0 |
| C | 53 | Éclatement des bourgeons | 35 |
| C3 | 54 | Oreille de souris | 65 |
| D | 56 | Bouton vert | 105 |
| E | 57 | Bouton rose | 145 |
| E2 | 59 | Ballonnets | 180 |
| F | 61 | Début floraison | 220 |
| F2 | 65 | Pleine floraison | 260 |
| G | 67 | Floraison déclinante | 300 |
| H | 69 | Fin floraison | 340 |
| I | 71 | Nouaison | 390 |
| J | 72 | Taille noisette | 520 |

## Sources méthodologiques

- Open‑Meteo, documentation des API Forecast et Historical Weather.
- Meier et al., échelle BBCH des plantes cultivées ; correspondances BBCH/Fleckinger du pommier.
- Kronenberg, 1983, discussion des températures de base du pommier, avec une valeur moyenne proche de 4,5 °C selon les approches.
- Travaux de modélisation de la floraison du pommier montrant la dépendance aux besoins en froid, au forçage thermique, au cultivar et au site.

## Limites

- Les données Open‑Meteo sont des données maillées, pas une mesure dans la parcelle.
- L’alerte gel repose sur la température minimale de l’air prévue ; elle ne calcule ni température humide ni température des organes.
- Aucun seuil universel de degrés-jours ne décrit parfaitement tous les cultivars de pommier en France.
- Cette application est un outil d’aide au suivi et ne remplace pas l’observation au verger.


## Historique des stades

Un onglet dédié affiche la date de passage de chaque stade déjà atteint. Une date saisie sur le terrain est marquée « Observée » ; sinon, la date est calculée à partir du cumul de degrés-jours et marquée « Estimée ».


## Mise à jour depuis une ancienne version

La version 1.2 utilise un nouveau cache hors connexion. Après avoir remplacé les fichiers sur GitHub, ouvrir l’application avec une connexion internet puis actualiser la page. Si l’ancienne interface reste visible, effectuer une actualisation forcée (`Ctrl + F5`) ou fermer puis rouvrir l’application installée.

Dans l’onglet **Historique & courbe** :

- le tableau affiche uniquement les stades déjà atteints ;
- une date issue d’une saisie terrain est marquée **Observée** ;
- une date calculée à partir des degrés-jours est marquée **Estimée** ;
- la courbe distingue l’historique météo de la prévision Open-Meteo sur 16 jours ;
- les seuils Fleckinger sont indiqués sur l’axe vertical et les observations terrain sont matérialisées par des points.

### Version 2.1
- arrêt des prévisions phénologiques dès que le dernier stade J est atteint ;
- arrêt du cumul thermique et de la courbe à la date d’atteinte du stade J ;
- conservation de la date du dernier stade dans l’historique.
