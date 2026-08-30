import React, { useState } from 'react';
import {
  Entity, TrajectoryOption, SolverMetrics, SolverEnvironment,
  Position, AltitudeOption, ContrastiveQA, TrackClassification, BayesianSearchModel
} from '../types';
import {
  PRESET_METRICS, evaluateAltitudeProfiles, CONTRASTIVE_KNOWLEDGE_BASE,
  CLASSIFIED_TRACKS_DATABASE, DEFAULT_SOLVER_ENV
} from '../utils/solverEngine';
import {
  Sparkles, Layers, Shield, Play, Check, AlertTriangle, Wind,
  Navigation, HelpCircle, Activity, ChevronRight, X, Compass,
  Radio, Crosshair, RefreshCw, Eye, Target, ArrowRight, Gauge
} from 'lucide-react';

export type SigmaModuleType =
  | 'SENSORS_WEATHER'    // Module 1 : Mise en condition & propagation
  | 'SURMAR_ROUTING'     // Module 2 : Mission SURMAR / MISR & Multi-critères
  | 'TRACK_CLASSIFICATION' // Module 3 : Classification automatique & POL
  | 'BAYESIAN_INTERCEPT' // Module 4 : Interception Bayésienne Go-Fast
  | 'MTO_PROCEDURE';     // Module 5 : Procédure Frappe MTO & SOD

interface SigmaMissionCenterProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: SigmaModuleType;
  setActiveModule: (mod: SigmaModuleType) => void;
  ownship: Entity;
  entities: Entity[];
  environment: SolverEnvironment;
  options: TrajectoryOption[];
  activeTrajectory: TrajectoryOption | null;
  selectedOptionId: string | null;
  onSelectOption: (option: TrajectoryOption | null) => void;
  onAcceptTrajectory: (option: TrajectoryOption) => void;
  onUpdateAltitude: (altFt: number) => void;
  onTriggerKinematicBreak: () => void;
  bayesianHeatmapActive: boolean;
  setBayesianHeatmapActive: (val: boolean) => void;
  metrics: SolverMetrics;
  setMetrics: React.Dispatch<React.SetStateAction<SolverMetrics>>;
  deviationAlert: { active: boolean; message: string } | null;
  onDismissAlert: () => void;
}

