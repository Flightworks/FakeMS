import { useEffect, useState } from 'react';

interface UpdateAvailableBannerProps {
  /** Optional injection point for tests or an embedding shell. */
  registration?: ServiceWorkerRegistration | null;
  onReload?: () => void;
}

const reloadPage = () => window.location.reload();

export const UpdateAvailableBanner = ({
  registration: suppliedRegistration,
  onReload = reloadPage,
}: UpdateAvailableBannerProps) => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(
    suppliedRegistration ?? null,
  );
  const [visible, setVisible] = useState(Boolean(suppliedRegistration?.waiting));
  const [applying, setApplying] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  useEffect(() => {
    if (suppliedRegistration !== undefined) {
      setRegistration(suppliedRegistration);
      setVisible(Boolean(suppliedRegistration?.waiting));
      setApplying(false);
      setFailureMessage(null);
      return;
    }

    if (!('serviceWorker' in navigator)) return;

    let disposed = false;
    let activeRegistration: ServiceWorkerRegistration | null = null;
    let observedWorker: ServiceWorker | null = null;

    const handleWorkerStateChange = (event: Event) => {
      const worker = event.currentTarget as ServiceWorker;
      if (disposed) return;
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        setVisible(true);
        setApplying(false);
        setFailureMessage(null);
      } else if (worker.state === 'redundant') {
        setVisible(true);
        setApplying(false);
        setFailureMessage('UPDATE FAILED · previous version retained');
      }
    };

    const observeWorker = (worker: ServiceWorker | null) => {
      if (!worker || observedWorker === worker) return;
      observedWorker = worker;
      worker.addEventListener('statechange', handleWorkerStateChange);
    };

    const handleUpdateFound = () => {
      observeWorker(activeRegistration?.installing ?? null);
    };

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((nextRegistration) => {
      if (disposed) return;
      activeRegistration = nextRegistration;
      setRegistration(nextRegistration);
      setVisible(Boolean(nextRegistration.waiting));
      observeWorker(nextRegistration.installing);
      observeWorker(nextRegistration.waiting);
      nextRegistration.addEventListener('updatefound', handleUpdateFound);
    }).catch(() => {
      // A PWA is an enhancement; a registration failure must not affect the app.
    });

    return () => {
      disposed = true;
      activeRegistration?.removeEventListener('updatefound', handleUpdateFound);
      observedWorker?.removeEventListener('statechange', handleWorkerStateChange);
    };
  }, [suppliedRegistration]);

  if (!registration && !visible) return null;

  const applyUpdate = () => {
    const waiting = registration?.waiting;
    if (!waiting) {
      setApplying(false);
      setVisible(true);
      setFailureMessage('UPDATE FAILED · no waiting worker; reload was not performed');
      return;
    }

    setApplying(true);
    setFailureMessage(null);
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      setApplying(false);
      setVisible(true);
      setFailureMessage('UPDATE FAILED · previous version retained; reload was not performed');
      return;
    }
    try {
      onReload();
    } catch {
      setApplying(false);
      setVisible(true);
      setFailureMessage('UPDATE FAILED · reload was not performed');
    }
  };

  return (
    <>
      {registration && (
        <details className="pointer-events-auto fixed bottom-3 left-3 z-[205] max-w-[min(22rem,calc(100vw-1.5rem))] rounded border border-slate-600/80 bg-slate-950/90 font-mono text-[0.65rem] text-slate-300 shadow-xl">
          <summary
            className="min-h-10 cursor-pointer px-3 py-2 font-bold tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label="Map data and limitations"
          >
            MAP DATA &amp; LIMITATIONS
          </summary>
          <div className="border-t border-slate-700/80 px-3 py-2 leading-relaxed">
            <p>© OpenStreetMap contributors · ODbL-1.0.</p>
            <p>OSM coastline data is not survey-grade and this pack is not a certified navigation chart.</p>
          </div>
        </details>
      )}
      {visible && (
        <aside
          className="pointer-events-auto fixed left-1/2 top-4 z-[210] flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-cyan-500/70 bg-slate-950/95 px-3 py-2 font-mono text-xs text-slate-100 shadow-2xl"
          aria-live="polite"
          aria-label={failureMessage ? 'Application update failed' : applying ? 'Application update applying' : 'Application update available'}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-bold tracking-wider text-cyan-300">
              {failureMessage ? 'UPDATE FAILED' : applying ? 'UPDATE APPLYING' : 'UPDATE AVAILABLE'}
            </span>
            {failureMessage && (
              <span role="status" className="text-amber-200">{failureMessage}</span>
            )}
          </div>
          <button
            type="button"
            aria-label="Apply update and reload"
            onClick={applyUpdate}
            disabled={applying}
            className="min-h-10 rounded border border-cyan-400 px-3 py-2 font-bold text-cyan-200 hover:bg-cyan-900/60 disabled:cursor-wait disabled:opacity-70"
          >
            {applying ? 'WAITING…' : 'RELOAD'}
          </button>
        </aside>
      )}
    </>
  );
};
