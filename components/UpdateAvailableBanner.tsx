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

  useEffect(() => {
    if (suppliedRegistration !== undefined) {
      setRegistration(suppliedRegistration);
      setVisible(Boolean(suppliedRegistration?.waiting));
      return;
    }

    if (!('serviceWorker' in navigator)) return;

    let disposed = false;
    let activeRegistration: ServiceWorkerRegistration | null = null;

    const handleUpdateFound = () => {
      const installing = activeRegistration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (!disposed && installing.state === 'installed' && navigator.serviceWorker.controller) {
          setVisible(true);
        }
      });
    };

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((nextRegistration) => {
      if (disposed) return;
      activeRegistration = nextRegistration;
      setRegistration(nextRegistration);
      setVisible(Boolean(nextRegistration.waiting));
      nextRegistration.addEventListener('updatefound', handleUpdateFound);
    }).catch(() => {
      // A PWA is an enhancement; a registration failure must not affect the app.
    });

    return () => {
      disposed = true;
      activeRegistration?.removeEventListener('updatefound', handleUpdateFound);
    };
  }, [suppliedRegistration]);

  if (!visible || !registration?.waiting) return null;

  const applyUpdate = () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    setVisible(false);
    onReload();
  };

  return (
    <aside
      className="pointer-events-auto fixed left-1/2 top-4 z-[210] flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-cyan-500/70 bg-slate-950/95 px-3 py-2 font-mono text-xs text-slate-100 shadow-2xl"
      aria-live="polite"
      aria-label="Application update available"
    >
      <span className="font-bold tracking-wider text-cyan-300">UPDATE AVAILABLE</span>
      <button
        type="button"
        aria-label="Apply update and reload"
        onClick={applyUpdate}
        className="min-h-10 rounded border border-cyan-400 px-3 py-2 font-bold text-cyan-200 hover:bg-cyan-900/60"
      >
        RELOAD
      </button>
    </aside>
  );
};
