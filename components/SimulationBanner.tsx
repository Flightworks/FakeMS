interface SimulationBannerProps {
  buildId: string;
}

export const SimulationBanner = ({ buildId }: SimulationBannerProps) => (
  <div
    className="pointer-events-none fixed bottom-1 left-1/2 z-[200] -translate-x-1/2 rounded border border-amber-500/60 bg-slate-950/90 px-3 py-1 text-center font-mono text-[10px] font-bold tracking-widest text-amber-300 shadow-lg"
    aria-label="Simulation only, not for operational use"
  >
    <span>SIMULATION</span>
    <span className="mx-2 text-amber-500/70">·</span>
    <span>NOT FOR OPERATIONAL USE</span>
    <span aria-hidden="true" className="hidden">BUILD {buildId}</span>
  </div>
);
