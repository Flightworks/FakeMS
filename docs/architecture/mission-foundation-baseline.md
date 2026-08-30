# FakeMS — référence de la branche mission

- Dépôt : `Flightworks/FakeMS`
- Application publique : https://flightworks.github.io/FakeMS/
- Version de départ : `1.3.6`
- Commit de départ : `5d528c2989f95e982309001dbff3d5ffd127280e`
- Branche : `dev/mission-simulation-foundation`

## Résultat de l’audit de départ

L’application est une maquette HMI tactile fonctionnelle. Elle n’est pas encore une base suffisamment fiable pour représenter un système de mission simulé.

Les écarts principaux sont :

- confusion entre simulation, géolocalisation et mode réel ;
- commande DCT non cohérente avec les coordonnées géographiques ;
- modèle de piste et de capteur trop pauvre ;
- actions mission réduites à des alertes ;
- absence de noyau métier séparé de React ;
- typecheck absent de la CI et erreurs TypeScript dans les fixtures ;
- risque d’exposition future d’une clé injectée dans le bundle client.

Cette branche corrige d’abord le socle technique. Elle ne doit pas être fusionnée dans `main` avant la qualification fonctionnelle, navigateur et tactile décrite dans le plan d’action.
