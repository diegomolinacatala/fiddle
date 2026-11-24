// ============================================================================
// PRIMEROS PASOS (el onboarding del dueño)
// ----------------------------------------------------------------------------
// Lo que ve una tienda nueva al terminar de elegir sus accesos: cinco pasos, uno
// por pantalla, en /<slug>/primeros-pasos. Ninguno es obligatorio: se puede dejar
// para luego («Terminar luego»), saltar uno («Ahora no») u ocultar el aviso de
// Tienda, que es una barra con lo que lleva y el botón para seguir.
//
// Solo lo tienen las tiendas que lo traen en su config (`primerosPasos`): las de
// /alta y la de dev. Una tienda que ya trabaja (La Delicantería en producción) no
// tiene la clave y no ve nada: un despliegue no le pone un aviso en su panel.
//
// Un paso cuenta como hecho si se terminó aquí (`hechos`) o si lo que pide ya
// está en la tienda (el horario puesto, una promo escrita): quien lo ha tocado
// todo por su cuenta no tiene que repetirlo. Puro, sin nada del servidor: lo usan
// el panel, la página del recorrido y la API.
// ============================================================================

/**
 * Los pasos, en orden. `id` es también el hash de la página (`#qr`). `corto` es
 * lo que cabe en la barra de Tienda.
 */
export const PASOS = [
  { id: "tarjeta", nombre: "Tu tarjeta", corto: "Tarjeta" },
  { id: "qr", nombre: "El QR del mostrador", corto: "QR" },
  { id: "horario", nombre: "Tu horario", corto: "Horario" },
  { id: "clientes", nombre: "Tus clientes", corto: "Clientes" },
  { id: "promos", nombre: "Promociones", corto: "Promos" },
];

export const IDS = PASOS.map((p) => p.id);
/** La pantalla del final: no es un paso, no se cuenta ni se marca. */
export const FINAL = "listo";

const fecha = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * Lo guardado en la config, limpio, o null si la tienda no tiene primeros pasos.
 * @returns {{ desde: string|null, hechos: string[], oculto: boolean } | null}
 */
export function normalizarPrimerosPasos(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const hechos = Array.isArray(v.hechos) ? IDS.filter((id) => v.hechos.includes(id)) : [];
  return { desde: fecha(v.desde), hechos, oculto: v.oculto === true };
}

/** Lo que pone /api/alta en una tienda nueva. */
export const primerosPasosNuevos = (ahora = new Date()) => ({ desde: ahora.toISOString(), hechos: [], oculto: false });

/** ¿Lo que pide este paso ya está en la tienda, se haya pasado por aquí o no? */
function hechoFuera(id, n) {
  if (id === "horario") return Boolean(n?.horario);
  if (id === "promos") return typeof n?.promo === "string" && n.promo.trim() !== "";
  return false;
}

/**
 * Cómo va una tienda: null si no tiene primeros pasos.
 * @returns {null | { hechos: string[], total: number, siguiente: string|null, terminado: boolean, oculto: boolean }}
 *   `siguiente`: el primer paso sin hacer (null si están todos).
 */
export function avanceDe(n) {
  const pp = normalizarPrimerosPasos(n?.primerosPasos);
  if (!pp) return null;
  const hechos = IDS.filter((id) => pp.hechos.includes(id) || hechoFuera(id, n));
  const siguiente = IDS.find((id) => !hechos.includes(id)) ?? null;
  return { hechos, total: IDS.length, siguiente, terminado: siguiente === null, oculto: pp.oculto };
}

/** ¿Sale la barra en Tienda? Con primeros pasos, sin terminar y sin ocultar. */
export function mostrarAviso(n) {
  const a = avanceDe(n);
  return Boolean(a && !a.terminado && !a.oculto);
}

/**
 * La config tras marcar un paso como hecho (sin repetir y en orden). Un id que no
 * es un paso deja todo igual. Devuelve un objeto nuevo.
 */
export function marcarHecho(pp, id) {
  const base = normalizarPrimerosPasos(pp) ?? primerosPasosNuevos();
  if (!IDS.includes(id) || base.hechos.includes(id)) return base;
  const hechos = IDS.filter((x) => x === id || base.hechos.includes(x));
  return { ...base, hechos };
}

/** La config con el aviso de Tienda oculto o a la vista. */
export function conOculto(pp, oculto) {
  const base = normalizarPrimerosPasos(pp) ?? primerosPasosNuevos();
  return { ...base, oculto: oculto === true };
}

/**
 * El paso que dice un hash (`#horario`): uno desconocido o vacío es `null`, y la
 * página decide (el siguiente sin hacer). `#listo` es la pantalla del final.
 */
export function pasoDeHash(hash) {
  const id = String(hash || "").replace(/^#/, "");
  if (id === FINAL) return FINAL;
  return IDS.includes(id) ? id : null;
}

/** El que sigue a `id` (el final tras el último). */
export const siguienteDe = (id) => (id === FINAL ? FINAL : IDS[IDS.indexOf(id) + 1] ?? FINAL);

/** El anterior a `id`, o null en el primero. */
export function anteriorDe(id) {
  if (id === FINAL) return IDS.at(-1);
  const i = IDS.indexOf(id);
  return i > 0 ? IDS[i - 1] : null;
}

/** El cuerpo que acepta POST /api/primeros-pasos: `{hecho}` o `{oculto}`, nada más. */
export function leerCambio(body) {
  const b = body && typeof body === "object" ? body : {};
  if (typeof b.hecho === "string") return IDS.includes(b.hecho) ? { hecho: b.hecho } : { error: "Paso desconocido" };
  if (typeof b.oculto === "boolean") return { oculto: b.oculto };
  return { error: "Nada que cambiar" };
}
