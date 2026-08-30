import { Position, SolverMetrics, SolverPreset, TrajectoryOption, TrajectoryLeg, SolverEnvironment } from '../types';
import { distanceBetween, bearingBetween, getDestinationPoint } from './geo';

const METERS_TO_NM = 1 / 1852;

export const DEFAULT_SOLVER_METRICS: SolverMetrics = {
  timeToTarget: 80,
  fuelEconomy: 45,
  sensorCoverage: 75,
  timeOnStation: 50,
  stealthSOD: 20,
  munitionsDelivery: 10,
};

export const PRESET_METRICS: Record<SolverPreset, SolverMetrics> = {
  FOCUS_MENACE: {
    timeToTarget: 95,
    fuelEconomy: 20,
    sensorCoverage: 85,
    timeOnStation: 35,
    stealthSOD: 15,
    munitionsDelivery: 30,
  },
  ECO_VENTS: {
    timeToTarget: 30,
    fuelEconomy: 95,
    sensorCoverage: 75,
    timeOnStation: 90,
    stealthSOD: 20,
    munitionsDelivery: 10,
  },
  BAYESIAN_GOFAST: {
    timeToTarget: 65,
    fuelEconomy: 55,
    sensorCoverage: 95,
    timeOnStation: 70,
    stealthSOD: 35,
    munitionsDelivery: 25,
  },
  MTO_STRIKE: {
    timeToTarget: 75,
    fuelEconomy: 35,
    sensorCoverage: 60,
    timeOnStation: 20,
    stealthSOD: 95,
    munitionsDelivery: 95,
  },
};

export const DEFAULT_SOLVER_ENV: SolverEnvironment = {
  windDirectionDeg: 235, // Wind coming from SW (235°)
  windSpeedKts: 18,      // 18 knots
  ownshipSpeedKts: 130,  // Cruising speed (knots)
  frigatePosition: { lat: 33.95, lon: -118.36 }, // BPH Aquitaine / Point C
  frigateLabel: 'FS AQUITAINE (PT C)',
  fuelCurrentKg: 780,    // Initial fuel 780 kg
  fuelConsumptionKgPerHour: 240, // 4 kg/min
  bingoMinReserveKg: 180, // Minimum safety reserve at landing
};

// ── CALCULATION HELPERS ──────────────────────────────────────────────────────

/**
 * Calculates effective ground speed and wind correction angle
 */
export function calculateGroundSpeed(
  courseDeg: number,
  airspeedKts: number,
  windFromDeg: number,
  windSpeedKts: number
): { groundSpeedKts: number; tailwindComponentKts: number } {
  const windToRad = ((windFromDeg + 180) % 360) * (Math.PI / 180);
  const courseRad = courseDeg * (Math.PI / 180);

  const headTailWind = windSpeedKts * Math.cos(courseRad - windToRad);
  const crossWind = windSpeedKts * Math.sin(courseRad - windToRad);

  const correctedAirspeed = Math.sqrt(Math.max(1, airspeedKts * airspeedKts - crossWind * crossWind));
  const groundSpeed = Math.max(30, correctedAirspeed + headTailWind);

  return {
    groundSpeedKts: groundSpeed,
    tailwindComponentKts: headTailWind,
  };
}

/**
 * Generates trajectory legs between a sequence of waypoints
 */
export function buildTrajectoryLegs(
  waypoints: (Position & { label?: string })[],
  env: SolverEnvironment
): TrajectoryLeg[] {
  const legs: TrajectoryLeg[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    const distMeters = distanceBetween(from.lat, from.lon, to.lat, to.lon);
    const distNm = distMeters * METERS_TO_NM;
    const bearing = bearingBetween(from.lat, from.lon, to.lat, to.lon);

    const { groundSpeedKts } = calculateGroundSpeed(
      bearing,
      env.ownshipSpeedKts,
      env.windDirectionDeg,
      env.windSpeedKts
    );

    const eteMin = (distNm / groundSpeedKts) * 60;
    const fuelBurnKg = (eteMin / 60) * env.fuelConsumptionKgPerHour;

    legs.push({
      from,
      to,
      distanceNm: parseFloat(distNm.toFixed(1)),
      bearingDeg: Math.round(bearing),
      speedKts: Math.round(groundSpeedKts),
      eteMin: parseFloat(eteMin.toFixed(1)),
      fuelBurnKg: Math.round(fuelBurnKg),
      label: to.label,
    });
  }

  return legs;
}

