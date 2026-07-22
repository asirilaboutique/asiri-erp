/* ============================================================
   ASIRI ERP — Service Worker
   Cachea archivos core para funcionamiento offline
   Módulos offline críticos: M0 Home, M1 Calculadora, M2 CRM, M5 Ventas
   ============================================================ */

const CACHE_NAME = 'asiri-erp-v1';

const ARCHIVOS_CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable.svg'
];

// Instalación: cachea archivos core
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_CORE))
  );
  self.skipWaiting();
});

// Activación: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para el core, network-first para todo lo demás
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nunca interceptar llamadas al webhook de Apps Script (siempre red real)
  if (request.url.includes('script.google.com')) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // guarda copia en cache para próxima carga offline
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
