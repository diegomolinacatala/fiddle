# Arquitectura

## El modelo mental (léelo primero)

**El pase es una tarjeta de identidad tonta. Toda la inteligencia vive en el
scanner del trabajador + el backend.** Ese desacoplamiento es lo que hace todo
modular.

El QR del pase no "lleva" un cupón, ni un punto, ni un pago. Lleva **una sola
cosa: un identificador que dice "este soy yo"**. Lo demás —qué significa un
escaneo hoy, qué muestra el pase— lo decide el servidor.

- **Dirección del escaneo** (pase → scanner): solo un ID.
- **Dirección de la actualización** (backend → pase): un push, *después* del
  escaneo. Ahí es cuando "se rellena el café" o "se marca la casilla".

## Los tres componentes

| Componente | Rol | En este repo |
|-----------|-----|--------------|
| **Pase (pkpass)** | Identidad del cliente. Su cara (sellos, premio, promo) es un *espejo* del estado del backend. Nunca piensa. | Lo firma WalletWallet. Vista de demo: [`/p/[serial]`](../src/app/p/[serial]) |
| **Scanner (trabajador)** | El "terminal" de la tienda. Lee el QR → obtiene el ID → pide al backend el perfil → muestra acciones → el trabajador confirma. | [`/w/[serial]`](../src/app/w/[serial]) + [`/api/accion`](../src/app/api/accion) |
| **Backend (cerebro)** | Guarda el estado, decide qué hace un escaneo (config del manager) y empuja el cambio al pase. | [`src/lib`](../src/lib) + `/api/*` |

## Los dos bucles

### 1. Emitir (el tap NFC)
El tag NFC de la tienda solo guarda una URL (`/api/tap`). El móvil la abre →
el servidor crea un pase al vuelo → "Añadir a Wallet". Instantáneo, sin app, sin
registro. **El tag ES el emisor** (por eso no hace falta una UI de "crear pase").

> Nota: esto es NFC-como-enlace-rápido, no el NFC de Apple donde el pase toca un
> lector (eso requiere aprobación de Apple / VAS). Para "tap → aparece el pase",
> una pegatina NFC barata basta.

```
tag NFC / QR mostrador → GET /api/tap → emitirPase() → 302 a la shareUrl → Wallet
```

### 2. Escanear y actualizar
```
QR del pase (= /w/<serial>)
   → el trabajador lo escanea con la cámara
   → abre el perfil del cliente (/w/<serial>)
   → pulsa una acción → POST /api/accion { serial, accion }
   → el backend aplica la lógica (lib/acciones.js), guarda el estado, registra evento
   → updatePass() empuja el nuevo estado al Wallet (en real, push a la pantalla de bloqueo)
```

El QR **nunca cambia de significado por sí solo**. Tú cambias qué hace un escaneo
desde el manager. El mismo QR: hoy suma un sello, mañana canjea, pasado confirma
un pago. El pase y el QR siguen idénticos.

## Modo demo vs real

Cada dependencia se detecta por separado y hace *fallback* a demo:

- **Almacenamiento** — `hasSupabase()` en [`store.js`](../src/lib/store.js): con
  credenciales usa Supabase; sin ellas, ficheros JSON en `.data/`.
- **Firma + push** — `isDemoWallet()` en
  [`walletwallet.js`](../src/lib/walletwallet.js): con API key llama a WalletWallet;
  sin ella, simula (serial UUID local, `shareUrl` → `/p/<serial>`, push = no-op).

El resto del código (rutas, UI, lógica de acciones) es idéntico en ambos modos.

## <a name="seguridad"></a>Seguridad (para producción, fuera del scope de la demo)

- **`/w/<serial>` es público** ahora mismo: cualquiera que escanee el QR ve el
  perfil y puede actuar. En producción hay que poner **login del trabajador**
  delante (session/cookie) y/o firmar el enlace del QR.
- **Anti-fraude del QR**: el QR es visible; alguien podría enseñar una captura.
  Mitigación: rotar el `barcodeValue` por push, o validar contra backend con un
  token de un solo uso.
- **Service key de Supabase**: solo en el backend, nunca en el cliente
  (por eso el store se instancia en route handlers).
