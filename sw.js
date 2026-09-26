/* ============================================================
   ASIRI ERP — Service Worker
   Cachea archivos core para funcionamiento offline
   Módulos offline críticos: M0 Home, M1 Calculadora, M2 CRM, M5 Ventas
   ============================================================ */

// ⚠️ IMPORTANTE: bumpear esta versión (ej. 'asiri-erp-v2') en CADA deploy.
// Si no cambia, los navegadores con el Service Worker viejo instalado seguirán
// sirviendo el index.html cacheado y no verán las actualizaciones del ERP.
const CACHE_NAME = 'asiri-erp-v31';

const ARCHIVOS_CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './asiri-mark-dark.svg',
  './asiri-mark-light.svg'
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

  // M12 Agenda: agenda.json siempre de la red (la genera ASIRI AGENCIA cada viernes); el ERP guarda su propia copia offline
  if (request.url.includes('agenda.json')) {
    event.respondWith(fetch(request).catch(() => new Response('null', { status: 503, headers: { 'Content-Type': 'application/json' } })));
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

// M12 Agenda: botones del aviso (Posponer 1 h / Listo). Si la app está abierta se le avisa;
// si no, se abre con la acción en la URL para que la aplique al cargar.
self.addEventListener('notificationclick', (event) => {
  const n = event.notification; const id = n.data && n.data.id; n.close();
  const accion = event.action || 'abrir';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    const cliente = lista.find((c) => c.url.includes(self.registration.scope));
    if (cliente) { if (id) cliente.postMessage({ tipo: 'agenda', accion, id }); return cliente.focus(); }
    const url = id && accion !== 'abrir' ? './?agenda=' + accion + '&id=' + encodeURIComponent(id) : './';
    return self.clients.openWindow(url);
  }));
});
