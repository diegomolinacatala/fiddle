// ============================================================================
// DOS CARTILLAS EN UN MISMO PASE
// ----------------------------------------------------------------------------
// Hay tiendas que en papel llevan dos cartillas en la misma tarjeta: ocho
// galletas y ocho cafés, cada una con su premio. En el pase van igual: una
// banda con dos filas y un contador por fila.
//
// La PRIMERA cartilla es la de siempre: cuenta en `sellos` y su meta y premio
// son los del negocio (`negocio.meta`, `negocio.premio`). Así todo lo que ya
// sabía de una sola cartilla (CRM, cupones, avisos) sigue valiendo sin tocarlo.
// La SEGUNDA cuenta en `sellos2`. Los premios canjeados se suman en `premios`.
//
// PREMIOS GUARDADOS: con la cartilla llena el cliente puede no gastar el premio
// todavía. La cartilla vuelve a cero (puede seguir sellando) y el premio queda
// apuntado en `guardados` (o `guardados2`, el de la segunda cartilla) hasta que
// lo pida.
//
// Funciones puras: las usan el servidor, la caja y la vista previa.
// ============================================================================

/** En qué columna del cliente cuenta cada cartilla, por orden. */
export const CONTADORES = ["sellos", "sellos2"];

/** Y dónde se apuntan los premios que se guardó sin gastar, cartilla a cartilla. */
export const GUARDADOS = ["guardados", "guardados2"];

/**
 * Cómo va el cliente en cada cartilla. Una tienda normal devuelve UNA, con la
 * meta y el premio del negocio, para que quien recorra la lista no tenga que
 * preguntar si hay una o dos.
 * @returns {{indice:number, clave:string, claveGuardados:string, nombre:string, marca:string|null, meta:number, premio:string, sellos:number, faltan:number, completa:boolean, guardados:number}[]}
 */
export function cartillasDe(cliente, negocio) {
  const lista = negocio?.cartillas || [{ nombre: "Sellos", marca: null, meta: negocio?.meta, premio: negocio?.premio }];
  return lista.map((c, indice) => {
    const clave = CONTADORES[indice];
    const claveGuardados = GUARDADOS[indice];
    const hechos = Math.max(0, cliente?.[clave] ?? 0);
    return {
      ...c,
      indice,
      clave,
      claveGuardados,
      sellos: Math.min(hechos, c.meta),
      faltan: Math.max(0, c.meta - hechos),
      completa: hechos >= c.meta,
      guardados: Math.max(0, cliente?.[claveGuardados] ?? 0),
    };
  });
}

/** "3/8 · 5/8": cómo va de un vistazo, para listas y el pase de Google. */
export const cuentaCorta = (cliente, negocio) =>
  cartillasDe(cliente, negocio).map((c) => `${c.sellos}/${c.meta}`).join(" · ");

/** Texto alternativo de la banda: "Cookies 3 de 8, Cafés 5 de 8" o "3 de 8 sellos". */
export function describirBanda(cliente, negocio) {
  const lista = cartillasDe(cliente, negocio);
  if (!negocio?.cartillas) return `${lista[0].sellos} de ${lista[0].meta} sellos`;
  return lista.map((c) => `${c.nombre} ${c.sellos} de ${c.meta}`).join(", ");
}

/**
 * El saldo de un cliente en una línea, para listas: "3/8 · 4/8 · 1 guardado · 2 canjeados",
 * o "usado" / "sin usar" en un cupón. Un solo sitio para que ninguna lista se
 * olvide de la segunda cartilla ni de los guardados.
 */
export function saldoCorto(cliente, negocio) {
  if (negocio?.tipo === "descuento") return (cliente?.premios || 0) > 0 ? "usado" : "sin usar";
  const g = totalGuardados(cliente);
  const p = cliente?.premios || 0;
  return [
    cuentaCorta(cliente, negocio),
    g ? `${g} ${g === 1 ? "guardado" : "guardados"}` : null,
    p ? `${p} ${p === 1 ? "canjeado" : "canjeados"}` : null,
  ].filter(Boolean).join(" · ");
}

/** Premios guardados sin gastar, sumando las dos cartillas. */
export const totalGuardados = (cliente) => GUARDADOS.reduce((a, k) => a + Math.max(0, cliente?.[k] ?? 0), 0);
