import {
  getCliente, guardarPromos, marcarBorrado, addEvento, listEventos, listCampanas,
  canalesDeTarjeta, registrarBorrado,
} from "./store";
import { notificarCliente } from "./wallet";
import { cartillasDe, totalGuardados } from "./cartillas";

// ============================================================================
// LOS DERECHOS DEL CLIENTE (docs/RGPD.md, sección 3)
// ----------------------------------------------------------------------------
// Lo mismo lo pide la tienda desde la ficha del cliente que el propio cliente
// desde "Tu tarjeta y tus datos" (/p/<serial>/datos): un sitio para cada cosa,
// dos puertas. `actor` dice quién fue, como en el resto del historial.
// ============================================================================

/**
 * Promos sí o no (soft opt-in, LSSI 21.2). Deja su evento en el historial (quién
 * y cuándo: es el registro del consentimiento) y pone el pase al día en silencio.
 * @param {"cliente"|"manager"|"admin"} actor
 * @returns {Promise<object|null>} el cliente ya cambiado, o null si no existe
 */
export async function cambiarPromos(cliente, negocio, quiere, actor) {
  if (Boolean(quiere) === !cliente.promos_no) return cliente;
  if (!(await guardarPromos(cliente.serial, quiere))) return null;
  await addEvento(
    cliente.serial,
    quiere ? "promos_si" : "promos_no",
    quiere ? "Vuelve a recibir promos" : "Ya no quiere promos",
    { negocio: cliente.negocio, actor },
  );
  const nuevo = await getCliente(cliente.serial);
  // Sin `antes`: no suena en ningún teléfono, solo desaparece (o vuelve) la promo.
  await notificarCliente(nuevo, negocio);
  return nuevo;
}

/**
 * Borra la tarjeta (primer tiempo, ver marcarBorrado): vacía y anulada al
 * momento, y su pase de Apple y de Google pasan a caducados. La fila cae en la
 * pasada diaria (lib/limpieza.js). Queda constancia, sin datos personales.
 * @param {{motivo:"manager"|"cliente"|"admin"|"plazo", rol?:string}} quien
 * @returns {Promise<boolean>} true si se borró ahora
 */
export async function borrarCliente(cliente, negocio, { motivo, rol = motivo }) {
  if (!(await marcarBorrado(cliente.serial))) return false;
  await registrarBorrado({ negocio: cliente.negocio, tipo: "cliente", motivo, rol, cuantos: 1 });
  const borrado = await getCliente(cliente.serial);
  if (borrado && negocio) await notificarCliente(borrado, negocio);
  return true;
}

const CAMPANAS_MIRADAS = 1000;

/**
 * Todo lo que guardamos de un cliente, para dárselo (arts. 15 y 20): su tarjeta,
 * su historial entero, los avisos que recibió y por qué canales la tiene. Nunca
 * tokens: ni el del pase ni los de los teléfonos.
 */
export async function datosDeCliente(cliente, negocio) {
  const [eventos, campanas, canales] = await Promise.all([
    listEventos(cliente.serial, 10000),
    listCampanas(cliente.negocio, { limite: CAMPANAS_MIRADAS }),
    canalesDeTarjeta(cliente.serial),
  ]);
  const esCupon = negocio?.tipo === "descuento";
  return {
    generado: new Date().toISOString(),
    tienda: negocio ? { nombre: negocio.nombre, identificador: negocio.slug } : { identificador: cliente.negocio },
    tarjeta: {
      codigo: cliente.codigo,
      identificador: cliente.serial,
      nombre: cliente.nombre,
      notaDeLaTienda: cliente.nota,
      saldo: esCupon
        ? { cupon: (cliente.premios || 0) > 0 ? "usado" : "sin usar" }
        : {
            cartillas: negocio ? cartillasDe(cliente, negocio).map((c) => ({ cartilla: c.nombre, sellos: c.sellos, de: c.meta, guardados: c.guardados })) : [],
            premiosGuardados: totalGuardados(cliente),
            premiosCanjeados: cliente.premios || 0,
          },
      alta: cliente.creado,
      llegoPor: cliente.origen,
      visitas: cliente.visitas,
      ultimaVisita: cliente.ultima_visita,
      enElTelefonoDesde: cliente.instalado,
      quitadaDelTelefono: cliente.desinstalado,
      mensajeEnLaTarjeta: cliente.mensaje,
      recibePromos: !cliente.promos_no,
      sinPromosDesde: cliente.promos_no,
      avisoDePrivacidadAlDarseDeAlta: cliente.aviso_version,
    },
    canales,
    historial: eventos.map((e) => ({ cuando: e.ts, que: e.tipo, detalle: e.mensaje, quien: e.actor ?? null })),
    avisosRecibidos: campanas
      .filter((c) => (c.seriales || []).includes(cliente.serial))
      .map((c) => ({ cuando: c.creado, texto: c.texto, automatico: String(c.grupo).startsWith("auto:") })),
  };
}

/** Nombre del fichero de la descarga: sin el nombre de la persona, solo el código. */
export const ficheroDeDatos = (cliente) => `datos-tarjeta-${cliente.codigo || "cliente"}.json`;
