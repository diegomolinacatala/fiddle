import { C, pagina, panel, RADIO } from "@/app/ui";

// ============================================================================
// ESQUELETOS DE CARGA
// ----------------------------------------------------------------------------
// Lo que enseña cada loading.js mientras el servidor lee la base: la FORMA de
// la página que viene (cabecera, pestañas, paneles) en gris, con un brillo que
// pasa. Se ve al instante al navegar, y la página real entra en su sitio sin
// saltos. Con `prefers-reduced-motion`, quieto.
// ============================================================================

const css = `
@keyframes esqueleto-brillo { from { background-position: 150% 0 } to { background-position: -50% 0 } }
.esq { background: linear-gradient(90deg, ${C.hueso} 0%, ${C.huesoBrillo} 40%, ${C.hueso} 80%); background-size: 200% 100%;
  animation: esqueleto-brillo 1.3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .esq { animation: none } }
`;

/** Un bloque gris del tamaño dado. */
export function Hueso({ w = "100%", h = 14, r = 6, style }) {
  return <div className="esq" aria-hidden style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Panel con un título y unas líneas: la pieza con la que se arma cada pantalla. */
export function PanelHueso({ lineas = 4, alto = null }) {
  return (
    <div style={panel}>
      <Hueso w="40%" h={14} style={{ marginBottom: 16 }} />
      {alto
        ? <Hueso h={alto} r={RADIO.fila} />
        : Array.from({ length: lineas }, (_, i) => <Hueso key={i} h={38} r={RADIO.boton} style={{ marginBottom: 10 }} />)}
    </div>
  );
}

/**
 * Lo de dentro de una pantalla del dueño. La cabecera (marca, nombre, pestañas)
 * NO va aquí: es del layout ([negocio]/MarcoGestion.js) y se queda puesta
 * mientras carga. `margen`: 0 si lo primero son unas Solapas, que traen el suyo.
 */
export function EsqueletoGestion({ children, margen = 20 }) {
  return (
    <div aria-busy="true" aria-label="Cargando" style={{ marginTop: margen }}>
      <style>{css}</style>
      {children}
    </div>
  );
}

/** Ficha de un cliente en la caja: código, banda y botones. */
export function EsqueletoCaja() {
  return (
    <main style={pagina} aria-busy="true" aria-label="Cargando">
      <style>{css}</style>
      <div style={{ width: "min(430px, 100%)" }}>
        <Hueso w={140} h={16} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 16px" }}>
          <Hueso w={62} h={34} r={7} />
          <div style={{ flex: 1 }}>
            <Hueso w="50%" h={18} style={{ marginBottom: 6 }} />
            <Hueso w="30%" h={12} />
          </div>
        </div>
        <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
          <Hueso h={150} r={0} />
          <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between" }}>
            <Hueso w="55%" h={16} />
            <Hueso w={40} h={20} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Hueso h={76} r={RADIO.fila} />
          <Hueso h={76} r={RADIO.fila} />
        </div>
      </div>
    </main>
  );
}