// ── TRAJECTORY SOLVER GENERATOR ──────────────────────────────────────────────

export function solveTrajectories(
  ownshipPos: Position,
  suspectPos: Position,
  secondaryTracks: Position[],
  env: SolverEnvironment,
  metrics: SolverMetrics
): TrajectoryOption[] {
  const frigatePos = env.frigatePosition;

  // --- Option 1: Focus Menace (Interception Prioritaire) ---
  const interceptPt1 = getDestinationPoint(suspectPos.lat, suspectPos.lon, 1200, 45); // slight lead
  const wptsMenace: (Position & { label?: string })[] = [
    { ...ownshipPos, label: 'START' },
    { ...interceptPt1, label: 'INTERCEPT FLIR (TN0012)' },
    secondaryTracks.length > 0
      ? { ...secondaryTracks[0], label: 'RECO SECONDAIRE' }
      : { lat: (interceptPt1.lat + frigatePos.lat) / 2, lon: (interceptPt1.lon + frigatePos.lon) / 2, label: 'PATROL RTN' },
    { ...frigatePos, label: env.frigateLabel },
  ];
  const legsMenace = buildTrajectoryLegs(wptsMenace, env);
  const totalDistMenace = legsMenace.reduce((acc, l) => acc + l.distanceNm, 0);
  const totalEteMenace = legsMenace.reduce((acc, l) => acc + l.eteMin, 0);
  const fuelBurnMenace = legsMenace.reduce((acc, l) => acc + l.fuelBurnKg, 0);
  const fuelRemMenace = Math.max(0, env.fuelCurrentKg - fuelBurnMenace);
  const bingoMarginMenace = Math.max(0, Math.round(((fuelRemMenace - env.bingoMinReserveKg) / env.fuelConsumptionKgPerHour) * 60));

  // --- Option 2: Focus Autonomie (Patrouille Éco-Vents) ---
  const southWindWpt = getDestinationPoint(ownshipPos.lat, ownshipPos.lon, 9500, 140);
  const radarSweepWpt = getDestinationPoint(suspectPos.lat, suspectPos.lon, 4200, 200);
  const wptsEco: (Position & { label?: string })[] = [
    { ...ownshipPos, label: 'START' },
    { ...southWindWpt, label: 'VENT ARRIERE (SUD)' },
    { ...radarSweepWpt, label: 'LOBE RADAR OPTIMAL' },
    { ...interceptPt1, label: 'CONTACT SUSPECT' },
    { ...frigatePos, label: env.frigateLabel },
  ];
  const legsEco = buildTrajectoryLegs(wptsEco, env);
  const totalDistEco = legsEco.reduce((acc, l) => acc + l.distanceNm, 0);
  const totalEteEco = legsEco.reduce((acc, l) => acc + l.eteMin, 0);
  const fuelBurnEco = legsEco.reduce((acc, l) => acc + (l.fuelBurnKg * 0.88), 0); // 12% savings due to tailwind
  const fuelRemEco = Math.max(0, env.fuelCurrentKg - fuelBurnEco);
  const bingoMarginEco = Math.max(0, Math.round(((fuelRemEco - env.bingoMinReserveKg) / env.fuelConsumptionKgPerHour) * 60));

  // --- Option 3: Recherche Bayésienne (Go-Fast / Coup de Faux) ---
  const sweepStart = getDestinationPoint(suspectPos.lat, suspectPos.lon, 7000, 310);
  const sweepEnd = getDestinationPoint(suspectPos.lat, suspectPos.lon, 7000, 130);
  const sweepTurn = getDestinationPoint(sweepEnd.lat, sweepEnd.lon, 4000, 40);
  const sweepReturn = getDestinationPoint(sweepTurn.lat, sweepTurn.lon, 12000, 310);

  const wptsBayes: (Position & { label?: string })[] = [
    { ...ownshipPos, label: 'START' },
    { ...sweepStart, label: 'IP COUP DE FAUX' },
    { ...sweepEnd, label: 'TRAVERS SILLAGE 1' },
    { ...sweepTurn, label: 'VIRAGE RECALCUL' },
    { ...sweepReturn, label: 'TRAVERS SILLAGE 2' },
    { ...frigatePos, label: env.frigateLabel },
  ];
  const legsBayes = buildTrajectoryLegs(wptsBayes, env);
  const totalDistBayes = legsBayes.reduce((acc, l) => acc + l.distanceNm, 0);
  const totalEteBayes = legsBayes.reduce((acc, l) => acc + l.eteMin, 0);
  const fuelBurnBayes = legsBayes.reduce((acc, l) => acc + l.fuelBurnKg, 0);
  const fuelRemBayes = Math.max(0, env.fuelCurrentKg - fuelBurnBayes);
  const bingoMarginBayes = Math.max(0, Math.round(((fuelRemBayes - env.bingoMinReserveKg) / env.fuelConsumptionKgPerHour) * 60));

  // --- Option 4: Tir MTO (Frappe & Relais Téléopéré) ---
  const standoffWpt = getDestinationPoint(suspectPos.lat, suspectPos.lon, 11000, 220); // 6 NM standoff
  const launchWpt = getDestinationPoint(standoffWpt.lat, standoffWpt.lon, 2000, 40);
  const orbitWpt = getDestinationPoint(launchWpt.lat, launchWpt.lon, 3500, 130);

  const wptsMto: (Position & { label?: string })[] = [
    { ...ownshipPos, label: 'START' },
    { ...standoffWpt, label: 'STANDOFF SOD 6NM' },
    { ...launchWpt, label: 'LARGAGE MTO' },
    { ...orbitWpt, label: 'ORBITE RELAIS B-LOS' },
    { ...frigatePos, label: env.frigateLabel },
  ];
  const legsMto = buildTrajectoryLegs(wptsMto, env);
  const totalDistMto = legsMto.reduce((acc, l) => acc + l.distanceNm, 0);
  const totalEteMto = legsMto.reduce((acc, l) => acc + l.eteMin, 0);
  const fuelBurnMto = legsMto.reduce((acc, l) => acc + l.fuelBurnKg, 0);
  const fuelRemMto = Math.max(0, env.fuelCurrentKg - fuelBurnMto);
  const bingoMarginMto = Math.max(0, Math.round(((fuelRemMto - env.bingoMinReserveKg) / env.fuelConsumptionKgPerHour) * 60));

  // Calculate composite scores based on current user metrics
  const scoreMenace = Math.round(
    (metrics.timeToTarget * 0.40) +
    (metrics.sensorCoverage * 0.35) +
    (metrics.fuelEconomy * 0.15) +
    (metrics.timeOnStation * 0.10)
  );

  const scoreEco = Math.round(
    (metrics.fuelEconomy * 0.45) +
    (metrics.timeOnStation * 0.30) +
    (metrics.sensorCoverage * 0.15) +
    (metrics.timeToTarget * 0.10)
  );

  const scoreBayes = Math.round(
    (metrics.sensorCoverage * 0.45) +
    (metrics.timeToTarget * 0.25) +
    (metrics.fuelEconomy * 0.20) +
    (metrics.timeOnStation * 0.10)
  );

  const scoreMto = Math.round(
    (metrics.munitionsDelivery * 0.45) +
    (metrics.stealthSOD * 0.35) +
    (metrics.timeToTarget * 0.10) +
    (metrics.fuelEconomy * 0.10)
  );

  const options: TrajectoryOption[] = [
    {
      id: 'opt-menace',
      preset: 'FOCUS_MENACE',
      title: 'Option 1 : Interception Prioritaire',
      subtitle: 'Focus Menace & Levée de doute rapide',
      color: '#ef4444', // Red-500
      waypoints: wptsMenace,
      legs: legsMenace,
      totalDistanceNm: parseFloat(totalDistMenace.toFixed(1)),
      totalEteMin: parseFloat(totalEteMenace.toFixed(1)),
      fuelBurnKg: Math.round(fuelBurnMenace),
      fuelRemainingAtFrigateKg: Math.round(fuelRemMenace),
      bingoMarginMin: bingoMarginMenace,
      detectionProbability: 96,
      limitingFactor: 'Délai critique : sortie Airplan du suspect estimée dans ~8 min.',
      tacticalRationale: 'Transit direct vers la piste suspecte TN0012 pour une identification optronique (FLIR) immédiate avant franchissement de la zone maritime ordonnée, puis enchaînement sur pistes secondaires.',
      score: scoreMenace,
      sensorFootprints: { flirSweepAngle: 35, radarLobeDeg: 45 },
    },
    {
      id: 'opt-eco',
      preset: 'ECO_VENTS',
      title: 'Option 2 : Patrouille Éco-Vents',
      subtitle: 'Focus Autonomie & Exploitation Météo',
      color: '#10b981', // Emerald-500
      waypoints: wptsEco,
      legs: legsEco,
      totalDistanceNm: parseFloat(totalDistEco.toFixed(1)),
      totalEteMin: parseFloat(totalEteEco.toFixed(1)),
      fuelBurnKg: Math.round(fuelBurnEco),
      fuelRemainingAtFrigateKg: Math.round(fuelRemEco),
      bingoMarginMin: bingoMarginEco,
      detectionProbability: 84,
      limitingFactor: 'Interception FLIR différée de +14 min (surveillance radar passive initiale).',
      tacticalRationale: 'Circuit débutant par les pistes Sud en profitant du vent arrière (235°/18kt) pour minimiser la consommation. Interception du suspect quand sa route coupe le lobe radar optimal.',
      score: scoreEco,
      sensorFootprints: { radarLobeDeg: 60 },
    },
    {
      id: 'opt-bayes',
      preset: 'BAYESIAN_GOFAST',
      title: 'Option 3 : Recherche Bayésienne',
      subtitle: 'Coup de Faux transversal sur Datum Go-Fast',
      color: '#f59e0b', // Amber-500
      waypoints: wptsBayes,
      legs: legsBayes,
      totalDistanceNm: parseFloat(totalDistBayes.toFixed(1)),
      totalEteMin: parseFloat(totalEteBayes.toFixed(1)),
      fuelBurnKg: Math.round(fuelBurnBayes),
      fuelRemainingAtFrigateKg: Math.round(fuelRemBayes),
      bingoMarginMin: bingoMarginBayes,
      detectionProbability: 92,
      limitingFactor: 'Charge pilote accrue pendant les virages serrés en bord d’Airplan.',
      tacticalRationale: 'Balayage transversal à 90° de l’axe de fuite probable pour maximiser l’exposition de la coque et la détection radar/optronique du sillage dans l’ellipse de certitude.',
      score: scoreBayes,
      sensorFootprints: { radarLobeDeg: 80, flirSweepAngle: 50 },
    },
    {
      id: 'opt-mto',
      preset: 'MTO_STRIKE',
      title: 'Option 4 : Neutralisation MTO',
      subtitle: 'Frappe Téléopérée & Respect SOD',
      color: '#a855f7', // Purple-500
      waypoints: wptsMto,
      legs: legsMto,
      totalDistanceNm: parseFloat(totalDistMto.toFixed(1)),
      totalEteMin: parseFloat(totalEteMto.toFixed(1)),
      fuelBurnKg: Math.round(fuelBurnMto),
      fuelRemainingAtFrigateKg: Math.round(fuelRemMto),
      bingoMarginMin: bingoMarginMto,
      detectionProbability: 98,
      limitingFactor: 'Portée maximale de liaison de données téléopération (B-LOS).',
      tacticalRationale: 'Approche sécurisée avec maintien de la Stand-off Distance (SOD 6 NM), largage de munition téléopérée et mise en hippodrome de guidage avant retour frégate.',
      score: scoreMto,
    },
  ];

  return options.sort((a, b) => b.score - a.score);
}

