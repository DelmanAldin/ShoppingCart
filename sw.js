// ShoppingCart service worker — omogućava instalaciju i otvaranje bez interneta.
// Kad mijenjaš index.html, povećaj broj verzije ispod da se telefoni osvježe.
const CACHE = 'shoppingcart-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];
// Vanjski resursi koje vrijedi čuvati offline (Firebase SDK i font)
const CDN = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Stranica: prvo mreža (da uvijek dobiješ najnoviju verziju), pa keš ako nema interneta
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isCdn = CDN.includes(url.hostname) && !url.pathname.includes('/firestore');
  if (!sameOrigin && !isCdn) return; // Firestore saobraćaj ide direktno

  // Ostalo: odmah iz keša, a u pozadini osvježi
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const cached = await c.match(req);
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
