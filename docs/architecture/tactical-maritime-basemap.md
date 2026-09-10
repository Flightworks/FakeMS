# Fond de carte tactique maritime

## Intention

FakeMS utilise un fond de carte de contexte pour une simulation de système de mission maritime. Le fond doit aider à lire la situation sans ressembler à une carte routière civile.

## Rendu

- mer : `#090d12` ;
- terre : `#20272d` ;
- trait de côte : `#6b7680`, avec une opacité réduite ;
- aéroports majeurs : petits points gris bleuté, sans libellé ;
- pistes, vecteurs, trails, routes simulées, zones et désignations : couches mission au-dessus du fond.

Le fond ne contient pas de routes, bâtiments, commerces, noms de rues, villes ou relief photographique.

## Données locales

Les ressources sont servies depuis la PWA :

- `public/maps/ne_110m_land.geojson` : polygones terrestres Natural Earth 1:110m, adaptés au fond global simplifié ;
- `public/maps/ne_10m_land_toulon.geojson` : extraction Natural Earth 1:10m bornée à la Méditerranée nord-occidentale, rendue au-dessus du fond global pour une côte plus précise près de Toulon ;
- `public/maps/ne_10m_airports_major.geojson` : sous-ensemble filtré des aéroports majeurs.

Le service worker précharge ces fichiers. Le fonctionnement nominal ne demande aucune tuile externe et reste disponible sans réseau.

La provenance, la révision et les empreintes SHA-256 sont documentées dans [`public/maps/README.md`](../../public/maps/README.md).

## Aéroports statiques et scénario

Les points d’aéroports Natural Earth sont des repères de contexte uniquement :

- ils ne sont pas ajoutés à `entities` ;
- ils ne sont pas sélectionnables ;
- ils ne sont pas des pistes ;
- ils ne sont pas utilisables comme cible de commande ;
- ils ne portent pas de libellé civil permanent.

L’aéroport de scénario `BASE` reste une entité FakeMS avec `AirportSymbol`, son identifiant et ses interactions existantes.

## Origine sans GPS

Lorsque le mode `REAL` est actif mais que le GPS est refusé, absent ou non encore disponible, FakeMS utilise le point simulé suivant :

```text
Port militaire de Toulon
43.1183 N, 5.9098 E
```

Le scénario initial est translaté autour de ce point. L’aéroport `BASE` est placé à la position de Toulon-Hyères (`43.0973 N, 6.1460 E`). Une position GPS valide remplace ensuite le repli simulé.

La position de Toulon ne constitue jamais une position réelle et ne doit pas être utilisée pour la navigation.

## Limites

Ce fond n’est pas une carte marine certifiée. Il ne fournit pas :

- bathymétrie ;
- dangers ou profondeurs ;
- chenaux ;
- feux, bouées ou aides à la navigation ;
- météo ;
- données aéronautiques opérationnelles complètes.
