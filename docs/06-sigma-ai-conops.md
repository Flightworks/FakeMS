# SIGMA : Système d'Intelligence et de Guidage de Mission Aéromaritime
**Stratégie SIGNAL — Aide Tactique Augmentée pour H160M Guépard (HIL)**

---

## 1. Résumé Exécutif (BLUF)

* **Objectif** : Fournir une assistance tactique de haut niveau ("Man-over-the-loop") à l'équipage à deux pilotes du H160M Guépard pour réduire la charge cognitive et valoriser la donnée en vol.
* **Doctrine** : Alignement sur la stratégie **SIGNAL** (Marine Nationale) et les niveaux d'interaction IA **EASA Level 2 / Level 3A**.
* **Principes Clés** :
  1. **Command by Intent** : L'opérateur pilote des intentions et des priorités tactiques (temps de transit, économie de carburant, probabilité de détection, stand-off SOD), pas des micro-actions.
  2. **Continuous Mission Reasoning** : Réévaluation en temps réel sous contraintes opérationnelles (vent, météo, autonomie résiduelle).
  3. **Justifiable Recommendations (RADAR-X)** : Dialogue contrastif (« Pourquoi pas cette option ? », « Quels sont les compromis ? »).
  4. **Bounded Authority (Runtime Assurance - RTA)** : Barrières de sécurité strictes et vérifiables (réserve Bingo Fuel inviolable, SOD, respect des limites de l'Airplan).

---

## 2. Modes du Solveur Multi-Critères

### Option 1 : Interception Prioritaire (Focus Menace)
* **Objectif** : Transit direct vers la piste suspecte non-coopérative (sans signal AIS) pour identification optronique FLIR avant qu'elle ne s'échappe de la zone Airplan.
* **Avantage** : Neutralisation immédiate de l'incertitude tactique.
* **Compromis** : Consommation de carburant supérieure à la moyenne, marge Bingo réduite.

### Option 2 : Patrouille Éco-Vents (Focus Autonomie)
* **Objectif** : Circuit débutant par les pistes Sud en profitant du vent arrière (SW 235° / 18 kts) pour minimiser la consommation. L'interception du suspect est synchronisée avec l'intersection de son cap et du lobe optimal du radar.
* **Avantage** : Gain de +12% de carburant, prolongation du temps de présence sur zone (Time on Station).

### Option 3 : Recherche Bayésienne (Go-Fast / Coup de Faux)
* **Objectif** : Recherche sur Datum d'une embarcation rapide non-coopérative à l'aide d'une grille de probabilités bayésiennes $P(\text{présence}) \times P(\text{détection})$.
* **Tactique** : Trajectoire transversale (« Coup de Faux ») coupant l'ellipse de probabilité à 90° pour exposer au maximum la coque et le sillage aux capteurs.

### Option 4 : Neutralisation MTO (Munition Téléopérée)
* **Objectif** : Approche sécurisée avec respect strict de la Stand-off Distance (SOD >= 6 NM), largage et hippodrome de guidage par liaison de données B-LOS.

---

## 3. Mise en Condition Senseurs & Optimisation d'Altitude

* **Horizon Radar & Réfraction** : Calcul de la portée réelle selon l'altitude et présence d'une inversion de température (conduit troposphérique à 1200 ft : +15 NM de portée radar à 500 ft).
* **Compromis d'Altitude** :
  * **500 ft** : +18% détection petite cible/sillage, mais -27% de couverture surfacique horaire et +4% de consommation (air dense).
  * **2000 ft** : Optimum standard pour la mission SURMAR (Airplan Alpha).
  * **5000 ft** : Couverture radar étendue mais angle d'incidence dégradé pour les petits échos et atténuation FLIR.

---

## 4. Cadre Réglementaire EASA & Human-AI Teaming

| Niveau EASA | Autorité de l'IA | Rôle Humain | Analogie |
| :--- | :--- | :--- | :--- |
| **Level 2A** | Limitée | Coopération Homme-IA | *Human in the loop* |
| **Level 2B** | Partiellement déléguée | Supervision complète, reprise en main immédiate | *Human on the loop* |
| **Level 3A** | Pleine autorité pour agir | Surveillance distante, intervention par exception | *Human over the loop* |
| **Level 3B** | Pleine autorité totale | Autonomie non supervisée | *Autonomie complète* |

*Le système SIGMA implémente prioritairement une architecture de **Niveau 2/3A** où l'opérateur valide ou adapte les propositions générées par le solveur.*
