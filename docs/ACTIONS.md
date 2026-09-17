# Acciones — el sistema modular

Una "acción" es lo que un escaneo **puede** significar. El manager elige cuáles
están activas; la lógica vive en un único sitio:
[`src/lib/acciones.js`](../src/lib/acciones.js).

**Para añadir una funcionalidad nueva a toda la plataforma, añades una entrada a
ese objeto. Nada más.** El manager la verá como casilla, el trabajador como botón,
y `/api/accion` la ejecutará y empujará el pase.

## El contrato

```js
clave: {
  label: "Texto del botón",
  icon: "🙂",                    // emoji para la UI
  descripcion: "Qué hace, en una línea.",
  aplicar(cliente, negocio) {
    // cliente = { serial, negocio, sellos, premios, nombre }
    // negocio = { slug, nombre, tipo: "sellos"|"descuento", meta, premio, promo, acciones, tema }
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
4. si `ok !== false`: guarda el cliente (marca `actualizado`), registra el evento y
   llama a `notificarCliente()` → aviso APNs → el iPhone baja el pase nuevo.

Qué se ve en el pase lo decide [`apple/pase.js`](../src/lib/apple/pase.js) a partir del
estado: si tu acción cambia algo nuevo (p.ej. un campo `nivel`), añade ahí el campo
con su `changeMessage` para que el cliente reciba la notificación.

Como `acciones.js` no importa nada del servidor, la **UI también lo importa**
(`LISTA_ACCIONES`) para pintar casillas/botones. Una sola fuente de verdad.

## Ejemplo: añadir "puntos dobles"

```js
// en ACCIONES de src/lib/acciones.js
doble: {
  label: "Sello x2",
  icon: "✨",
  descripcion: "Suma dos sellos (día de puntos dobles).",
  aplicar(c, p) {
    const sellos = Math.min(c.sellos + 2, p.meta);
    return {
      cliente: { ...c, sellos },
      mensaje: `+2 sellos · ${sellos}/${p.meta}`,
      evento: `Puntos dobles → ${sellos}/${p.meta}`,
    };
  },
},
```

Guardas, y en el manager aparece la casilla "Sello x2". La activas → el trabajador
ya tiene el botón. Cero cambios en rutas, UI o base de datos.

## Acciones incluidas

| Clave | Botón | Qué hace |
|-------|-------|----------|
| `sellar` | ➕ Añadir sello | +1 sello (hasta la meta) |
| `restar` | ➖ Quitar sello | −1 sello (corrección) |
| `canjear` | 🎁 Canjear | sellos: exige cartilla llena, entrega premio y reinicia · descuento: usa el cupón una vez (el pase queda anulado) |
| `confirmar` | ✅ Confirmar visita | registra una visita sin tocar la cartilla |

## Ideas de acciones modulares futuras

- `pagar` — confirmar un pago/consumición (registra transacción; **no** mueve
  dinero: eso es Apple Pay).
- `cupon` — activar/desactivar un cupón concreto en el pase.
- `nivel` — subir de tier (bronce/plata/oro) según visitas.

Todas caben en el mismo contrato: cambian `cliente`, devuelven `mensaje`/`evento`,
y el pase se actualiza solo.
