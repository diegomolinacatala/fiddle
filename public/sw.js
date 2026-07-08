// Service worker mínimo: habilita "Añadir a pantalla de inicio" (instalable) y
// da un fallback offline básico. Estrategia network-first para NO servir HTML
// caducado (evita el clásico "no veo mis cambios"). El estado real siempre va
// contra el backend, así que no cacheamos respuestas de /api.
const CACHE = "sellos-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request))
  );
});
