# Scénarios de tâches IHM FakeMS

> **L0/T02 — protocole statique.** Ces scénarios décrivent la cible de comparaison ; ils ne prouvent pas que le comportement est implémenté. Une précondition indisponible est notée comme telle, jamais remplacée par une valeur inventée.

## Usage et variantes

Exécuter chaque scénario avec la même fixture, le même seed, le même viewport et le même appareil pour les variantes comparées. Relever les valeurs brutes et le dénominateur ; ne pas convertir une réussite de test technique en conclusion ergonomique.

Variantes de référence :

- **D-dev** : état de `dev/mission-simulation-foundation` audité au commit `69b1392a6c1859f8cfd919a9095b66b77bed415a` (version 1.4.0). À utiliser comme référence observée seulement pour les parcours qu’il permet réellement.
- **D-main** : état `main` au commit `5d528c2989f95e982309001dbff3d5ffd127280e` (version 1.3.6), référence historique de structure et de présentation ; ce n’est pas une campagne fonctionnelle complète.
- **C-badge** / **C-chaîne** : badge de valeur principale avec détails à la demande / chaîne secondaire historique.
- **C-radial** / **C-geste** : taps successifs avec annulation explicite / geste expert par maintien-glissement.
- **C-PW** / **C-PW-historique** : états et choix formulés par effet / réglages historiques formulés par abréviations.
- **C-protégée** : chemins unifiés et confirmation commune, variante cible à comparer aux références existantes.

Aucune variante `C-*` n’est déclarée livrée par ce document.

## Mesures communes

- **R** : réussite sans aide (0/1) et condition d’abandon ;
- **T** : temps total ; **T recherche** : temps avant le premier geste intentionnel ;
- **G** : nombre de gestes/activations ; **AR** : retours arrière ;
- **E cible / mode / source** : erreurs de cible, de mode ou de provenance ;
- **AI** : activation involontaire ; **CA** : annulation réussie ; **RI** : reprise après interruption ;
- **O** : occultation par la main ou le clavier ; **Aide** : demandes d’explication.

Après chaque bloc de scénarios, administrer le même NASA-TLX (méthode et version consignées). Ce score subjectif reste séparé des mesures de performance.

## Scénarios

### S01 — ETE vers BRAVO sans GPS

**Action.** Démarrer la fixture Toulon sans GPS, ouvrir la palette, saisir `ETE BRAVO` et valider. Lire le badge puis identifier la source de la position et de la vitesse.

**Attendu observable.** Une ETE calculée apparaît avec unité et qualification `SCÉNARIO`. La source position/vitesse est identifiable ; l’absence de GPS n’est pas présentée comme une panne de l’ETE et aucune heure réelle n’est confondue avec la durée scénario.

**Mesurer.** `R`, `T`, `T recherche`, `G`, `E source`, `Aide`.

**Comparaison.** `D-dev` contre `C-badge` et la présentation de qualification de `C-protégée`.

### S02 — ETE avec vitesse sol absente

**Action.** Rejouer la même demande avec une position qualifiée mais sans vitesse sol. Saisir ensuite une hypothèse `120 kt` par le contrôle prévu, sans modifier silencieusement la donnée source.

**Attendu observable.** Le résultat indique `Vitesse sol absente` ou une raison équivalente, sans durée fictive. Après saisie, la valeur porte `GS HYPOTHÈSE 120 kt` et conserve la provenance des positions ; la mesure et l’hypothèse sont visuellement distinctes.

**Mesurer.** `R`, `T`, `G`, erreurs mesure/hypothèse, `Aide`, confusion de source.

**Comparaison.** `D-dev` contre `C-badge` avec détail à la demande et qualification immédiate.

### S03 — CPA d’une cible ambiguë et périmée

**Action.** Préparer deux candidats `HOSTILE 1`, saisir `CPA HOSTILE 1`, choisir explicitement le candidat voulu, puis lire CPA/TCPA et l’âge de la donnée.

**Attendu observable.** Aucun calcul ni effet n’est appliqué avant le choix. Tous les candidats accessibles restent visibles ; le résultat indique distance, délai, fraîcheur et hypothèse de vitesses constantes lorsque nécessaire.

**Mesurer.** `R`, `T recherche`, `T`, `G`, erreurs de cible, erreur de fraîcheur, activations avant résolution.

**Comparaison.** `D-dev` contre une résolution explicite `C-protégée`; `D-main` sert uniquement de comparaison de présentation si une sortie comparable est disponible.

### S04 — Radial de piste près d’un bord

**Action.** Sélectionner une piste placée près de chacun des quatre bords, ouvrir son menu radial, afficher sa trajectoire, puis ouvrir une autre sélection et annuler par le centre ou l’extérieur.

**Attendu observable.** Le titre et la cible restent ceux du contexte capturé ; le radial est implanté dans la zone sûre sans changer l’ordre des secteurs. La trajectoire devient observable ; l’annulation ne sélectionne ni n’active la feuille survolée.

**Mesurer.** `R`, `T`, `G`, `CA`, ratés de secteur au bord, `AI`, changement involontaire de cible.

**Comparaison.** `D-dev` contre `C-radial` et `C-geste`, avec le même ordre de secteurs.

### S05 — Stabilisation après pan

**Action.** Avec ownship en mouvement, effectuer un pan, ouvrir `PW STABLN`, passer à l’ancrage sol, changer l’orientation Nord/Cap, puis demander le recentrage ou le retour prévu.

**Attendu observable.** L’état fermé décrit l’effet courant (`SOL · NORD`, par exemple). Chaque choix produit l’effet cartographique annoncé ; le mode, la cible et le retour restent compréhensibles après le pan.