// ── ALTITUDE & SENSOR CALIBRATION (CONOPS Section 5.1) ───────────────────────

export interface AltitudeOption {
  altitudeFt: number;
  radarRangeNm: number;
  opticalFlirRangeNm: number;
  smallTargetPd: number; // 0 - 100 %
  areaCoverageRateNm2PerHour: number;
  fuelBurnKgPerHour: number;
  recommendedFor: string;
  isOptimal: boolean;
  rationale: string;
}

export function evaluateAltitudeProfiles(
  targetType: 'SMALL_SKIFF' | 'GO_FAST' | 'CARGO_VESSEL',
  hasTemperatureInversion: boolean = true
): AltitudeOption[] {
  if (targetType === 'SMALL_SKIFF') {
    return [
      {
        altitudeFt: 500,
        radarRangeNm: hasTemperatureInversion ? 18 : 12,
        opticalFlirRangeNm: 9,
        smallTargetPd: 94,
        areaCoverageRateNm2PerHour: 1200,
        fuelBurnKgPerHour: 252,
        recommendedFor: 'Levée de doute & détection sillage bas',
        isOptimal: false,
        rationale: '+18% détection petites cibles mais couverture globale réduite de -27% et consommation accrue de +5% due à la densité de l\'air.',
      },
      {
        altitudeFt: 2000,
        radarRangeNm: hasTemperatureInversion ? 32 : 26,
        opticalFlirRangeNm: 15,
        smallTargetPd: 82,
        areaCoverageRateNm2PerHour: 2400,
        fuelBurnKgPerHour: 240,
        recommendedFor: 'Compromis Standard Surveillance Maritime (MISR)',
        isOptimal: true,
        rationale: 'Optimum global : horizon radar étendu au-delà de l\'inversion thermique et portée FLIR maximale pour balayage rapide de l\'Airplan.',
      },
      {
        altitudeFt: 5000,
        radarRangeNm: hasTemperatureInversion ? 36 : 42,
        opticalFlirRangeNm: 11,
        smallTargetPd: 45,
        areaCoverageRateNm2PerHour: 3600,
        fuelBurnKgPerHour: 228,
        recommendedFor: 'Recherche grand large / cibles majeures',
        isOptimal: false,
        rationale: 'Portée radar longue mais angle d\'incidence défavorable pour petites embarcations et atténuation optique accrue.',
      },
    ];
  }

  // Fallback for larger vessels / generic
  return [
    {
      altitudeFt: 500,
      radarRangeNm: 22,
      opticalFlirRangeNm: 10,
      smallTargetPd: 98,
      areaCoverageRateNm2PerHour: 1400,
      fuelBurnKgPerHour: 250,
      recommendedFor: 'Identification visuelle basse altitude',
      isOptimal: false,
      rationale: 'Identification visuelle positive directe.',
    },
    {
      altitudeFt: 2000,
      radarRangeNm: 40,
      opticalFlirRangeNm: 18,
      smallTargetPd: 90,
      areaCoverageRateNm2PerHour: 2800,
      fuelBurnKgPerHour: 240,
      recommendedFor: 'Patrouille standard',
      isOptimal: true,
      rationale: 'Excellente balance couverture radar / consommation.',
    },
    {
      altitudeFt: 5000,
      radarRangeNm: 60,
      opticalFlirRangeNm: 14,
      smallTargetPd: 75,
      areaCoverageRateNm2PerHour: 4200,
      fuelBurnKgPerHour: 225,
      recommendedFor: 'Veille lointaine RMP',
      isOptimal: false,
      rationale: 'Couverture maximale de la zone d\'opération.',
    },
  ];
}

