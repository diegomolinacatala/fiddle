# Acciones — el sistema modular

Una "acción" es lo que un escaneo **puede** significar. El manager elige cuáles
están activas; la lógica vive en un único sitio:
[`src/lib/acciones.js`](../src/lib/acciones.js).

Qué PUEDE hacer la caja son las `acciones` de la tienda; cómo se le ENSEÑA,
`config.caja` ([`src/lib/caja.js`](../src/lib/caja.js)). Las dos se editan en
Tienda → "Editar vista de caja", con la caja de verdad al lado.

## El contrato

```js
clave: {
  label: "Texto del botón",
  icon: "mas",                   // nombre de un icono de app/Icono.js (nada de emojis)
  descripcion: "Qué hace, en una línea.",
  correccion: false,             // true = se pinta en segundo plano (el "−" pequeño)
  aplicar(cliente, negocio) {
    // cliente = { serial, negocio, sellos, sellos2, premios, guardados, guardados2 }
    // negocio = { slug, nombre, tipo: "sellos"|"descuento", meta, premio, cartillas, tema, ... }
    // Devuelve UNA de estas dos formas:
    return {
      cliente: { ...cliente, sellos: cliente.sellos + 1 }, // nuevo estado a guardar
      mensaje: "Feedback para el trabajador",              // toast
      evento:  "Texto para el historial",                  // opcional
    };
    // o, para rechazar sin cambiar nada:
    // return { ok: false, mensaje: "Por qué no se puede" };
  },
}
```

`aplicar` es **pura**: recibe el estado y devuelve el nuevo estado + textos. No
toca la base de datos ni el pase — de eso se encarga
[`/api/accion`](../src/app/api/accion/route.js):

1. comprueba que la sesión es de la caja (o manager) **del negocio del cliente**,
2. valida que la acción existe y está **activada** por su manager (si no → 403),
3. llama a `aplicar(cliente, negocio)`,
4. si `ok !== false`: guarda el cliente (marca `actualizado`; lo que mueva el saldo
   pasa por `SALDO` en `store.js`), registra el evento y llama a `notificarCliente()`
   → Apple, web push y Google.

Tiene que seguir siendo pura y **sin imports del servidor** por dos razones: la UI la
importa (`LISTA_ACCIONES`) y la caja la aplica en el navegador al instante, con la
petición detrás en fila (`TarjetaCaja.js`).

Qué se ve en el pase lo decide [`apple/pase.js`](../src/lib/apple/pase.js) (`camposDelPase`)
a partir del estado: si tu acción cambia algo nuevo (p.ej. un campo `nivel`), añade ahí
el campo con su `changeMessage` para que el cliente reciba la notificación.

**Dos cartillas**: `sellar`, `restar`, `canjear`, `guardar` y `usarGuardado` existen una
vez por cartilla (`sellar2`…, con `segunda: "sellar"`). Las de la segunda no se activan
aparte: van con la de la primera ([`cartillas.js`](../src/lib/cartillas.js)).

## Añadir una acción

1. Su entrada en `ACCIONES` de `acciones.js` (si es de cartilla, una por cartilla).
2. Su interruptor en el manager: una entrada en `QUE_HACE` de
   [`manager/EditorCaja.js`](../src/app/[negocio]/manager/EditorCaja.js). Lo que no
   está ahí no se puede encender.
3. Su botón en la caja: una fila en `filasDeCaja()` de `caja.js`. Nada de botones
   sueltos en la pantalla.

Rutas, `/api/accion` y la base no se tocan.

## Acciones incluidas

| Clave | Botón | Qué hace |
|-------|-------|----------|
| `sellar` | Añadir sello | +1 sello (hasta la meta). Es la fila de cada cartilla en la caja (`+2` si la tienda lo quiere) |
| `restar` | Quitar sello | −1 sello (corrección): el "−" pequeño dentro de la fila |
| `canjear` | Dárselo ahora | sellos: exige cartilla llena, entrega premio y reinicia · descuento: usa el cupón una vez (el pase queda anulado) |
| `guardar` | Guardarlo para otro día | cartilla llena → vuelve a cero y el premio queda en `guardados`. Va con `canjear` (`vaCon`), sin interruptor propio |
| `usarGuardado` | Usar un premio guardado | `guardados − 1`, `premios + 1`; los sellos no se tocan. Va con `canjear` |
| `confirmar` | Confirmar visita | registra una visita sin tocar la cartilla |

En una tienda de sellos, `canjear`, `guardar` y `usarGuardado` no son botones sueltos
en la caja: salen en el **recuadro del premio** (`premiosDe()`), que solo aparece
cuando la cartilla está llena o el cliente tiene premios guardados, y pregunta
"¿lo quiere ahora o se lo guardas?". En las tiendas de cupón, `canjear` sigue siendo
un botón.

## Ideas de acciones modulares futuras

- `pagar` — confirmar un pago/consumición (registra transacción; **no** mueve
  dinero: eso es Apple Pay).
- `cupon` — activar/desactivar un cupón concreto en el pase.
- `nivel` — subir de tier (bronce/plata/oro) según visitas.

Todas caben en el mismo contrato: cambian `cliente`, devuelven `mensaje`/`evento`,
y el pase se actualiza solo.
