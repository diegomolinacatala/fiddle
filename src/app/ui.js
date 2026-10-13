// ============================================================================
// ESTILO DE LA APP (claro y oscuro)
// ----------------------------------------------------------------------------
// Antes cada pantalla repetía sus propios colores oscuros en constantes sueltas.
// Aquí viven una sola vez: colores + los trozos que se repiten (página, panel,
// etiqueta, campo, botón). Las pantallas los importan y componen con `...`.
//
// MODO OSCURO: cada color de `C` es una variable CSS (`var(--c-…)`). Sus dos
// valores, claro y oscuro, están en COLORES y los escribe el layout raíz
// (`hojaDeColores`). El modo lo elige cada dispositivo con BotonTema (claro de
// partida). Por eso:
//   - Nada de "#fff" de fondo en las pantallas del personal: `C.panel`.
//   - Un color de `C` no se concatena con alfa (`${C.borde}55` no es un color).
//   - El ACCENT no está aquí: lo pone cada negocio (`negocio.tema.accent`) y es
//     un hex de verdad. Como TEXTO sobre el panel, `legible(accent)`: un marrón
//     oscuro no se lee sobre el fondo oscuro. De fondo (con texto blanco), tal cual.
//   - Lo del cliente (la página de la tienda, la tarjeta web, /privacidad) va
//     siempre en claro: lleva la clase `claro`, que vuelve a poner los de día.
//     Con los colores de su tienda, no con los de la app.
// ============================================================================

/** [claro, oscuro] de cada color de la app. */
const COLORES = {
  fondo: ["#f5f6f8", "#101216"],
  panel: ["#ffffff", "#181b20"],
  panelSuave: ["#fafbfc", "#1e2127"],
  borde: ["#e4e7ec", "#2b3038"],
  bordeFuerte: ["#cbd1d9", "#3d444f"],
  texto: ["#1b1e23", "#e9ebee"],
  suave: ["#5c6371", "#a6adb8"],
  tenue: ["#8b929e", "#7d8592"],
  ok: ["#136f3a", "#4cc38a"],
  okFondo: ["#e8f6ee", "#13281d"],
  okBorde: ["#bfe5cd", "#235238"],
  mal: ["#b42318", "#f97066"],
  malFondo: ["#fdecea", "#2e1614"],
  malBorde: ["#f7c9c3", "#5e2621"],
  // "Ojo": avisos que no son un error (fuera de horario, un límite alto, en riesgo).
  ojo: ["#c26b04", "#f0a23b"],
  ojoTexto: ["#9a5b00", "#f5bd6b"],
  ojoFondo: ["#fff6e5", "#2a2113"],
  ojoBorde: ["#f5d9a8", "#5a4419"],
  // Lo elegido en un selector de opciones (diseños, marcas) y el foco.
  azul: ["#2563eb", "#6ea2ff"],
  azulFondo: ["#eff4ff", "#18233a"],
  // El aviso flotante: oscuro de día, claro de noche, para que destaque siempre.
  toastFondo: ["#1b1e23", "#e9ebee"],
  toastTexto: ["#ffffff", "#1b1e23"],
  // El brillo de los esqueletos de carga.
  hueso: ["#eceef2", "#22262d"],
  huesoBrillo: ["#f6f7f9", "#2c313a"],
  // Cuánto se aclara el color de una tienda para leerse como texto (legible).
  aclarar: ["0%", "42%"],
};

export const C = Object.fromEntries(Object.keys(COLORES).map((k) => [k, `var(--c-${k})`]));
/** Los de día en hex, para lo que no entiende de variables CSS (el manifest de la app). */
export const CLARO = Object.fromEntries(Object.entries(COLORES).map(([k, v]) => [k, v[0]]));

const variables = (i) => Object.entries(COLORES).map(([k, v]) => `--c-${k}: ${v[i]};`).join(" ");

/**
 * Las variables, para el <style> del layout raíz. De día en :root y en `.claro`
 * (lo del cliente, siempre claro); de noche con `data-tema="oscuro"` en <html>,
 * que pone el script de TEMA_TEMPRANO antes de pintar.
 */
export const hojaDeColores = `
  :root, .claro { ${variables(0)} color-scheme: light; }
  :root[data-tema="oscuro"] { ${variables(1)} color-scheme: dark; }
  :root[data-tema="oscuro"] .claro { ${variables(0)} color-scheme: light; }
`;

