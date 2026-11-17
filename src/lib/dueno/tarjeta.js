// ============================================================================
// LA TARJETA DEL DUEÑO: lo que se guarda de ella
// ----------------------------------------------------------------------------
// Vive en la config de la tienda (`negocio.tarjetaDueno`), sin tabla nueva.
// Lleva el token del pase: no sale NUNCA del servidor (negocioDelPersonal lo quita).
// ============================================================================

import { randomBytes } from "node:crypto";
import { getNegocio, saveNegocio } from "../store";
import { igualSeguro } from "../auth";

export const MAX_DISPOSITIVOS = 5;
const PREFIJO = "dueno-";

/** Una tarjeta nueva:el serial lleva el slug, el token es la llave del pase. */
export function nuevaTarjeta(slug) {
  return {
    activa: true,
    serial: `${PREFIJO}${slug}-${randomBytes(8).toString("hex")}`,
    token: randomBytes(24).toString("hex"),
  };
}

/** Cuántos iPhone la tienen y si está encendida: lo único que ve el admin (nunca serial ni token). */
export function resumenTarjeta(negocio) {
  const t = negocio?.tarjetaDueno;
  const lista = Array.isArray(t?.dispositivos) ? t.dispositivos : [];
  // Un iPhone se cuenta una vez aunque tenga una fila por cada Pass Type ID.
  return { activa: t?.activa === true && Boolean(t.serial && t.token), iphones: new Set(lista.map((d) => d.id)).size };
}

/** El parche de una llave nueva: otro token, sin iPhone, el mismo serial. Quien tenga el pase viejo lo pierde. */
export const conLlaveNueva = () => ({ token: randomBytes(24).toString("hex"), dispositivos: [] });

/** La tarjeta con todo lo que puede faltar puesto, o null si la tienda no la tiene activa. */
export function tarjetaDe(negocio) {
  const t = negocio?.tarjetaDueno;
  if (!t || t.activa !== true || !t.serial || !t.token) return null;
  return {
    ...t,
    dispositivos: Array.isArray(t.dispositivos) ? t.dispositivos : [],
    avisados: t.avisados && typeof t.avisados === "object" ? t.avisados : {},
    actualizado: t.actualizado ?? null,
    estado: t.estado ?? null,
    prueba: t.prueba ?? null,
  };
}

/**
 * Lee la tienda, mezcla `patch` en su tarjeta y la guarda. Devuelve la tienda o null.
 * `patch` puede ser una función `(tarjetaFresca) => parche`: así lo que depende de lo
 * guardado (la lista de iPhone, sobre todo) se calcula sobre lo leído AHORA y no sobre
 * lo que se leyó antes, esperando a la red.
 */
export async function guardarTarjeta(slug, patch) {
  const negocio = await getNegocio(slug);
  if (!negocio) return null;
  let parche = patch;
  if (typeof patch === "function") {
    const fresca = tarjetaDe(negocio);
    if (!fresca) return negocio;
    parche = patch(fresca);
  }
  const tarjetaDueno = { ...(negocio.tarjetaDueno || {}), ...parche };
  return saveNegocio(slug, { tarjetaDueno });
}

/** El slug que lleva un serial `dueno-<slug>-<16 hex>`: el slug puede tener guiones. */
export function slugDeSerial(serial) {
  const m = /^dueno-([a-z0-9-]+)-[0-9a-f]{16}$/.exec(String(serial || ""));
  return m ? m[1] : null;
}

/** La tienda a la que pertenece ese serial, o null (no existe, apagada o serial distinto). */
export async function tiendaDeSerial(serial) {
  const slug = slugDeSerial(serial);
  if (!slug) return null;
  const negocio = await getNegocio(slug);
  const tarjeta = tarjetaDe(negocio);
  return tarjeta && igualSeguro(String(serial), tarjeta.serial) ? negocio : null;
}

/** Apunta un iPhone (o actualiza su token). Máximo 5: al sexto cae el más viejo. @returns {{dispositivos:object[], nuevo:boolean}} */
export function conDispositivo(dispositivos, { id, token, tipo }, ahora = new Date().toISOString()) {
  const existe = dispositivos.some((d) => d.id === id && d.tipo === tipo);
  const sin = dispositivos.filter((d) => !(d.id === id && d.tipo === tipo));
  const previo = dispositivos.find((d) => d.id === id && d.tipo === tipo);
  const lista = [...sin, { id, token, tipo, alta: previo?.alta ?? ahora }]
    .sort((a, b) => String(a.alta).localeCompare(String(b.alta)))
    .slice(-MAX_DISPOSITIVOS);
  return { dispositivos: lista, nuevo: !existe };
}

/** Quita un iPhone de la lista. */
export const sinDispositivo = (dispositivos, { id, tipo }) =>
  dispositivos.filter((d) => !(d.id === id && d.tipo === tipo));
