export type ClientUpdateState = { available: boolean; offlineReady: boolean; error?: string };
let state: ClientUpdateState = { available: false, offlineReady: false };
let registration: ServiceWorkerRegistration | undefined;
let applying = false;
const listeners = new Set<() => void>();
const update = (next: ClientUpdateState) => {
  state = next;
  listeners.forEach(listener => listener());
};
export const getClientUpdateState = () => state;
export const onClientUpdate = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function hasOfflineResources(worker: ServiceWorker): Promise<boolean> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), 2_000);
    channel.port1.onmessage = event => finish(event.data?.ready === true);
    try {
      worker.postMessage({ type: 'ARENA_OFFLINE_STATUS' }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

/** Called once from startup; production only. Installation includes the offline team editor. */
export async function registerClientWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    const sync = () => {
      const active = registration?.active;
      update({ available: !!registration?.waiting, offlineReady: state.offlineReady && !!active });
      if (active)
        void hasOfflineResources(active).then(ready => {
          if (registration?.active === active) update({ ...state, offlineReady: ready });
        });
    };
    sync();
    registration.addEventListener('updatefound', () => {
      const worker = registration?.installing;
      worker?.addEventListener('statechange', () => {
        sync();
        if (worker.state === 'redundant')
          update({
            ...state,
            error: 'Offline resources could not be installed. Reconnect and check for updates.',
          });
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      sync();
      if (applying) location.reload();
    });
    void navigator.serviceWorker.ready.then(() => sync());
    void registration.update().catch(() => {});
  } catch {
    update({
      available: false,
      offlineReady: false,
      error: 'Offline storage is unavailable in this browser.',
    });
  }
}

export async function checkClientUpdate() {
  if (!registration) return registerClientWorker();
  try {
    await registration.update();
  } catch {
    update({ ...state, error: 'Could not check for updates. Check your connection.' });
  }
}

/** UI must let the user finish live battles before choosing this action. */
export function applyClientUpdate() {
  if (!registration?.waiting) return;
  applying = true;
  registration.waiting.postMessage({ type: 'ARENA_APPLY_UPDATE' });
}

/** Repairs app files only: teams, credentials and preferences are untouched. */
export async function repairClientCache() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => /^arena-(build|shell|assets)-/.test(key)).map(key => caches.delete(key)),
    );
  }
  await registration?.unregister();
  location.reload();
}
