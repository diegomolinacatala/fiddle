// ============================================================================
// REGISTRO MODULAR DE ACCIONES
// ----------------------------------------------------------------------------
// aplicar(cliente, negocio) -> { cliente, mensaje, evento? }  ó  { ok:false, mensaje }
// cliente  = { serial, negocio, sellos, sellos2, premios }
// negocio  = { slug, nombre, tipo, meta, premio, cartillas, tema, ... }
// No importa nada del servidor, así la UI también lo usa para pintar botones.
// `icon` es el nombre de un icono de app/Icono.js.
//
// DOS CARTILLAS: sellar, quitar y canjear existen una vez por cartilla. Las de
// la segunda (`sellar2`…) no se activan aparte: van con la de la primera, y
// solo en las tiendas que llevan dos (ver lib/cartillas.js).
// ============================================================================

import { CONTADORES } from "./cartillas";

/** Meta, premio y columna de la cartilla `i` de este negocio. */
function cartilla(n, i) {
  const c = n.cartillas?.[i];
  return { meta: c?.meta ?? n.meta, premio: c?.premio ?? n.premio, nombre: c?.nombre ?? null, clave: CONTADORES[i] };
}

// "Cookies 3/8" con dos cartillas; "3/8" a secas con una, como siempre.
const cuenta = (k, sellos) => `${k.nombre ? `${k.nombre} ` : ""}${sellos}/${k.meta}`;

const sellar = (i) => ({
  label: "Añadir sello",
  icon: "mas",
  descripcion: "Suma un sello a la cartilla.",
  aplicar(c, n) {
    const k = cartilla(n, i);
    const antes = c[k.clave] || 0;
    if (antes >= k.meta) return { ok: false, mensaje: `Cartilla${k.nombre ? ` de ${k.nombre.toLowerCase()}` : ""} llena — toca canjear.` };
    const sellos = antes + 1;
    return { cliente: { ...c, [k.clave]: sellos }, mensaje: `Sello añadido · ${cuenta(k, sellos)}`, evento: `Sello ${cuenta(k, sellos)}` };
  },
});

const restar = (i) => ({
  label: "Quitar sello",
  icon: "menos",
  correccion: true, // se pinta en segundo plano: arreglar un error no es el gesto habitual
  descripcion: "Corrige un sello de más.",
  aplicar(c, n) {
    const k = cartilla(n, i);
    const sellos = Math.max(0, (c[k.clave] || 0) - 1);
    return { cliente: { ...c, [k.clave]: sellos }, mensaje: `Sello quitado · ${cuenta(k, sellos)}`, evento: `Corrección → ${cuenta(k, sellos)}` };
  },
});

const canjear = (i) => ({
  label: "Canjear",
  icon: "regalo",
  descripcion: "Entrega el premio / aplica el descuento.",
  aplicar(c, n) {
    if (n.tipo === "descuento") {
      if ((c.premios || 0) > 0) return { ok: false, mensaje: "Este cupón ya se usó." };
      return { cliente: { ...c, premios: 1 }, mensaje: `Descuento aplicado: ${n.premio}`, evento: `Cupón usado: ${n.premio}` };
    }
    const k = cartilla(n, i);
    const sellos = c[k.clave] || 0;
    if (sellos < k.meta) return { ok: false, mensaje: `Aún no llega · ${cuenta(k, sellos)}` };
    return { cliente: { ...c, [k.clave]: 0, premios: (c.premios || 0) + 1 }, mensaje: `Premio entregado: ${k.premio}`, evento: `Canjeó: ${k.premio}` };
  },
});

export const ACCIONES = {
  sellar: sellar(0),
  restar: restar(0),
  canjear: canjear(0),
  sellar2: { ...sellar(1), segunda: "sellar" },
  restar2: { ...restar(1), segunda: "restar" },
  canjear2: { ...canjear(1), segunda: "canjear" },

  confirmar: {
    label: "Confirmar visita",
    icon: "check",
    descripcion: "Registra una visita sin tocar la cartilla.",
    aplicar(c) {
      return { cliente: c, mensaje: "Visita confirmada", evento: "Visita confirmada" };
    },
  },
};

const resumen = ([key, v]) => ({
  key, label: v.label, icon: v.icon, descripcion: v.descripcion, correccion: Boolean(v.correccion),
});

/** Las que el manager puede activar o no (las de la segunda cartilla van solas). */
export const LISTA_ACCIONES = Object.entries(ACCIONES).filter(([, v]) => !v.segunda).map(resumen);

/**
 * ¿Puede la caja de este negocio hacer esta acción? Las de la segunda cartilla
 * siguen a su pareja de la primera, y solo existen si hay dos cartillas.
 */
export function accionPermitida(negocio, key) {
  const def = Object.hasOwn(ACCIONES, key) ? ACCIONES[key] : null;
  if (!def) return false;
  if (def.segunda) return Boolean(negocio.cartillas) && negocio.acciones.includes(def.segunda);
  return negocio.acciones.includes(key);
}

// Lo que dice el botón cuando hay dos cartillas: "Añadir cookie", no "Añadir sello".
const ETIQUETA = { sellar: (u) => `Añadir ${u}`, restar: (u) => `Quitar ${u}`, canjear: (u) => `Canjear ${u}` };

/** Singular del nombre de la cartilla para el botón: "Cookies" -> "cookie", "Cafés" -> "café". */
export function singular(nombre) {
  const n = String(nombre || "").trim().toLowerCase();
  if (/[^aeiouáéíóú]es$/.test(n)) return n.slice(0, -2);
  return n.endsWith("s") ? n.slice(0, -1) : n;
}

/**
 * Los botones de la caja para este negocio, en orden y ya con su texto. Con dos
 * cartillas cada acción sale dos veces, una por cartilla y con su nombre.
 */
export function accionesDe(negocio) {
  const lista = [];
  for (const a of LISTA_ACCIONES) {
    if (!negocio.acciones.includes(a.key)) continue;
    const pareja = Object.keys(ACCIONES).find((k) => ACCIONES[k].segunda === a.key);
    if (!negocio.cartillas || !pareja) { lista.push(a); continue; }
    negocio.cartillas.forEach((c, i) => {
      lista.push({ ...a, key: i === 0 ? a.key : pareja, label: ETIQUETA[a.key](singular(c.nombre)), cartilla: i });
    });
  }
  return lista;
}
