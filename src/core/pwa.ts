import { signal } from '@preact/signals';

/** A new version has been downloaded and is waiting for the user to apply it. */
export const updateReady = signal(false);
export const checkingUpdate = signal(false);
export const appVersion = __APP_VERSION__;

let registration: ServiceWorkerRegistration | null = null;
let lastCheck = 0;

function watch(reg: ServiceWorkerRegistration): void {
  if (reg.waiting && navigator.serviceWorker.controller) updateReady.value = true;
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    sw?.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) updateReady.value = true;
    });
  });
}

export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
  watch(registration);

  // Check for a new deploy whenever the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60_000) void checkForUpdate();
  });
}

/** Returns true when an update is available. */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;
  lastCheck = Date.now();
  checkingUpdate.value = true;
  try {
    await registration.update();
    // Give the new worker a moment to install.
    await new Promise((r) => setTimeout(r, 1500));
  } catch {
    // Offline: nothing to do.
  } finally {
    checkingUpdate.value = false;
  }
  return updateReady.value;
}

export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) return location.reload();
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Asks the browser not to evict our IndexedDB. */
export const storagePersisted = signal<boolean | null>(null);

export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  storagePersisted.value = (await navigator.storage.persisted()) || (await navigator.storage.persist());
}
