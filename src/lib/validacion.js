// Validación de entradas del manager (funciones puras, testeadas).

const MAX_UBICACIONES = 10; // límite de Apple Wallet

/**
 * Normaliza las ubicaciones de tienda. Devuelve null si alguna es inválida.
 * @param {unknown} lista
 * @returns {{lat:number, lng:number, texto?:string}[] | null}
 */
export function normalizarUbicaciones(lista) {
  if (!Array.isArray(lista) || lista.length > MAX_UBICACIONES) return null;
  const out = [];
  for (const u of lista) {
    const lat = typeof u?.lat === "string" && !u.lat.trim() ? NaN : Number(u?.lat);
    const lng = typeof u?.lng === "string" && !u.lng.trim() ? NaN : Number(u?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const texto = typeof u.texto === "string" && u.texto.trim() ? u.texto.trim().slice(0, 120) : undefined;
    out.push({ lat, lng, ...(texto ? { texto } : {}) });
  }
  return out;
}

/**
 * Patch de configuración de negocio a partir del body del manager.
 * @returns {{patch:object} | {error:string}}
 */
export function patchNegocio(body, accionesValidas) {
  const b = body && typeof body === "object" ? body : {};
  const patch = {};
  if (Number.isFinite(b.meta)) patch.meta = Math.max(1, Math.min(50, Math.round(b.meta)));
  if (typeof b.premio === "string" && b.premio.trim()) patch.premio = b.premio.trim().slice(0, 128);
  if (Array.isArray(b.acciones)) patch.acciones = [...new Set(b.acciones.filter((k) => accionesValidas.includes(k)))];
  if (typeof b.promo === "string" || b.promo === null) patch.promo = b.promo?.trim().slice(0, 200) || null;
  if (b.ubicaciones !== undefined) {
    const ubicaciones = normalizarUbicaciones(b.ubicaciones);
    if (!ubicaciones) return { error: "Ubicaciones no válidas (máx. 10, lat/lng numéricos)" };
    patch.ubicaciones = ubicaciones;
  }
  return { patch };
}
