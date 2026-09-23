// ============================================================================
// REGISTRO MODULAR DE ACCIONES
// ----------------------------------------------------------------------------
// aplicar(cliente, negocio) -> { cliente, mensaje, evento? }  ó  { ok:false, mensaje }
// cliente  = { serial, negocio, sellos, sellos2, premios, guardados, guardados2 }
// negocio  = { slug, nombre, tipo, meta, premio, cartillas, tema, ... }
// No importa nada del servidor, así la UI también lo usa para pintar botones.
// `icon` es el nombre de un icono de app/Icono.js.
//
// DOS CARTILLAS: sellar, quitar y canjear existen una vez por cartilla. Las de
// la segunda (`sellar2`…) no se activan aparte: van con la de la primera, y
// solo en las tiendas que llevan dos (ver lib/cartillas.js).
//
// EL PREMIO: con la cartilla llena la caja elige entre DARLO YA (`canjear`) o
// GUARDARLO (`guardar`): la cartilla vuelve a cero y el premio queda en la
// tarjeta para otro día (`usarGuardado`). Las dos últimas van con `canjear`
// (`vaCon`): quien puede dar premios puede guardarlos, sin otra casilla.
// ============================================================================

import { CONTADORES, GUARDADOS, cartillasDe } from "./cartillas";

/** Meta, premio y columnas de la cartilla `i` de este negocio. */
function cartilla(n, i) {
  const c = n.cartillas?.[i];
  return {
    meta: c?.meta ?? n.meta, premio: c?.premio ?? n.premio, nombre: c?.nombre ?? null,
    clave: CONTADORES[i], claveGuardados: GUARDADOS[i],
  };
}

// "Cookies 3/8" con dos cartillas; "3/8" a secas con una, como siempre.
const cuenta = (k, sellos) => `${k.nombre ? `${k.nombre} ` : ""}${sellos}/${k.meta}`;
const deCartilla = (k) => (k.nombre ? ` de ${k.nombre.toLowerCase()}` : "");
// "1 guardado" / "2 guardados".
const cuantosGuardados = (n) => `${n} ${n === 1 ? "guardado" : "guardados"}`;

