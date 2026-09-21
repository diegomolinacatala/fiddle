// Service worker de la app. Tres trabajos:
//
// 1. Hacerla instalable (caja de cada tienda y tarjeta del cliente) con un
//    respaldo sin conexión. Red primero, para NO servir HTML caducado (el
//    clásico "no veo mis cambios"). Las /api no se cachean nunca: el estado
//    real siempre va contra el servidor.
// 2. Enseñar los avisos del navegador (Android): sello, canje, promo.
// 3. Al tocar un aviso, abrir la tarjeta (o traer al frente la que ya estaba
//    abierta) y decirle que se refresque.
const CACHE = "sellos-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  ),
);

// En local no se cachea nada: el service worker hace falta para probar los
// avisos, pero sin el "no veo mis cambios" mientras se desarrolla.
const EN_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (EN_LOCAL || request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

// Avisa a las pestañas abiertas de la tarjeta para que se pongan al día ya.
async function avisarPestanas(serial) {
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const v of ventanas) v.postMessage({ tipo: "tarjeta", serial });
}

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { cuerpo: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(d.titulo || "Tu tarjeta", {
        body: d.cuerpo || "",
        icon: d.icono,
        badge: d.insignia,
        tag: d.etiqueta,
        renotify: Boolean(d.etiqueta),
        data: { url: d.url || "/", serial: d.serial },
        vibrate: [40, 60, 40],
      }),
      avisarPestanas(d.serial),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const abierta = ventanas.find((v) => v.url === destino);
      if (abierta) {
        await abierta.focus();
        abierta.postMessage({ tipo: "tarjeta", serial: event.notification.data?.serial });
        return;
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
