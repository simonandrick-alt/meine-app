const CACHE = 'meine-app-v14';
const FILES = ['./', 'index.html', 'app.js', 'lock.js', 'rechner.js', 'pdf.js', 'baustelle.js', 'werkzeuge.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'kueche.json', 'fonts/lato-300.woff2', 'fonts/lato-400.woff2', 'fonts/lato-700.woff2', 'fonts/lato-900.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Nur eigene Dateien behandeln; erst online holen, offline aus dem Speicher
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
