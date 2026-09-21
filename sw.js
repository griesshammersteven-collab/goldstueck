/* Offline-Cache für die App-Hülle. Nutzerdaten liegen in localStorage, nicht hier. */
const CACHE = 'monatsklar-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

/* Große Bibliotheken (vendor/): Cache zuerst, damit sie nicht bei jedem Scan neu geladen werden.
   Eigene App-Dateien: sofort aus dem Cache zeigen (schneller Start, auch bei schlechtem Netz)
   und im Hintergrund die neueste Version holen, die beim nächsten Start gilt (stale-while-revalidate).
   Fremde Domains werden nicht angefasst. */
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.searchParams.has('nocache')) return;   /* Update-Prüfung der App: immer direkt vom Server */
  if (u.pathname.includes('/vendor/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => put(e.request, r))));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(r => put(e.request, r)).catch(() => cached || caches.match('./index.html'));
      if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
      return fresh;
    })
  );
});
