import { estadoDe } from "./resumen";
import { cartillasDe } from "./cartillas";
import { rutaIcono, rutaInsignia } from "./rutasImagen";

// ============================================================================
// QUÉ SE LE DICE AL CLIENTE
// ----------------------------------------------------------------------------
// Los textos de los avisos que no son de Apple (Apple los arma solo a partir
// del campo del pase que cambia): la notificación del navegador en Android, el
// mensaje de Google Wallet y el aviso que sale en la propia tarjeta web cuando
// la caja acaba de sellar. Funciones puras: las usan servidor y navegador, así
// que el teléfono y la pantalla dicen siempre lo mismo.
// ============================================================================

/** "Te faltan 3 para café gratis" / "Te falta 1 para…" */
function faltanPara(faltan, premio) {
  return `Te ${faltan === 1 ? "falta" : "faltan"} ${faltan} para ${premio}.`;
}

/**
 * Aviso tras un cambio en la tarjeta, o null si no merece avisar (una
 * corrección de la caja, un cambio de nombre, una visita sin sello).
 * @param {{sellos:number, premios:number}|null} antes
 * @param {{sellos:number, premios:number}} despues
 * @param {{nombre:string, tipo:string, meta:number, premio:string}} negocio
 * @returns {{titulo:string, cuerpo:string, tipo:"sello"|"completa"|"canje"}|null}
 */
export function avisoDeCambio(antes, despues, negocio) {
  if (!antes || !despues || !negocio) return null;
  const titulo = negocio.nombre;
  const e = estadoDe(despues, negocio);

  if (negocio.cartillas && !e.esCupon) return avisoDeCartillas(antes, despues, negocio);
  if ((despues.premios || 0) > (antes.premios || 0)) {
    return e.esCupon
      ? { titulo, cuerpo: `Cupón usado: ${negocio.premio}. Gracias por venir.`, tipo: "canje" }
      : { titulo, cuerpo: `Premio canjeado: ${negocio.premio}. Empiezas una cartilla nueva.`, tipo: "canje" };
  }
  if ((despues.sellos || 0) > (antes.sellos || 0)) {
    return e.completa
      ? { titulo, cuerpo: `Cartilla completa. Tu ${negocio.premio} te espera en caja.`, tipo: "completa" }
      : { titulo, cuerpo: `Sello ${e.sellos} de ${e.meta}. ${faltanPara(e.faltan, negocio.premio)}`, tipo: "sello" };
  }
  return null;
}

/**
 * Lo mismo con dos cartillas: el aviso dice de cuál es ("Cafés: 3 de 8"), y un
 * canje se reconoce porque su cartilla vuelve a cero.
 */
function avisoDeCartillas(antes, despues, negocio) {
  const titulo = negocio.nombre;
  const previas = cartillasDe(antes, negocio);
  for (const c of cartillasDe(despues, negocio)) {
    const antesN = antes[c.clave] || 0;
    const ahora = despues[c.clave] || 0;
    if ((despues.premios || 0) > (antes.premios || 0) && ahora < antesN && previas[c.indice].completa) {
      return { titulo, cuerpo: `Premio canjeado: ${c.premio}. Empiezas otra cartilla de ${c.nombre.toLowerCase()}.`, tipo: "canje" };
    }
    if (ahora > antesN) {
      return c.completa
        ? { titulo, cuerpo: `Cartilla de ${c.nombre.toLowerCase()} completa. Tu ${c.premio} te espera en caja.`, tipo: "completa" }
        : { titulo, cuerpo: `${c.nombre}: ${c.sellos} de ${c.meta}. ${faltanPara(c.faltan, c.premio)}`, tipo: "sello" };
    }
  }
  return null;
}

/**
 * Lo que viaja en un aviso del navegador: el texto, a dónde lleva al tocarlo y
 * los iconos. `etiqueta` hace que un sello nuevo SUSTITUYA al aviso del sello
 * anterior en vez de apilarse: nadie quiere cinco avisos de la misma tarjeta.
 */
export function avisoPush(aviso, negocio, serial) {
  return {
    titulo: aviso.titulo,
    cuerpo: aviso.cuerpo,
    url: `/p/${serial}`,
    serial,
    icono: rutaIcono(negocio, 192),
    insignia: rutaInsignia(negocio),
    etiqueta: aviso.tipo === "promo" ? `promo-${negocio.slug}` : `tarjeta-${serial}`,
  };
}

/** Aviso de una promo de la tienda (va a todos). */
export const avisoDePromo = (negocio, texto) => ({ titulo: negocio.nombre, cuerpo: texto, tipo: "promo" });

/** Aviso de una campaña (va a un grupo: "hace tiempo que no te vemos"). */
export const avisoDeMensaje = (negocio, texto) => ({ titulo: negocio.nombre, cuerpo: texto, tipo: "mensaje" });
