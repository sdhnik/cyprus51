// Cyprus 5+1 service worker: the app opens without signal (e.g. at the finish line).
// The deploy step (scripts/build-sw.mjs) fills in VERSION and the file list below.
const VERSION = 'dev';
const PRECACHE = [];

const CORE = `c51-core-${VERSION}`;
const RUNTIME = `c51-runtime-${VERSION}`;
const SHELL = new URL('app/index.html', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    // Fresh copies, not the browser's HTTP cache
    await cache.addAll(PRECACHE.map((u) => new Request(new URL(u, self.location), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('c51-') && key !== CORE && key !== RUNTIME) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only our own files; Supabase, map tiles and other sites go straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
        return res;
      } catch {
        return (await caches.match(req, { ignoreSearch: true }))
          || (url.pathname.includes('/app/') ? caches.match(SHELL) : undefined)
          || Response.error();
      }
    })());
    return;
  }

  // Race data changes during the season: show the saved copy, refresh it in the background.
  const fresh = url.pathname.endsWith('/data/races.json');
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit && !fresh) return hit;
    const net = fetch(req).then(async (res) => {
      if (res.ok && res.type === 'basic') (await caches.open(fresh ? CORE : RUNTIME)).put(req, res.clone());
      return res;
    });
    if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
