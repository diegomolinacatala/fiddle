// ============================================================================
// ESTILO DE LA APP (claro)
// ----------------------------------------------------------------------------
// Antes cada pantalla repetía sus propios colores oscuros en constantes sueltas.
// Aquí viven una sola vez: colores + los trozos que se repiten (página, panel,
// etiqueta, campo, botón). Las pantallas los importan y componen con `...`.
//
// El ACCENT no está aquí: lo pone cada negocio (`negocio.tema.accent`), que es
// lo único que debe cambiar de una tienda a otra.
// ============================================================================

export const C = {
  fondo: "#f5f6f8",
  panel: "#ffffff",
  panelSuave: "#fafbfc",
  borde: "#e4e7ec",
  bordeFuerte: "#cbd1d9",
  texto: "#1b1e23",
  suave: "#5c6371",
  tenue: "#8b929e",
  ok: "#136f3a",
  okFondo: "#e8f6ee",
  mal: "#b42318",
  malFondo: "#fdecea",
};

export const pagina = {
  minHeight: "100vh",
  background: C.fondo,
  color: C.texto,
  padding: "2rem 1rem 3rem",
  display: "grid",
  placeItems: "start center",
};

export const paginaCentrada = { ...pagina, placeItems: "center", padding: "1.5rem" };

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
  background: "#fff",
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
  background: "#fff",
  color: C.texto,
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
};

export const botonPequeno = { ...botonSecundario, padding: "0.4rem 0.8rem", fontSize: 13 };

export const aviso = (ok) => ({
  padding: "10px 13px",
  borderRadius: 10,
  fontSize: 14,
  background: ok ? C.okFondo : C.malFondo,
  color: ok ? C.ok : C.mal,
  border: `1px solid ${ok ? "#bfe5cd" : "#f7c9c3"}`,
});

/** Chip con el código corto del pase ("K7M"): el identificador que se lee en voz alta. */
export const chipCodigo = (accent = C.texto) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 7,
  border: `1px solid ${accent}55`,
  background: `${accent}14`,
  color: accent,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1.5,
});