**Mesurer.** `R`, `T recherche`, `T`, `G`, erreurs de mode, succès du retour, `Aide`.

**Comparaison.** `D-dev` contre `C-PW` et `C-PW-historique`.

### S06 — Direct simulé confirmé puis annulé

**Action.** Depuis le contexte de BRAVO, préparer un direct simulé. Annuler la première proposition, recommencer, confirmer une seule fois et observer la route active.

**Attendu observable.** La préparation ne modifie pas la route. `Annuler` laisse le scénario inchangé ; après confirmation, la route ou l’état local correspondant est visible, avec libellé `SIMULÉ` et cible BRAVO. Le même effet et la même protection existent depuis le radial et la palette.

**Mesurer.** `R`, `T`, `G`, `CA`, nombre de validations/confirmations, `AI`, route modifiée après annulation.

**Comparaison.** `D-dev` contre `C-protégée` avec confirmation commune ; `D-main` n’est qu’une référence historique si son parcours n’a pas le même modèle.

### S07 — Vecteurs par PW, palette et radial

**Action.** Masquer les vecteurs depuis le PW, vérifier la carte, puis consulter et modifier le même état depuis la palette et le radial sans changer de cible.

**Attendu observable.** Les trois chemins montrent le même état effectif et le rendu passe réellement de vecteurs visibles à absents (et retour). L’allègement ne masque pas la différence entre état demandé et état rendu.

**Mesurer.** `R`, `T`, `G`, divergences d’état, nombre de polylignes avant/après, `AI`.

**Comparaison.** `D-dev` contre `C-protégée` à état de couche unique.

### S08 — Reprise après interruption

**Action.** Commencer une tâche sur une cible, interrompre la saisie ou l’aperçu, ouvrir un autre PW ou panneau, puis revenir et reprendre la tâche initiale.

**Attendu observable.** La cible, le mode, les données et le focus sont retrouvés ou leur perte est annoncée. L’ouverture du second panneau ne déclenche pas l’action interrompue et la reprise n’exécute rien sans l’étape explicite attendue.

**Mesurer.** `R`, `T`, `G`, `RI`, `AR`, erreurs de cible/mode, restauration du focus, `AI`.

**Comparaison.** `D-dev` contre `C-protégée` avec identifiants et contexte stables.

### S09 — Palette avec clavier virtuel

**Action.** Ouvrir le clavier virtuel, demander un résultat, lire le badge et sa qualification, tenter de copier, puis fermer le clavier et la palette.

**Attendu observable.** Le badge, l’unité, la cause utile et la fermeture restent atteignables. Une copie indisponible (par exemple en contexte HTTP LAN non sécurisé) est refusée honnêtement ; elle ne fabrique pas de succès et ne déclenche aucune action mission.

**Mesurer.** `R`, `T`, `G`, `O`, statut de copie, fermeture/focus, `AI`, `Aide`.

**Comparaison.** `D-dev` contre `C-badge` et la variante cible de clavier/focus ; conserver la contrainte de sécurité du navigateur.

### S10 — Côte, zooms et repli hors ligne

**Action.** À plusieurs zooms, reconnaître la rade, les passes et les îles, recharger ou poursuivre avec le pack hors ligne, puis provoquer une indisponibilité du détail côtier.

**Attendu observable.** Le fond global reste présent si le détail échoue ; un état discret indique `détail côtier indisponible` sans transformer la zone en mer opaque. Avec un pack valide, les secteurs attendus sont lisibles hors ligne et aucun appel externe n’est requis.

**Mesurer.** `R`, `T`, zoom atteint, repères reconnus, temps de repli, appels réseau, `O`, erreurs dues au masque, `Aide`.

**Comparaison.** `D-dev` contre la variante de repli sûr et pack validé ; ce scénario ne préjuge pas de la source cartographique finale.

### S11 — RESET/REPLAY depuis chaque accès

**Action.** Depuis chaque chemin qui expose `SIM RESET` ou `SIM REPLAY` (PW, palette, radial), ouvrir la demande, annuler, puis recommencer et confirmer.

**Attendu observable.** L’ouverture et l’annulation ne changent ni heure, ni entités, ni route, ni trajectoire. Une confirmation explicite applique exactement une fois l’opération demandée ; aucun accès ne l’exécute directement.

**Mesurer.** `R`, `G`, `CA`, nombre de confirmations, mutations après annulation, double exécution, contexte conservé.

**Comparaison.** `D-dev` contre `C-protégée` avec dispatcher et confirmation communs.

### S12 — Version servie et retour à la mission

**Action.** Ouvrir `VER` via la QAK, consulter le changelog, vérifier la version réellement servie, puis revenir à la mission.

**Attendu observable.** Version, build et changelog concordent avec l’artefact servi. Le retour est atteignable, restaure le contexte de mission prévu et ne déclenche ni modification de scénario ni navigation définitive non annoncée.

**Mesurer.** `R`, `T recherche`, `T`, `G`, concordance version/build, restauration du contexte, `AI`.

**Comparaison.** `D-dev` contre la variante cible avec QAK `VER` protégée ; `D-main` reste une référence historique de présentation.

## Rapport de campagne

Pour chaque scénario et variante, consigner viewport, appareil, fixture/seed, préconditions, valeurs brutes de `R/T/G`, erreurs et abandons. Un résultat « non exécutable » décrit l’écart de capacité ; il ne doit pas être transformé en réussite. Les conclusions facteurs humains exigent ensuite des utilisateurs représentatifs et le matériel cible ; ce fichier seul ne constitue pas une qualification.
