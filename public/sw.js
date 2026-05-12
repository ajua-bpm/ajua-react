// AJÚA PWA Service Worker
// Estrategia: Network First para HTML/JS/CSS (siempre lo último tras deploys)
//             Cache First solo para íconos/fuentes (con hash inmutable)

const CACHE = 'ajua-v7';
const PRECACHE = ['/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('firebase'))                  return;
  if (url.includes('api.anthropic.com'))         return;
  if (url.includes('/api/'))                     return; // funciones Vercel — nunca cachear

  const dest = e.request.destination;
  const isHtml = e.request.mode === 'navigate' ||
                 dest === 'document' ||
                 (e.request.headers.get('accept') || '').includes('text/html');
  const isAssetHashed = /\/assets\/.*-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|png|jpg|jpeg|svg|webp)$/.test(url);

  // HTML/navegación: NETWORK FIRST — siempre traer lo último, cache solo si offline
  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return r;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // Assets versionados (tienen hash en el nombre — inmutables): CACHE FIRST rápido
  if (isAssetHashed) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return r;
        });
      })
    );
    return;
  }

  // Resto (JS/CSS sin hash, JSON, manifest): NETWORK FIRST con fallback a cache
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && url.startsWith(self.location.origin)) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

// Permite que la página fuerce la actualización del SW
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Notificaciones push
self.addEventListener('push', e => {
  if (!e.data) return;
  const { title = 'AJÚA', body = '', url = '/' } = e.data.json();
  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png',
      data: { url }, requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