/** El color de una tienda como texto sobre el panel: igual de día, más claro de noche. */
export const legible = (color) => `color-mix(in srgb, ${color}, #fff var(--c-aclarar))`;

/** Un color con transparencia, también si es una variable (`${accent}14` solo vale con un hex). */
export const tinte = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export const pagina = {
  minHeight: "100vh",
  background: C.fondo,
  color: C.texto,
  padding: "2rem 1rem 3rem",
  display: "grid",
  // Sin esto la columna crece con lo más ancho de dentro (una tabla del CRM) y
  // en el móvil TODA la página se sale por la derecha, no solo la tabla.
  gridTemplateColumns: "minmax(0, 1fr)",
  placeItems: "start center",
};

export const paginaCentrada = { ...pagina, placeItems: "center", padding: "1.5rem" };

// Lo que ve el cliente (la página de la tienda, «Todo listo») va con los colores
// de la tienda, no con el gris de la app. `acento`, lo que destaca sobre el fondo,
// es `colorDelPase(tema)`: con un diseño de kit el fondo ES el color de la tienda
// y un botón verde sobre verde no se ve. Llega de fuera porque ui.js va en todas
// las pantallas y dibujo.js pesa. Sobre un acento claro (el dorado de una
// barbería) lo que va encima, oscuro.
export const coloresDeTienda = (tema, acento) => ({
  background: tema.pageBg,
  color: tema.pageInk,
  "--acento": acento,
  "--sobre-acento": tintaClara(acento) ? "rgba(0,0,0,.84)" : "#fff",
});

// ¿Es un color claro? Tinta clara = fondo oscuro.
export function tintaClara(color) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || "").trim());
  if (!m) return false;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export const panel = {
  background: C.panel,
  border: `1px solid ${C.borde}`,
  borderRadius: 14,
  padding: 20,
};

export const titulo = { fontSize: "1.45rem", fontWeight: 650, margin: 0, letterSpacing: "-0.01em" };
export const subtitulo = { color: C.suave, fontSize: 14, margin: "4px 0 0" };
export const h2 = { fontSize: "0.95rem", fontWeight: 650, margin: "0 0 12px" };

export const etiqueta = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: C.tenue,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  margin: "14px 0 6px",
};

export const campo = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 10,
  border: `1px solid ${C.bordeFuerte}`,
  background: C.panel,
  color: C.texto,
  fontSize: 15,
};

export const botonPrimario = (accent) => ({
  padding: "0.65rem 1.15rem",
  borderRadius: 10,
  border: 0,
  background: accent,
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
});

export const botonSecundario = {
  padding: "0.65rem 1.15rem",
  borderRadius: 10,
  border: `1px solid ${C.bordeFuerte}`,
  background: C.panel,
  color: C.texto,
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
};

export const botonPequeno = { ...botonSecundario, padding: "0.4rem 0.8rem", fontSize: 13 };

// Radios: TODO lo que se pulsa (botones, pestañas, campos) lleva 10; las filas de
// lista 12; los paneles 14. Nada de píldoras sueltas al lado de botones cuadrados.
export const RADIO = { boton: 10, fila: 12, panel: 14 };

/** Pestaña (Manager / Clientes, Resumen / Grupos…): la misma en todas las pantallas. */
export const solapa = (activa, accent = C.texto) => ({
  padding: "0.5rem 0.95rem",
  borderRadius: RADIO.boton,
  border: `1px solid ${activa ? accent : C.borde}`,
  background: activa ? tinte(accent, 8) : C.panel,
  color: activa ? legible(accent) : C.texto,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

export const aviso = (ok) => ({
  padding: "10px 13px",
  borderRadius: 10,
  fontSize: 14,
  background: ok ? C.okFondo : C.malFondo,
  color: ok ? C.ok : C.mal,
  border: `1px solid ${ok ? C.okBorde : C.malBorde}`,
});

/** Chip con el código corto del pase ("K7M"): el identificador que se lee en voz alta. */
export const chipCodigo = (accent = C.texto) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 7,
  border: `1px solid ${tinte(accent, 33)}`,
  background: tinte(accent, 8),
  color: legible(accent),
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1.5,
});
