// Service worker de PesoXPeso: deja abrir la app sin conexión y recibe los recordatorios.
const CACHE = 'pxp-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Los datos nunca se guardan en caché: siempre van a la API.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/v1')) return;

  if (request.mode === 'navigate') {
    // Red primero; sin conexión se sirve la app guardada.
    e.respondWith(
      fetch(request)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put('/', copia));
          return r;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  // Los archivos de /assets llevan hash en el nombre: son inmutables.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then(
        (guardado) =>
          guardado ||
          fetch(request).then((r) => {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(request, copia));
            return r;
          }),
      ),
    );
  }
});

self.addEventListener('push', (e) => {
  let datos = {};
  try {
    datos = e.data ? e.data.json() : {};
  } catch {
    datos = {};
  }
  e.waitUntil(
    self.registration.showNotification(datos.titulo || 'PesoXPeso', {
      body: datos.cuerpo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'recordatorio',
      data: { url: datos.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => 'focus' in v);
      if (abierta) return abierta.navigate(destino).then((v) => (v || abierta).focus());
      return self.clients.openWindow(destino);
    }),
  );
});
