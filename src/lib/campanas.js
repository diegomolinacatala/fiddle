import {
  saveNegocio, getNegocio, listClientes, serialesRegistrados,
  guardarMensajes, crearCampana, addEventos,
} from "./store";
import { perfilDe } from "./crm";
import { avisarSeriales, notificarNegocio } from "./wallet";
import {
  esDestino, esPromo, infoDestino, incluyeDestino, textoDeEnvio, caducidadMomento, repartirPendientes, MOMENTO,
} from "./envios";

// ============================================================================
// MANDAR UN AVISO (servidor)
// ----------------------------------------------------------------------------
// Lo que hacen «Enviar ahora» (/api/crm/campana, /api/promo) y los envíos a una
// hora que suelta el reloj (enviarPendientes): el MISMO camino, para que lo
// programado no pueda portarse distinto de lo mandado a mano.
//
// El destino se calcula AQUÍ, en el momento de mandar: del navegador llega una
// clave ("premio_listo"), nunca a quién.
// ============================================================================

const MAX_DESTINO = 400; // tope por envío: más no cabe en el tiempo de una función serverless
const ID = () => `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Pone (o quita, con texto vacío) la promo de la tienda en todas sus tarjetas. */
export async function ponerPromo(slug, texto) {
  const promo = textoDeEnvio("todos", texto);
  const negocio = await saveNegocio(slug, { promo });
  if (!negocio) return { error: "Ese negocio no existe", status: 404 };
  // Solo una promo NUEVA hace sonar Android; retirarla limpia las tarjetas en silencio.
  const aviso = await notificarNegocio(negocio, { promoNueva: negocio.promo, promo: true });
  return { promo: negocio.promo, ...aviso };
}

/**
 * Escribe un mensaje en el pase de cada cliente del destino y les avisa.
 * Texto vacío = quitarlo (a todos los del destino, también a quien no quiere
 * promos: por si lo tenía de antes).
 * @returns {Promise<object>} lo que cuenta la pantalla, o {error, status}
 */
export async function mandarMensaje(negocio, destino, texto, { actor = "manager" } = {}) {
  if (!esDestino(destino) || esPromo(destino)) return { error: `No existe el grupo "${destino}"`, status: 400 };
  const mensaje = textoDeEnvio(destino, texto);
  const [clientes, registrados] = await Promise.all([listClientes(negocio.slug), serialesRegistrados(negocio.slug)]);
  const delGrupo = clientes.filter((c) =>
    incluyeDestino(destino, perfilDe({ ...c, instalado: c.instalado || (registrados.has(c.serial) ? c.creado : null) }, negocio)),
  );

  // Sin pase en un teléfono no hay a dónde mandar nada. No es un fallo: es el
  // límite de avisar por Wallet, y la pantalla ya lo cuenta antes de enviar.
  // Y es una promo: a quien dijo que no, tampoco.
  const avisables = delGrupo.filter((c) => registrados.has(c.serial) && (!mensaje || !c.promos_no));
  const elegidos = avisables.slice(0, MAX_DESTINO);
  if (!elegidos.length) {
    return { error: `Nadie de "${infoDestino(destino).label}" tiene la tarjeta en el teléfono y acepta promos: no hay a quién avisar.`, status: 409 };
  }

  const seriales = elegidos.map((c) => c.serial);
  await guardarMensajes(seriales, mensaje);
  const aviso = await avisarSeriales(seriales, { negocio, texto: mensaje });

  // Quitar el mensaje no es una campaña: es recoger la anterior.
  if (!mensaje) return { ok: true, quitado: seriales.length, ...aviso };

  const campana = await crearCampana({ negocio: negocio.slug, grupo: destino, texto: mensaje, seriales, avisados: aviso.avisados });
  await addEventos(seriales.map((serial) => ({
    serial, tipo: "campana", mensaje: `Campaña «${mensaje}»`, negocio: negocio.slug, actor,
  })));

  // "Solo ese día": al cerrar, el reloj lo quita de quien lo siga teniendo.
  if (destino === MOMENTO) await apuntarPendiente(negocio.slug, { accion: "retirar", texto: mensaje, seriales, cuando: caducidadMomento(negocio.horario, Date.now()) });

  return {
    ok: true,
    campana: { id: campana.id, grupo: destino, texto: mensaje, creado: campana.creado },
    enGrupo: delGrupo.length,
    destinatarios: seriales.length,
    recortado: avisables.length > MAX_DESTINO,
    ...aviso,
  };
}

/** Manda ya, a todos (la promo) o a un destino. */
export const mandarAhora = (negocio, destino, texto, opciones) =>
  esPromo(destino) ? ponerPromo(negocio.slug, texto) : mandarMensaje(negocio, destino, texto, opciones);

// ---------------------------------------------------- envíos a una hora
/** Añade un envío a la lista de la tienda. Relee antes de escribir: dos pestañas abiertas no se pisan. */
export async function apuntarPendiente(slug, envio) {
  const negocio = await getNegocio(slug);
  if (!negocio) return null;
  const nuevo = { id: ID(), ...envio };
  await saveNegocio(slug, { enviosProgramados: [...(negocio.enviosProgramados || []), nuevo] });
  return nuevo;
}

/** Quita un envío de la lista (cancelarlo). @returns {Promise<boolean>} si estaba */
export async function quitarPendiente(slug, id) {
  const negocio = await getNegocio(slug);
  const lista = negocio?.enviosProgramados || [];
  if (!lista.some((p) => p.id === id)) return false;
  await saveNegocio(slug, { enviosProgramados: lista.filter((p) => p.id !== id) });
  return true;
}

/** Quita el mensaje de "solo ese día" a quien lo siga teniendo (otro posterior no se toca). */
async function retirar(negocio, { texto, seriales }) {
  const mios = new Set(seriales);
  const siguen = (await listClientes(negocio.slug)).filter((c) => mios.has(c.serial) && c.mensaje === texto).map((c) => c.serial);
  if (!siguen.length) return 0;
  await guardarMensajes(siguen, null);
  // Sin texto: el pase se pone al día en silencio.
  await avisarSeriales(siguen, { negocio, texto: null });
  return siguen.length;
}

/**
 * Lo que le toca a una tienda en esta pasada del reloj. Primero se SACAN de la
 * lista y luego se mandan: si el envío falla a medias, no se repite en la
 * siguiente pasada (un aviso doble es peor que uno que no salió, y el
 * historial dirá lo que llegó).
 */
export async function enviarPendientes(negocio, ahora = Date.now()) {
  const { tocan, esperan } = repartirPendientes(negocio.enviosProgramados, ahora);
  if (!tocan.length) return [];
  await saveNegocio(negocio.slug, { enviosProgramados: esperan });
  const fresco = { ...negocio, enviosProgramados: esperan };
  const hechos = [];
  for (const p of tocan) {
    try {
      if (p.accion === "retirar") {
        hechos.push({ id: p.id, retirados: await retirar(fresco, p) });
      } else {
        const r = await mandarAhora(fresco, p.destino, p.texto, { actor: "programado" });
        hechos.push({ id: p.id, destino: p.destino, ...(r.error ? { error: r.error } : { destinatarios: r.destinatarios ?? r.total ?? 0 }) });
      }
    } catch (e) {
      console.error(`[envios] ${negocio.slug}/${p.id} falló:`, e);
      hechos.push({ id: p.id, error: String(e?.message || e) });
    }
  }
  return hechos;
}
