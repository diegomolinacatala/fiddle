// ============================================================================
// EXPORTAR CLIENTES A CSV (para Excel, Numbers, Google Sheets o una IA)
// ----------------------------------------------------------------------------
// Excel en español separa las columnas con PUNTO Y COMA: con comas lo mete todo
// en la columna A. Y necesita la marca BOM para leer bien los acentos. Las dos
// cosas juntas abren bien en Excel, Numbers y Google Sheets.
//
// Cabeceras en castellano normal ("Última visita", no "ultima_visita"): esto lo
// abre el dueño de la tienda, no un programador. Función PURA: la ruta le pasa
// clientes y perfiles ya calculados.
// ============================================================================

import { ESTADOS, cadenciaTexto } from "./crm";
import { cartillasDe, totalGuardados } from "./cartillas";

export const SEPARADOR = ";";
const BOM = "﻿";

// Comillas dobladas y, si empieza por un signo de fórmula, un apóstrofo delante
// (Excel ejecutaría =... al abrir el fichero).
export function celda(v) {
  const s = v === null || v === undefined ? "" : String(v);
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(seguro) || seguro !== s ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const fecha = (iso) => (iso || "").slice(0, 10);

/** Columnas para esta tienda: con dos cartillas, una de sellos por cartilla, con su nombre. */
function columnas(negocio) {
  const esCupon = negocio.tipo === "descuento";
  const sellos = esCupon
    ? [["Cupón", (c) => ((c.premios || 0) > 0 ? "usado" : "sin usar")]]
    : cartillasDe({}, negocio).map((k) => [
        negocio.cartillas ? `Sellos ${k.nombre.toLowerCase()} (de ${k.meta})` : `Sellos (de ${k.meta})`,
        (c) => c[k.clave] || 0,
      ]);
  return [
    ["Código", (c) => c.codigo],
    ["Nombre", (c) => c.nombre || ""],
    ["Estado", (c, p) => ESTADOS[p.estado]?.label || p.estado],
    ["Visitas", (c, p) => p.visitas],
    ...sellos,
    ...(esCupon ? [] : [
      ["Premios guardados", (c) => totalGuardados(c)],
      ["Premios canjeados", (c) => c.premios || 0],
    ]),
    ["Alta", (c) => fecha(c.creado)],
    ["Última visita", (c) => fecha(c.ultima_visita)],
    ["Días sin venir", (c, p) => (p.diasSinVenir === null ? "" : Math.floor(p.diasSinVenir))],
    ["Frecuencia", (c, p) => (p.cadencia ? cadenciaTexto(p.cadencia) : "")],
    ["Llegó por", (c) => ({ tap: "QR / NFC", manager: "Mostrador" })[c.origen] || ""],
    ["Tarjeta en el móvil", (c, p) => (p.contactable ? "Sí" : "No")],
    ["Nota", (c) => c.nota || ""],
  ];
}

/**
 * @param {{cliente:object, perfil:object}[]} filas
 * @param {object} negocio
 * @returns {string} el fichero entero, BOM incluido
 */
export function csvClientes(filas, negocio) {
  const cols = columnas(negocio);
  const lineas = [
    cols.map(([titulo]) => celda(titulo)).join(SEPARADOR),
    ...filas.map(({ cliente, perfil }) => cols.map(([, saca]) => celda(saca(cliente, perfil))).join(SEPARADOR)),
  ];
  return BOM + lineas.join("\r\n") + "\r\n";
}