// ── CONTRASTIVE DIALOGUE QUESTIONS & EXPLANATIONS (RADAR-X / CONOPS 4.4) ─────

export interface ContrastiveQA {
  id: string;
  question: string;
  category: 'ALTITUDE' | 'ROUTING' | 'SPEED' | 'SAFETY';
  responseTitle: string;
  tradeOffs: { label: string; value: string; positive: boolean }[];
  primaryConflict: string;
  aiRationale: string;
  suggestedActionLabel?: string;
  suggestedActionPreset?: SolverPreset;
  suggestedMetricsDelta?: Partial<SolverMetrics>;
}

export const CONTRASTIVE_KNOWLEDGE_BASE: ContrastiveQA[] = [
  {
    id: 'why-not-alt-500',
    question: 'Pourquoi pas une altitude de 500 ft ?',
    category: 'ALTITUDE',
    responseTitle: '500 ft est réalisable sous réserve d\'arbitrage.',
    tradeOffs: [
      { label: 'Détection petite cible / sillage', value: '+18%', positive: true },
      { label: 'Couverture surfacique horaire', value: '-27%', positive: false },
      { label: 'Consommation carburant (air dense)', value: '+4%', positive: false },
    ],
    primaryConflict: 'PRIORITÉ MISSION = COUVERTURE GLOBALE AIRPLAN',
    aiRationale: 'À 500 ft, le masque de l\'horizon radar réduit la visibilité des autres contacts dans l\'Airplan. Si votre intention est de focaliser sur le sillage du suspect, confirmez l\'arbitrage.',
    suggestedActionLabel: 'Prioriser Détection Petite Cible (+18% FLIR)',
    suggestedMetricsDelta: { sensorCoverage: 95, timeToTarget: 80, fuelEconomy: 30 },
  },
  {
    id: 'why-not-direct-frigate',
    question: 'Pourquoi ne pas rentrer directement à la frégate ?',
    category: 'ROUTING',
    responseTitle: 'Transit direct BPH disponible mais perte de la levée de doute.',
    tradeOffs: [
      { label: 'Économie carburant (marge Bingo)', value: '+42 kg (+11 min)', positive: true },
      { label: 'Neutralisation incertitude tactique', value: '-100%', positive: false },
      { label: 'Couverture RMP', value: '-65%', positive: false },
    ],
    primaryConflict: 'OBJECTIF PRIMAIRE = IDENTIFICATION TN0012',
    aiRationale: 'Le transit direct préserve au maximum le carburant mais abandonne la levée de doute sur la piste non-coopérative TN0012 avant qu\'elle ne quitte l\'Airplan.',
    suggestedActionLabel: 'Adopter Patrouille Éco-Vents (Compromis Carburant)',
    suggestedActionPreset: 'ECO_VENTS',
  },
  {
    id: 'why-not-high-speed',
    question: 'Pourquoi pas vitesse max (140 kts) ?',
    category: 'SPEED',
    responseTitle: 'Vitesse 140 kts possible mais impacte la réserve Bingo.',
    tradeOffs: [
      { label: 'Temps de transit (ETE vers contact)', value: '-3.2 min', positive: true },
      { label: 'Débit carburant', value: '+35% (324 kg/h)', positive: false },
      { label: 'Marge Bingo Fuel au posé', value: 'Critique (<14 min)', positive: false },
    ],
    primaryConflict: 'CONTRAINTE INVARIANTE (RTA) = RÉSERVE BINGO >= 180 KG',
    aiRationale: 'Le solveur maintient la vitesse de croisière optimale (130 kts) pour garantir un retour sécurisé au BPH sans franchir le seuil d\'alerte Bingo.',
    suggestedActionLabel: 'Forcer Vitesse Max (Focus Menace)',
    suggestedActionPreset: 'FOCUS_MENACE',
  },
  {
    id: 'why-standoff-6nm',
    question: 'Quelle contrainte impose la Stand-off Distance (SOD 6 NM) ?',
    category: 'SAFETY',
    responseTitle: 'Maintien hors de portée des systèmes de défense sol-air de fortune.',
    tradeOffs: [
      { label: 'Protection équipage & aéronef', value: 'Maximale', positive: true },
      { label: 'Portée de tir MTO requise', value: '6 NM', positive: true },
      { label: 'Identification optique directe', value: 'Remplacée par relais B-LOS', positive: false },
    ],
    primaryConflict: 'POSTURE TACTIQUE = DISCRÈTE / SÉCURISÉE',
    aiRationale: 'La doctrine SIGMA applique une barrière stricte SOD 6 NM en phase de frappe téléopérée pour préserver l\'hélicoptère tout en maintenant le lien de données.',
    suggestedActionLabel: 'Activer Mode Frappe MTO',
    suggestedActionPreset: 'MTO_STRIKE',
  },
];

