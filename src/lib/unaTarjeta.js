// ============================================================================
// UNA TARJETA POR TELÉFONO Y TIENDA
// ----------------------------------------------------------------------------
// La cookie del tap (lib/recordar.js) devuelve la MISMA tarjeta a quien vuelve
// a escanear el QR. Pero una cookie se pierde: Safari en privado, datos
// borrados, abrir el QR desde otra app... y entonces el tap emite otra tarjeta
// con los sellos a cero. Así se acababa con veinte tarjetas de la misma tienda.
//
// El iPhone sí lleva un identificador estable: al añadir un pase al Wallet se
// registra con su `deviceLibraryIdentifier`, que no cambia aunque borre el pase
// y lo vuelva a añadir. Apuntamos qué tarjeta tiene cada iPhone en cada tienda
// (`tarjetas_de_dispositivo`, que NO se borra al quitar el pase) y, si un
// iPhone añade una tarjeta NUEVA de una tienda de la que ya tenía otra, la
// vieja se FUSIONA en la nueva:
//
//   - la nueva se queda con los sellos, premios, nombre, código e historial;
//   - la vieja queda anulada (`fusionado_en`) y, si sigue en el Wallet, iOS la
//     aparta a "pases caducados": no hay dos tarjetas vivas de la misma tienda.
//
// Sobrevive la NUEVA porque es la que el cliente acaba de añadir: a la vieja
// quizá ya no hay forma de llegar (la borró). Que el serial cambie da igual:
// para el cliente es su tarjeta de siempre, con sus sellos.
//
// Solo iPhone. En Android no hay identificador del teléfono: ahí queda la cookie.
// ============================================================================

import { cartillasDe } from "./cartillas";

/**
 * Lo que queda en la tarjeta nueva al fusionar la vieja en ella. PURA.
 *
 * Los sellos se SUMAN: si las dos se usaron, las dos compras fueron de verdad.
 * Si la suma pasa de la meta, las cartillas llenas de sobra se convierten en
 * premios guardados (nunca se pierde un sello ni se regala uno).
 */
export function fusionar(viejo, nuevo, negocio) {
  const r = {};
  if (negocio.tipo === "descuento") {
    // Un cupón es de un uso: si se usó en cualquiera de las dos, está usado.
    r.premios = Math.max(viejo.premios || 0, nuevo.premios || 0);
  } else {
    r.premios = (viejo.premios || 0) + (nuevo.premios || 0);
    for (const c of cartillasDe(nuevo, negocio)) {
      const total = (viejo[c.clave] || 0) + (nuevo[c.clave] || 0);
      const deSobra = total > c.meta ? Math.floor((total - 1) / c.meta) : 0;
      r[c.clave] = total - deSobra * c.meta;
      r[c.claveGuardados] = (viejo[c.claveGuardados] || 0) + (nuevo[c.claveGuardados] || 0) + deSobra;
    }
  }
  const primera = (a, b) => (a && b ? (a < b ? a : b) : a || b || null);
  const ultima = (a, b) => (a && b ? (a > b ? a : b) : a || b || null);
  return {
    ...r,
    // El código es el que la caja ya conoce: se lo queda la tarjeta nueva.
    codigo: viejo.codigo,
    nombre: viejo.nombre ?? nuevo.nombre ?? null,
    nota: viejo.nota ?? nuevo.nota ?? null,
    visitas: (viejo.visitas || 0) + (nuevo.visitas || 0),
    ultima_visita: ultima(viejo.ultima_visita, nuevo.ultima_visita),
    instalado: primera(viejo.instalado, nuevo.instalado),
    origen: viejo.origen ?? nuevo.origen ?? null,
  };
}

/**
 * Tras registrar `serial` en el iPhone `dispositivo`: si ese iPhone ya tenía (o
 * tuvo) otra tarjeta de la misma tienda, la fusiona en esta. Nunca lanza: el
 * registro en el Wallet ya está hecho y no puede fallar por esto.
 *
 * @param {object} deps getCliente, getNegocio, tarjetaDeDispositivo,
 *   apuntarTarjetaDeDispositivo, fusionarClientes, addEvento, notificarCliente
 * @returns {Promise<{fusionada:string|null}>} el serial viejo, si hubo fusión
 */
export async function unificarTarjeta(deps, { dispositivo, negocio, serial }) {
  try {
    const anterior = await deps.tarjetaDeDispositivo({ dispositivo, negocio });
    const apuntar = () => deps.apuntarTarjetaDeDispositivo({ dispositivo, negocio, serial });
    if (!anterior || anterior === serial) {
      await apuntar();
      return { fusionada: null };
    }

    const [viejo, nuevo, n] = await Promise.all([
      deps.getCliente(anterior), deps.getCliente(serial), deps.getNegocio(negocio),
    ]);
    // Volver a añadir una tarjeta que ya se fusionó (la vieja, anulada) no
    // cambia nada: la buena sigue siendo la apuntada.
    if (!nuevo || nuevo.fusionado_en || !n) return { fusionada: null };
    if (!viejo || viejo.fusionado_en || viejo.negocio !== negocio) {
      await apuntar();
      return { fusionada: null };
    }

    const campos = fusionar(viejo, nuevo, n);
    if (!(await deps.fusionarClientes(viejo, nuevo, campos))) return { fusionada: null };
    await apuntar();
    await deps.addEvento(serial, "fusion", "Volvió a añadir su tarjeta: se recuperaron sus sellos", { negocio, actor: "apple" });

    // Los dos pases cambian: el nuevo se llena con los sellos de siempre y el
    // viejo, si sigue en algún iPhone, se anula.
    await deps.notificarCliente({ ...nuevo, ...campos }, n);
    await deps.notificarCliente({ ...viejo, fusionado_en: serial }, n);
    return { fusionada: anterior };
  } catch (e) {
    console.error(`[una tarjeta] no se pudo unificar ${serial} en ${dispositivo}:`, e);
    return { fusionada: null };
  }
}

/**
 * La tarjeta vigente a partir de una que quizá se fusionó en otra (una cookie
 * vieja, el QR de un pase anulado). Sigue la cadena unos pocos saltos.
 */
export async function clienteVigente(getCliente, serial) {
  let c = await getCliente(serial);
  for (let i = 0; c?.fusionado_en && i < 5; i++) c = await getCliente(c.fusionado_en);
  return c?.fusionado_en ? null : c;
}
