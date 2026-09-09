# Frontière simulation / réel

## Mode par défaut

FakeMS démarre en `REAL` et demande la position GPS via le navigateur. La bannière permanente `SIMULATION · NOT FOR OPERATIONAL USE` reste visible, y compris dans la vue tablette et le shell PWA.

## Sources de navigation

- `SIM` : position issue de la cinématique locale du scénario, activée après sélection explicite de `SIM`.
- `GPS` : source navigateur demandée au démarrage lorsque le mode `REAL` est actif.

Sans GPS disponible, FakeMS utilise le repli de scénario du port militaire de Toulon (`43.1183, 5.9098`). Cette position reste simulée et ne doit pas être présentée comme une position réelle. Dès qu’une position GPS valide arrive, elle remplace le repli.

Les états GPS sont distincts : `ACQUIRING`, `VALID`, `DENIED`, `LOST` et `STALE`. Un refus GPS ne transforme pas une position SIM en position réelle.

## Limites

- aucun backend ou service cloud requis ;
- aucune clé API dans le code client ou le bundle ;
- aucune donnée classifiée ou opérationnelle ;
- aucune commande externe envoyée ;
- les effets métier sont soit simulés et journalisés, soit `NOT_IMPLEMENTED`.

## PWA et réseau

Le shell et les assets générés sont précachés par version de build. Les tuiles sont séparées du shell, limitées en nombre et expirées. Une tuile absente hors ligne retourne un état explicite ; elle n'est pas remplacée par une donnée inventée.

Une nouvelle version disponible est annoncée par une bannière. Le rechargement est déclenché par l'opérateur après envoi du message `SKIP_WAITING` au Service Worker.