// ── BAYESIAN SEARCH & ELLIPSE MODEL (CONOPS Section 5.3.2) ───────────────────

import { BayesianSearchModel, TrackClassification } from '../types';

/**
 * Generates an oriented ellipse polygon in [lat, lon] coordinates
 */
export function generateEllipsePolygon(
  centerLat: number,
  centerLon: number,
  semiMajorMeters: number,
  semiMinorMeters: number,
  orientationDeg: number,
  numPoints: number = 36
): [number, number][] {
  const points: [number, number][] = [];
  const orientRad = (orientationDeg * Math.PI) / 180;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const x0 = semiMinorMeters * Math.cos(theta);
    const y0 = semiMajorMeters * Math.sin(theta);

    // Rotate clockwise from North
    const sinO = Math.sin(orientRad);
    const cosO = Math.cos(orientRad);
    const east = x0 * cosO + y0 * sinO;
    const north = -x0 * sinO + y0 * cosO;

    const distMeters = Math.hypot(east, north);
    const bearing = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;

    const pt = getDestinationPoint(centerLat, centerLon, distMeters, bearing);
    points.push([pt.lat, pt.lon]);
  }
  return points;
}

export function generateBayesianSearchModel(
  datumCenter: Position,
  datumHeadingDeg: number,
  datumSpeedKts: number,
  timeElapsedMin: number
): BayesianSearchModel {
  const speedMps = datumSpeedKts * 0.5144;
  const distTravelledMeters = speedMps * (timeElapsedMin * 60);
  const currentCenter = getDestinationPoint(
    datumCenter.lat,
    datumCenter.lon,
    distTravelledMeters,
    datumHeadingDeg
  );

  const contours: BayesianSearchModel['contours'] = [
    {
      level: 'OUTER',
      probabilityLabel: 'P ≥ 20%',
      color: '#10b981', // Emerald
      fillOpacity: 0.12,
      points: generateEllipsePolygon(currentCenter.lat, currentCenter.lon, 6.8 * 1852, 3.8 * 1852, datumHeadingDeg),
    },
    {
      level: 'MID',
      probabilityLabel: 'P ≥ 50%',
      color: '#f59e0b', // Amber
      fillOpacity: 0.25,
      points: generateEllipsePolygon(currentCenter.lat, currentCenter.lon, 4.2 * 1852, 2.2 * 1852, datumHeadingDeg),
    },
    {
      level: 'CORE',
      probabilityLabel: 'P ≥ 80%',
      color: '#ef4444', // Red
      fillOpacity: 0.45,
      points: generateEllipsePolygon(currentCenter.lat, currentCenter.lon, 2.2 * 1852, 1.1 * 1852, datumHeadingDeg),
    },
  ];

  const sweepStart = getDestinationPoint(currentCenter.lat, currentCenter.lon, 4.5 * 1852, (datumHeadingDeg - 90 + 360) % 360);
  const sweepEnd = getDestinationPoint(currentCenter.lat, currentCenter.lon, 4.5 * 1852, (datumHeadingDeg + 90) % 360);

  return {
    datumCenter,
    estimatedCurrentPos: currentCenter,
    headingDeg: datumHeadingDeg,
    speedKts: datumSpeedKts,
    timeElapsedMin,
    contours,
    transversalSweepLeg: {
      start: sweepStart,
      end: sweepEnd,
    },
  };
}

