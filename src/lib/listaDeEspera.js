import { getNegocio, contarTarjetas, listEspera, contarEspera, addEspera, borrarEspera, negociosConEspera } from "./store";
import { quedaCupo } from "./planes";
import { leerEmail } from "./interesados";
import { hayCorreo, mandarCorreo } from "./correo";
import { appUrl } from "./url";
import { MESES_ESPERA } from "./legal";

// ============================================================================
// LA LISTA DE ESPERA DE UNA TIENDA LLENA
// ----------------------------------------------------------------------------
// Una tienda del plan Gratis tiene 50 tarjetas en uso (lib/planes.js). El cliente
// 51 no se va con las manos vacías: deja su correo en la página de la tienda y,
// cuando la tienda pasa a Pro, le mandamos el enlace para sacarla sin volver al
// mostrador.
//
// - Solo el correo, cifrado (tabla `espera`). Se borra AL MANDARLE el correo; si la
//   tienda nunca pasa, a los MESES_ESPERA (la pasada diaria, lib/limpieza.js).
// - **Solo se escribe desde una tienda SIN límite** (Pro, la pone el admin), nunca
//   porque una gratis libere sitio: el correo sale con nuestro dominio y el nombre
//   de la tienda, y una tienda gratis la puede crear cualquiera en /alta. Sin esto,
//   bastaba crear «Tu banco», llenarla, apuntar correos ajenos y esperar un día a
//   que las tarjetas vacías dejaran sitio. Es lo que promete la web: «les llega la
//   tarjeta cuando pases a Pro».
// - Por orden de llegada y como mucho MAX_POR_PASADA cada vez (Resend admite pocos
//   por segundo y una función tiene su tiempo); lo demás, en la siguiente pasada.
// - Cada fila se RECLAMA (se borra) antes de mandar: si el reloj y el admin la
//   atienden a la vez, solo uno escribe. Si el correo no sale por algo pasajero,
//   vuelve a la cola en su sitio; si la dirección no vale, se queda borrada.
// - Lo manda el reloj (`atenderTodas`, cada 15 min) y, al momento, el cambio de
//   plan en el admin. Sin proveedor de correo (lib/correo.js) no se manda nada y
//   la fila se queda: nunca se da por avisado a quien no lo fue.
// - El enlace es la página de la tienda (/<slug>), no el tap: un antivirus del
//   correo que abre los enlaces antes que la persona no le saca una tarjeta.
// ============================================================================

/** Más que esto apuntados en una tienda ya no es gente en la cola: es un bucle. */
export const MAX_EN_ESPERA = 500;
/** Correos por tienda en cada pasada. */
export const MAX_POR_PASADA = 20;

/** El enlace del correo: la página de la tienda, que ofrece sacarla con un toque. */
export const enlaceDeTienda = (slug) => `${appUrl()}/${encodeURIComponent(slug)}`;

/** El correo que le llega. Texto llano: lo lee igual cualquier programa de correo. */
export function correoDeTarjeta(negocio) {
  const enlace = enlaceDeTienda(negocio.slug);
  return {
    asunto: `Ya puedes sacar tu tarjeta de ${negocio.nombre}`,
    texto: [
      "Hola:",
      "",
      `Te apuntaste para la tarjeta de puntos de ${negocio.nombre} y ya te la podemos dar.`,
      "Abre este enlace desde el móvil y sácala con un toque:",
      "",
      enlace,
      "",
      "Ya no guardamos tu correo: lo hemos borrado al mandarte este mensaje.",
      "",
      `${negocio.nombre}, con fiddle`,
    ].join("\n"),
  };
}

/**
 * Apunta a alguien en la lista de una tienda.
 * @returns {Promise<{ok:true, yaEstaba?:boolean} | {error:string, status:number, hayCupo?:boolean}>}
 */
export async function apuntarEnEspera(slug, emailEscrito) {
  const email = leerEmail(emailEscrito)?.toLowerCase();
  if (!email) return { error: "Revisa el correo", status: 400 };
  const negocio = await getNegocio(slug);
  if (!negocio) return { error: "Esta tienda no existe", status: 404 };
  // Solo si de verdad está llena: si hay sitio, que la saque ya.
  if (!negocio.cupo || quedaCupo(negocio, await contarTarjetas(slug))) {
    return { error: "Ya hay tarjetas: vuelve a escanear el QR o recarga la página", status: 409, hayCupo: true };
  }
  const lista = await listEspera(slug);
  if (lista.some((f) => f.email === email)) return { ok: true, yaEstaba: true };
  if (lista.length >= MAX_EN_ESPERA) return { error: "La lista de espera de esta tienda está llena", status: 409 };
  await addEspera(slug, email);
  return { ok: true };
}

/**
 * Manda el correo a los primeros de la cola si la tienda ya es de las que no
 * tienen límite (Pro). Nunca lanza.
 * @param {object|string} negocioOSlug
 * @param {{max?: number}} [opciones]
 * @returns {Promise<{mandados:number, esperan:number, sinCorreo?:boolean, error?:string}>}
 */
export async function atenderEspera(negocioOSlug, { max = MAX_POR_PASADA } = {}) {
  try {
    const negocio = typeof negocioOSlug === "string" ? await getNegocio(negocioOSlug) : negocioOSlug;
    if (!negocio || negocio.archivado) return { mandados: 0, esperan: 0 };
    const lista = await listEspera(negocio.slug);
    if (!lista.length) return { mandados: 0, esperan: 0 };
    // Con límite (Gratis), nadie: ver la cabecera.
    if (negocio.cupo) return { mandados: 0, esperan: lista.length };
    if (!hayCorreo()) return { mandados: 0, esperan: lista.length, sinCorreo: true };

    const { asunto, texto } = correoDeTarjeta(negocio);
    let mandados = 0;
    let fuera = 0; // los que salieron de la cola: mandados o con una dirección que no vale
    for (const fila of lista.slice(0, max)) {
      // Reclamarla: si otra pasada ya la cogió, no se manda dos veces.
      if (!(await borrarEspera(fila.id))) continue;
      fuera++;
      const r = await mandarCorreo({ para: fila.email, asunto, texto });
      if (r.ok) mandados++;
      // Algo pasajero (Resend ocupado, la red): vuelve a la cola en su sitio.
      else if (!r.permanente && fila.email) {
        await addEspera(negocio.slug, fila.email, { creado: fila.creado });
        fuera--;
      }
    }
    return { mandados, esperan: lista.length - fuera };
  } catch (e) {
    console.error("[espera] no se pudo atender la lista:", e?.message || e);
    return { mandados: 0, esperan: 0, error: String(e?.message || e) };
  }
}

/** La pasada del reloj por todas las tiendas con alguien esperando. Nunca lanza. */
export async function atenderTodas() {
  try {
    const slugs = await negociosConEspera();
    const resultado = {};
    for (const slug of slugs) {
      const r = await atenderEspera(slug);
      if (r.mandados || r.error) resultado[slug] = r;
    }
    return resultado;
  } catch (e) {
    console.error("[espera] pasada del reloj:", e);
    return { error: String(e?.message || e) };
  }
}

/** Lo que ve el dueño y el admin de su lista: cuántos y si se les puede escribir. */
export async function estadoEspera(slug) {
  return { esperan: await contarEspera(slug).catch(() => 0), hayCorreo: hayCorreo(), meses: MESES_ESPERA };
}