const sellar = (i) => ({
  label: "Añadir sello",
  icon: "mas",
  descripcion: "Suma un sello a la cartilla.",
  aplicar(c, n) {
    const k = cartilla(n, i);
    const antes = c[k.clave] || 0;
    if (antes >= k.meta) return { ok: false, mensaje: `Cartilla${deCartilla(k)} llena: dale el premio o guárdaselo.` };
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
  descripcion: "Entrega el premio (o lo guarda en la tarjeta) / aplica el descuento.",
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

const guardar = (i) => ({
  label: "Guardar premio",
  icon: "cartera",
  vaCon: "canjear",
  descripcion: "Guarda el premio en la tarjeta y empieza otra cartilla.",
  aplicar(c, n) {
    if (n.tipo === "descuento") return { ok: false, mensaje: "Un cupón no se guarda: se usa o no." };
    const k = cartilla(n, i);
    const sellos = c[k.clave] || 0;
    if (sellos < k.meta) return { ok: false, mensaje: `Aún no llega · ${cuenta(k, sellos)}` };
    const guardados = (c[k.claveGuardados] || 0) + 1;
    return {
      cliente: { ...c, [k.clave]: 0, [k.claveGuardados]: guardados },
      mensaje: `Premio guardado en su tarjeta (${cuantosGuardados(guardados)}). La cartilla${deCartilla(k)} vuelve a empezar.`,
      evento: `Guardó: ${k.premio}`,
    };
  },
});

const usarGuardado = (i) => ({
  label: "Usar premio guardado",
  icon: "regalo",
  vaCon: "canjear",
  descripcion: "Entrega un premio que el cliente tenía guardado.",
  aplicar(c, n) {
    const k = cartilla(n, i);
    const guardados = c[k.claveGuardados] || 0;
    if (guardados < 1) return { ok: false, mensaje: "No tiene ningún premio guardado." };
    const quedan = guardados - 1;
    return {
      cliente: { ...c, [k.claveGuardados]: quedan, premios: (c.premios || 0) + 1 },
      mensaje: `Premio entregado: ${k.premio}${quedan ? `. Le quedan ${cuantosGuardados(quedan)}.` : ""}`,
      evento: `Usó un premio guardado: ${k.premio}`,
    };
  },
});

export const ACCIONES = {
  sellar: sellar(0),
  restar: restar(0),
  canjear: canjear(0),
  guardar: guardar(0),
  usarGuardado: usarGuardado(0),
  sellar2: { ...sellar(1), segunda: "sellar" },
  restar2: { ...restar(1), segunda: "restar" },
  canjear2: { ...canjear(1), segunda: "canjear" },
  guardar2: { ...guardar(1), segunda: "guardar" },
  usarGuardado2: { ...usarGuardado(1), segunda: "usarGuardado" },

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

/** Las que el manager puede activar o no (las de la segunda cartilla y las del premio van solas). */
export const LISTA_ACCIONES = Object.entries(ACCIONES).filter(([, v]) => !v.segunda && !v.vaCon).map(resumen);

/**
 * ¿Puede la caja de este negocio hacer esta acción? Las de la segunda cartilla
 * siguen a su pareja de la primera, y solo existen si hay dos cartillas. Guardar
 * y usar un premio guardado siguen a `canjear`.
 */
export function accionPermitida(negocio, key) {
  const def = Object.hasOwn(ACCIONES, key) ? ACCIONES[key] : null;
  if (!def) return false;
  if (def.segunda && !negocio.cartillas) return false;
  const base = def.segunda || key;
  return negocio.acciones.includes(ACCIONES[base].vaCon || base);
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
 *
 * En una tienda de sellos NO sale "Canjear": el premio tiene su propio recuadro
 * (`premiosDe`), que solo aparece cuando hay algo que dar y pregunta si se da
 * ya o se guarda. Un botón que casi siempre contesta "aún no llega" estorba.
 */
export function accionesDe(negocio) {
  const lista = [];
  for (const a of LISTA_ACCIONES) {
    if (!negocio.acciones.includes(a.key)) continue;
    if (a.key === "canjear" && negocio.tipo !== "descuento") continue;
    const pareja = Object.keys(ACCIONES).find((k) => ACCIONES[k].segunda === a.key);
    if (!negocio.cartillas || !pareja) { lista.push(a); continue; }
    negocio.cartillas.forEach((c, i) => {
      lista.push({ ...a, key: i === 0 ? a.key : pareja, label: ETIQUETA[a.key](singular(c.nombre)), cartilla: i });
    });
  }
  return lista;
}

const claveDe = (base, i) => (i === 0 ? base : `${base}${i + 1}`);

/**
 * El recuadro del premio en la caja, cartilla a cartilla: solo las que tienen
 * algo que dar (llena, o con premios guardados). Vacío si la tienda es de
 * cupones o el manager no deja canjear.
 * @returns {{indice:number, nombre:string|null, premio:string, completa:boolean, guardados:number, acciones:{dar:string, guardar:string, usar:string}}[]}
 */
export function premiosDe(cliente, negocio) {
  if (negocio.tipo === "descuento" || !negocio.acciones.includes("canjear")) return [];
  return cartillasDe(cliente, negocio)
    .filter((c) => c.completa || c.guardados > 0)
    .map((c) => ({
      indice: c.indice,
      nombre: negocio.cartillas ? c.nombre : null,
      premio: c.premio,
      completa: c.completa,
      guardados: c.guardados,
      acciones: { dar: claveDe("canjear", c.indice), guardar: claveDe("guardar", c.indice), usar: claveDe("usarGuardado", c.indice) },
    }));
}