export const CLASSIFIED_TRACKS_DATABASE: TrackClassification[] = [
  {
    entityId: 'en-1',
    label: 'TN0012 (SUSPECT)',
    type: 'ENEMY',
    classification: 'SUSPECT_LEVEL_2',
    confidenceScore: 4,
    radarSERM2: 12,
    polCompliance: 'NO_AIS_EMISSION',
    rationale: 'Aucune émission AIS reçue. Écho radar SER 12m² incompatible avec profil marchand standard. Trajectoire coupant les couloirs côtiers.',
    recommendedAction: 'Levée de doute optronique FLIR requise avant sortie Airplan.',
  },
  {
    entityId: 'en-2',
    label: 'GO-FAST DATUM',
    type: 'ENEMY',
    classification: 'HOSTILE',
    confidenceScore: 5,
    radarSERM2: 8,
    polCompliance: 'DEVIATION',
    rationale: 'Vitesse soutenue de 32 kts au cap 320°. Comportement d\'évasion maritime sans escale.',
    recommendedAction: 'Interception par Coup de Faux transversal sur grille bayésienne.',
  },
  {
    entityId: 'wp-1',
    label: 'G01 (TRAFIC AIS)',
    type: 'WAYPOINT',
    classification: 'CIVIL_CONFIRMED',
    confidenceScore: 1,
    radarSERM2: 140,
    aisBroadcastLengthM: 180,
    polCompliance: 'COMPLIANT_ROUTE',
    rationale: 'Navire porte-conteneurs civil régulier. Données AIS conformes au cap et à la vitesse du rail.',
    recommendedAction: 'Poursuite de veille normale RMP.',
  },
  {
    entityId: 'wp-2',
    label: 'BRAVO (AIS)',
    type: 'WAYPOINT',
    classification: 'CIVIL_CONFIRMED',
    confidenceScore: 1,
    radarSERM2: 35,
    aisBroadcastLengthM: 42,
    polCompliance: 'COMPLIANT_ROUTE',
    rationale: 'Chalutier de pêche local opérant en zone autorisée.',
    recommendedAction: 'Aucune action requise.',
  },
];

