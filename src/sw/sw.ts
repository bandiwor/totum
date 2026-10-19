/// <reference lib="webworker" />
// Service worker: offline app shell + explicit, user-confirmed updates.
// Injected at build time by build/sw-plugin.ts:
declare const __PRECACHE__: string[];
declare const __VERSION__: string;

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `organizer-${__VERSION__}`;
const INDEX_URL = new URL('./index.html', sw.registration.scope).href;

sw.addEventListener('install', (event) => {
  // No skipWaiting here: the new version waits until the user taps "Обновить".
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(__PRECACHE__.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('organizer-') && k !== CACHE).map((k) => caches.delete(k)));
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('message', (event) => {
  const data: unknown = event.data;
  if (typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'SKIP_WAITING') {
    void sw.skipWaiting();
  }
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;

  if (request.mode === 'navigate') {
    // App shell: always serve the cached index of the installed version.
    event.respondWith(
      caches.match(INDEX_URL).then((cached) => cached ?? fetch(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
