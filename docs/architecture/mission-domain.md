# Domaine mission FakeMS

## Positionnement

FakeMS est un démonstrateur HMI local. Il représente des états et des décisions de simulation. Il ne pilote aucun système réel, ne fournit aucune autorisation opérationnelle et ne remplace pas une chaîne mission certifiée.

## Couches

1. **Scénario** — données initiales déterministes et versionnées dans `data/scenarios/`.
2. **Vérité simulée** — entités et cinématique locale produites par le moteur de simulation.
3. **Observations capteurs** — rapports RADAR, AIS, ADS-B et EOTS avec source, âge, qualité et incertitude.
4. **Pistes fusionnées** — pistes construites à partir des rapports ; elles conservent provenance et confiance.
5. **Mesures** — valeurs `MEASURED`, `ESTIMATED`, `CALCULATED` ou `UNAVAILABLE`, avec qualification explicite.
6. **Intentions et propositions** — demande opérateur, contraintes et alternatives déterministes. Une proposition n'est pas une action exécutée.
7. **Présentation React** — affichage et transmission d'intentions ; les règles géographiques et de faisabilité restent dans le domaine TypeScript.

## Géographie

Les latitudes/longitudes sont des positions WGS84. Les calculs de distance et de relèvement utilisent des fonctions géodésiques. Lorsque la carte a besoin d'un déplacement local, `domain/mapCoordinates.ts` convertit explicitement la position en mètres est/nord et gère l'antiméridien.

Une altitude terrain indisponible est affichée `N/A`. FakeMS ne fabrique pas une hauteur par coefficient arbitraire.

## Intentions et autorité

Pour une action mission :

```text
PROPOSED → PREVIEWED → AUTHORIZED → EXECUTING_SIM → COMPLETED_SIM
```

Les branches `REJECTED`, `FAILED_SIM` et `NOT_IMPLEMENTED` restent visibles et sont journalisées. `COMPLETED_SIM` n'est produit qu'après exécution d'un effet simulé injecté et réussi.

`FOCUS` ne crée pas de route. `DCT` crée une proposition séparée. L'acceptation reste une autorisation de simulation, jamais une autorisation réelle.

## Déterminisme

Le moteur accepte une graine et une horloge contrôlable. Les scénarios sont clonés avant exécution. Un même scénario, une même graine et les mêmes pas de temps doivent produire le même replay.