export const SigmaMissionCenter: React.FC<SigmaMissionCenterProps> = ({
  isOpen,
  onClose,
  activeModule,
  setActiveModule,
  ownship,
  entities,
  environment,
  options,
  activeTrajectory,
  selectedOptionId,
  onSelectOption,
  onAcceptTrajectory,
  onUpdateAltitude,
  onTriggerKinematicBreak,
  bayesianHeatmapActive,
  setBayesianHeatmapActive,
  metrics,
  setMetrics,
  deviationAlert,
  onDismissAlert,
}) => {
  const [expandedWhyNotId, setExpandedWhyNotId] = useState<string | null>(null);
  const [showMetricsSliders, setShowMetricsSliders] = useState(false);
  const [selectedTrackForInspection, setSelectedTrackForInspection] = useState<string>('en-1');

  if (!isOpen) return null;

  const altitudeProfiles = evaluateAltitudeProfiles('SMALL_SKIFF', true);
  const selectedTrack = CLASSIFIED_TRACKS_DATABASE.find(t => t.entityId === selectedTrackForInspection) || CLASSIFIED_TRACKS_DATABASE[0];

  const modulesList: { id: SigmaModuleType; title: string; subtitle: string; icon: any; badge?: string }[] = [
    {
      id: 'SENSORS_WEATHER',
      title: 'Senseurs & Météo',
      subtitle: 'Mise en condition post-décollage',
      icon: Wind,
      badge: 'Inversion 1200ft',
    },
    {
      id: 'SURMAR_ROUTING',
      title: 'Mission SURMAR (MISR)',
      subtitle: 'Routage Multi-Critères & RADAR-X',
      icon: Navigation,
      badge: `${options.length} Routes`,
    },
    {
      id: 'TRACK_CLASSIFICATION',
      title: 'Classification Pistes',
      subtitle: 'Analyse SER, AIS & Pattern of Life',
      icon: Eye,
      badge: '1 Suspect',
    },
    {
      id: 'BAYESIAN_INTERCEPT',
      title: 'Interception Bayésienne',
      subtitle: 'Datum Go-Fast & Coup de Faux',
      icon: Target,
      badge: '92% Pd',
    },
    {
      id: 'MTO_PROCEDURE',
      title: 'Procédure MTO',
      subtitle: 'Frappe téléopérée & SOD 6 NM',
      icon: Shield,
      badge: 'SOD OK',
    },
  ];

  return (
    <div className="absolute right-4 top-16 bottom-16 z-40 w-[420px] max-w-[95vw] pointer-events-auto flex flex-col bg-slate-950/95 border-2 border-slate-700 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-slate-100 animate-in slide-in-from-right duration-200">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">SIGMA : ASSISTANT TACTIQUE</h2>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-mono font-bold">
                EASA L2/L3A
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Système de Mission Modulaire — H160M Guépard</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          title="Fermer le menu SIGMA"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── MODULE SELECTOR TABS ─────────────────────────────────────────── */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/50 overflow-x-auto p-1 gap-1">
        {modulesList.map(mod => {
          const Icon = mod.icon;
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => {
                setActiveModule(mod.id);
                if (mod.id === 'BAYESIAN_INTERCEPT') {
                  setBayesianHeatmapActive(true);
                }
              }}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-center flex flex-col items-center gap-1 transition-all ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-slate-950' : 'text-slate-400'} />
              <span className="text-[10px] font-medium leading-tight whitespace-nowrap">
                {mod.title.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── ACTIVE MODULE CONTENT ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 1 : SENSEURS & MÉTÉO (MISE EN CONDITION POST-DÉCOLLAGE)
            ═══════════════════════════════════════════════════════════════════ */}
        {activeModule === 'SENSORS_WEATHER' && (
          <div className="space-y-3.5">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-xs uppercase flex items-center gap-2">
                <Wind size={15} className="text-cyan-400" />
                Mise en Condition Senseurs & Profils d'Altitude
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Caractérisation de la propagation radar/FLIR sous l'inversion thermique.
              </p>
            </div>

            {/* Weather parameters */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Couche Inversion</span>
                <strong className="text-cyan-300 font-mono">1200 FT (Conduit Troposphérique)</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Vent Surface</span>
                <strong className="text-emerald-400 font-mono">{environment.windDirectionDeg}° / {environment.windSpeedKts} kts</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">État Mer</span>
                <strong className="text-slate-300 font-mono">Mer 3 (Clutter modéré)</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Gain Basse Altitude</span>
                <strong className="text-amber-400 font-mono">+15 NM (Radar horizon)</strong>
              </div>
            </div>

            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Profils de Patrouille Évalués :
            </span>

            <div className="space-y-2">
              {altitudeProfiles.map(alt => (
                <div
                  key={alt.altitudeFt}
                  onClick={() => onUpdateAltitude(alt.altitudeFt)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    alt.isOptimal
                      ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-xs text-white">ALTITUDE {alt.altitudeFt} FT</span>
                    {alt.isOptimal ? (
                      <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-bold rounded text-[9px] font-mono">
                        RECOMMANDATION IA
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">{alt.recommendedFor}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono bg-slate-950/80 p-1.5 rounded border border-slate-800 mb-1.5">
                    <div><span className="text-slate-500 block text-[8px]">PORTÉE RADAR</span>{alt.radarRangeNm} NM</div>
                    <div><span className="text-slate-500 block text-[8px]">PORTÉE FLIR</span>{alt.opticalFlirRangeNm} NM</div>
                    <div><span className="text-slate-500 block text-[8px]">P(DÉT) PETITE CIBLE</span><strong className="text-emerald-400">{alt.smallTargetPd}%</strong></div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight">
                    {alt.rationale}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                onUpdateAltitude(2000);
                setActiveModule('SURMAR_ROUTING');
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 uppercase"
            >
              <Check size={15} />
              Adopter 2000 FT & Basculer vers Module Mission MISR
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 2 : MISSION SURMAR (MISR) & ROUTAGE MULTI-CRITÈRES
            ═══════════════════════════════════════════════════════════════════ */}
        {activeModule === 'SURMAR_ROUTING' && (
          <div className="space-y-3.5">
            <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-xs uppercase flex items-center gap-2">
                  <Navigation size={15} className="text-emerald-400" />
                  Mission SURMAR / MISR (Airplan Alpha)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arbitrage de trajectoires sous contraintes opérationnelles & vent.
                </p>
              </div>

              <button
                onClick={() => setShowMetricsSliders(!showMetricsSliders)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded text-[10px] text-slate-300 font-mono flex items-center gap-1"
              >
                <Gauge size={12} className="text-indigo-400" />
                Pondération MAVEN
              </button>
            </div>

            {/* MAVEN Sliders Drawer */}
            {showMetricsSliders && (
              <div className="p-3 bg-slate-900 border border-indigo-500/40 rounded-lg space-y-2 text-[10px]">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Priorité Vitesse / Menace :</span>
                  <span className="font-mono text-emerald-400 font-bold">{metrics.timeToTarget}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={metrics.timeToTarget}
                  onChange={e => setMetrics(m => ({ ...m, timeToTarget: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-500 h-1"
                />

                <div className="flex justify-between items-center text-slate-300">
                  <span>Économie Carburant (Vent arrière) :</span>
                  <span className="font-mono text-emerald-400 font-bold">{metrics.fuelEconomy}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={metrics.fuelEconomy}
                  onChange={e => setMetrics(m => ({ ...m, fuelEconomy: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-500 h-1"
                />

                <div className="flex justify-between items-center text-slate-300">
                  <span>Couverture Optronique / FLIR :</span>
                  <span className="font-mono text-emerald-400 font-bold">{metrics.sensorCoverage}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={metrics.sensorCoverage}
                  onChange={e => setMetrics(m => ({ ...m, sensorCoverage: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-500 h-1"
                />
              </div>
            )}

            {/* 2 Primary Route Candidates */}
            <div className="space-y-2.5">
              {options.slice(0, 2).map((opt, idx) => {
                const isSelected = (selectedOptionId === opt.id) || (!selectedOptionId && idx === 0);
                return (
                  <div
                    key={opt.id}
                    onClick={() => onSelectOption(opt)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 shadow-xl'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-75'
                    }`}
                    style={{ borderColor: isSelected ? opt.color : undefined }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                        <h4 className="font-bold text-xs text-white uppercase">{opt.title}</h4>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{ backgroundColor: `${opt.color}25`, color: opt.color }}
                      >
                        Score {opt.score}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800/80 mb-2">
                      <div><span className="text-slate-500 block text-[8px]">DIST</span>{opt.totalDistanceNm}NM</div>
                      <div><span className="text-slate-500 block text-[8px]">ETE</span>{opt.totalEteMin}m</div>
                      <div><span className="text-slate-500 block text-[8px]">BPH</span><strong className="text-emerald-400">{opt.fuelRemainingAtFrigateKg}kg</strong></div>
                      <div><span className="text-slate-500 block text-[8px]">P(DÉT)</span><strong className="text-cyan-400">{opt.detectionProbability}%</strong></div>
                    </div>

                    <p className="text-[10px] text-slate-300 leading-tight mb-2">
                      {opt.tacticalRationale}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-[9px] text-amber-400/90 font-mono truncate max-w-[210px]">
                        ⚠ {opt.limitingFactor}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcceptTrajectory(opt);
                        }}
                        className="px-3 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 text-white shadow-md active:scale-95 transition-transform"
                        style={{ backgroundColor: opt.color }}
                      >
                        <Play size={11} fill="white" />
                        ENGAGER
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RADAR-X Explainability (Why / Why not) */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Explicabilité & Compromis (RADAR-X) :
              </span>

              <div className="space-y-1.5">
                {CONTRASTIVE_KNOWLEDGE_BASE.slice(0, 2).map(qa => (
                  <div key={qa.id} className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedWhyNotId(expandedWhyNotId === qa.id ? null : qa.id)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between text-[11px] text-slate-200 hover:bg-slate-800/50"
                    >
                      <span className="flex items-center gap-2">
                        <HelpCircle size={13} className="text-indigo-400 shrink-0" />
                        {qa.question}
                      </span>
                      <ChevronRight size={13} className={`transform transition-transform ${expandedWhyNotId === qa.id ? 'rotate-90' : ''}`} />
                    </button>

                    {expandedWhyNotId === qa.id && (
                      <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] space-y-2">
                        <p className="text-slate-300">{qa.aiRationale}</p>
                        <div className="grid grid-cols-3 gap-1 text-center font-mono">
                          {qa.tradeOffs.map((t, tidx) => (
                            <div key={tidx} className={`p-1 rounded ${t.positive ? 'bg-emerald-950/40 text-emerald-300' : 'bg-rose-950/40 text-rose-300'}`}>
                              <span className="block text-[8px] text-slate-400 truncate">{t.label}</span>
                              <strong>{t.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 3 : CLASSIFICATION AUTOMATIQUE DES PISTES (POL / RMP)
            ═══════════════════════════════════════════════════════════════════ */}
        {activeModule === 'TRACK_CLASSIFICATION' && (
          <div className="space-y-3.5">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-xs uppercase flex items-center gap-2">
                <Eye size={15} className="text-amber-400" />
                Classification Automatique des Pistes & Anomalies
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Corrélation Radar / AIS & détection d'écarts au Pattern of Life maritime.
              </p>
            </div>

            {/* Tracks List */}
            <div className="space-y-2">
              {CLASSIFIED_TRACKS_DATABASE.map(track => {
                const isSelected = selectedTrackForInspection === track.entityId;
                const isHostileOrSuspect = track.classification.includes('SUSPECT') || track.classification === 'HOSTILE';
                return (
                  <div
                    key={track.entityId}
                    onClick={() => setSelectedTrackForInspection(track.entityId)}
                    className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? isHostileOrSuspect ? 'bg-red-950/40 border-red-500' : 'bg-slate-900 border-cyan-500'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-xs ${isHostileOrSuspect ? 'text-red-400' : 'text-slate-200'}`}>
                          {track.label}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                          isHostileOrSuspect ? 'bg-red-900 text-red-200' : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {track.classification.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Score {track.confidenceScore}/5</span>
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-0.5">
                      <div>SER Radar : <strong className="text-slate-200 font-mono">{track.radarSERM2} m²</strong> {track.aisBroadcastLengthM ? `| AIS: ${track.aisBroadcastLengthM}m` : '| Non-AIS'}</div>
                      <div className="text-slate-300 mt-1 leading-tight">{track.rationale}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inspection details & action */}
            {selectedTrack && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase block">
                  Action Recommandée SIGMA :
                </span>
                <p className="text-[11px] text-amber-300 leading-tight">
                  {selectedTrack.recommendedAction}
                </p>
                <button
                  onClick={() => {
                    setActiveModule('SURMAR_ROUTING');
                    const best = options[0];
                    if (best) onSelectOption(best);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Navigation size={13} />
                  Générer Trajectoire d'Interception & Levée de Doute
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 4 : RECHERCHE BAYÉSIENNE GO-FAST & DATUM
            ═══════════════════════════════════════════════════════════════════ */}
        {activeModule === 'BAYESIAN_INTERCEPT' && (
          <div className="space-y-3.5">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-xs uppercase flex items-center gap-2">
                <Target size={15} className="text-amber-400" />
                Recherche Bayésienne sur Datum (Go-Fast)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Modélisation de l'ellipse de probabilité P(présence) × P(dét) & Coup de Faux.
              </p>
            </div>

            {/* Datum parameters card */}
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-300 uppercase">Paramètres du Datum</span>
                <button
                  onClick={() => setBayesianHeatmapActive(!bayesianHeatmapActive)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                    bayesianHeatmapActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {bayesianHeatmapActive ? 'ELLIPSE ACTIVE' : 'MASQUÉE'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1 text-center font-mono bg-slate-950/80 p-2 rounded border border-amber-500/20">
                <div><span className="text-slate-500 block text-[8px]">CAP ESTIMÉ</span>320°</div>
                <div><span className="text-slate-500 block text-[8px]">VITESSE</span>32 kts</div>
                <div><span className="text-slate-500 block text-[8px]">TEMPS ÉCOULÉ</span>15 min</div>
              </div>

              <p className="text-[10px] text-slate-300 leading-tight">
                L'ellipse de probabilité est calculée et projetée sur la carte avec ses 3 zones iso-probabilité (80% / 50% / 20%).
              </p>
            </div>

            {/* Coup de Faux Trajectory */}
            {options.filter(o => o.preset === 'BAYESIAN_GOFAST').map(opt => (
              <div key={opt.id} className="p-3 rounded-lg border-2 border-amber-500 bg-slate-900 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400 text-xs uppercase">Manœuvre en Coup de Faux Transversal (90°)</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono text-[10px] font-bold">P(Dét) 92%</span>
                </div>

                <p className="text-[10px] text-slate-300 leading-tight">
                  Trajectoire coupant orthogonalement l'axe de fuite du suspect pour maximiser la signature optronique/radar et l'exposition du sillage.
                </p>

                <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800">
                  <div><span className="text-slate-500 block text-[8px]">DISTANCE</span>{opt.totalDistanceNm} NM</div>
                  <div><span className="text-slate-500 block text-[8px]">ETE TRANSIT</span>{opt.totalEteMin} min</div>
                  <div><span className="text-slate-500 block text-[8px]">RETOUR BPH</span><strong className="text-emerald-400">{opt.fuelRemainingAtFrigateKg} kg</strong></div>
                </div>

                <button
                  onClick={() => onAcceptTrajectory(opt)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-lg transition-all flex items-center justify-center gap-2 uppercase active:scale-95"
                >
                  <Play size={14} fill="currentColor" />
                  Engager Trajectoire Coup de Faux
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 5 : PROCÉDURE DE FRAPPE MTO (MUNITION TÉLÉOPÉRÉE)
            ═══════════════════════════════════════════════════════════════════ */}
        {activeModule === 'MTO_PROCEDURE' && (
          <div className="space-y-3.5">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-xs uppercase flex items-center gap-2">
                <Shield size={15} className="text-rose-400" />
                Procédure de Neutralisation MTO (Strike)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Approche sécurisée avec barrière Stand-off Distance (SOD $\ge$ 6 NM) & relais B-LOS.
              </p>
            </div>

            {/* Safety Invariant Card */}
            <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-lg space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-rose-300 font-bold">
                <span>BARRIÈRE RTA SOD :</span>
                <span className="font-mono">≥ 6.0 NM (RESPECTÉE)</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                L'hélicoptère ne pénètre jamais le cercle de menace de 6 NM entourant la cible. Le largage et l'orbite de guidage sont effectués hors de portée des défenses adverses.
              </p>
            </div>

            {/* MTO Strike Trajectory */}
            {options.filter(o => o.preset === 'MTO_STRIKE').map(opt => (
              <div key={opt.id} className="p-3 rounded-lg border-2 border-rose-500 bg-slate-900 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-rose-400 text-xs uppercase">Hippodrome de Guidage Téléopéré</span>
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded font-mono text-[10px] font-bold">SOD 6.2 NM</span>
                </div>

                <p className="text-[10px] text-slate-300 leading-tight">
                  Point de largage à 6.5 NM de la cible, suivi d'un hippodrome d'attente pour assurer la liaison de données vidéo jusqu'à l'impact.
                </p>

                <button
                  onClick={() => onAcceptTrajectory(opt)}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-lg transition-all flex items-center justify-center gap-2 uppercase active:scale-95"
                >
                  <Play size={14} fill="currentColor" />
                  Engager Séquence MTO
                </button>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── FOOTER STATUS (Runtime Assurance) ─────────────────────────────── */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          RTA: BINGO {environment.fuelCurrentKg}KG | SOD OK
        </span>
        <button
          onClick={onTriggerKinematicBreak}
          className="text-amber-400 hover:underline flex items-center gap-1"
          title="Simuler rupture cinématique cible"
        >
          <AlertTriangle size={11} />
          Simuler Rupture Cible
        </button>
      </div>
    </div>
  );
};
