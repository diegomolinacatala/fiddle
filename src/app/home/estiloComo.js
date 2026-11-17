import { PALETA as P } from "./paleta";
import { CONSULTA_MOVIL } from "./consultaMovil";

// ============================================================================
// ESTILO DE «CÓMO FUNCIONA» (ComoFunciona.js)
// ----------------------------------------------------------------------------
// Bento de 6 columnas: 4+2 arriba y 2+4 abajo, así ninguna fila repite el ritmo.
// Cada pieza lleva su tinte (los de los pasos de antes) y la del panel, el verde de
// la marca, de contrapunto: es lo único que ve el dueño y no el cliente.
// En el móvil, una fila que se desliza con sus puntos (Indicador.js); las
// entradas con el scroll no van dentro de una fila que se mueve de lado.
// Se concatena DESPUÉS de estilo.js y estiloMovil.js; reutiliza .cartel, .caja*,
// .aviso* y .montaje de estilo.js.
// ============================================================================

export const cssComo = `
.cf-rejilla{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px}
.cf-pieza{display:grid;align-content:space-between;gap:28px;min-width:0;padding:clamp(24px,3vw,36px);border-radius:32px;
  box-shadow:0 0 0 1px var(--linea);overflow:hidden}
.cf-ancha{grid-column:span 4;grid-template-columns:minmax(0,1fr) minmax(0,auto);align-items:center}
.cf-estrecha{grid-column:span 2}
.cf-verde-claro{background:linear-gradient(160deg,${P.verdeClaro},${P.verdeHondo})}
.cf-camel{background:linear-gradient(160deg,${P.camelClaro},${P.camelHondo})}
.cf-avena{background:linear-gradient(160deg,${P.avenaClara},${P.avenaHonda})}
.cf-verde{background:var(--marca);box-shadow:none;align-items:stretch;grid-template-columns:minmax(0,1fr)}

.cf-texto{display:grid;gap:8px;align-content:start}
.cf-dato{font-size:13px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--marca)}
.cf-verde .cf-dato{color:var(--avena)}
.cf-texto h3{font-size:clamp(26px,1.1rem + 1.2vw,36px);line-height:1.08;font-weight:660;letter-spacing:-.04em;text-wrap:balance}
.cf-texto p{max-width:22em;color:var(--tinta-2);line-height:1.5;text-wrap:pretty}
.cf-verde .cf-texto p{color:var(--claro-2)}

.cf-visual{display:grid;place-items:center}
.cf-ancha .cf-visual{padding-right:clamp(0px,2vw,24px)}
.cf-avisos{display:grid;gap:8px;width:min(272px,100%);margin:0 auto}
.cf-estrecha .caja{width:min(236px,100%)}

/* Las cifras del panel, sin cajas: números grandes sobre el verde y una raya entre ellos. */
.cf-cifras{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0}
.cf-cifras > div{display:grid;gap:6px;padding:0 clamp(12px,2vw,28px);border-left:1px solid var(--claro-linea)}
.cf-cifras > div:first-child{padding-left:0;border-left:0}
.cf-cifras dt{font-size:13px;font-weight:600;line-height:1.25;color:var(--claro-2)}
.cf-cifras dd{margin:0;font-size:clamp(40px,1.6rem + 2.6vw,68px);line-height:1;font-weight:660;letter-spacing:-.05em;
  font-variant-numeric:tabular-nums;color:var(--claro)}

/* El montaje y la invitación a probar: una fila, la invitación sin caja a propósito. */
.cf-pie{display:grid;grid-template-columns:minmax(0,1fr);gap:12px 28px;margin-top:18px;align-items:center}
.cf-pie .montaje{margin-top:0}
.cf-prueba{display:inline-flex;align-items:center;gap:8px;min-height:44px;justify-self:start;padding:0 4px;
  font-size:17px;font-weight:620;letter-spacing:-.015em;color:var(--marca);text-decoration:underline;
  text-decoration-thickness:1px;text-underline-offset:5px}
.cf-prueba .flecha{margin-left:0;opacity:1;transition:translate .3s var(--curva)}
@media (hover:hover){.cf-prueba:hover .flecha{translate:4px 0}}
@media (min-width:900px){.cf-pie{grid-template-columns:minmax(0,1fr) auto}}

@media ${CONSULTA_MOVIL}{
  .cf-rejilla{display:flex;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;position:relative;
    margin:0 calc(-1 * var(--margen));padding:4px var(--margen) 30px;scroll-padding-inline:var(--margen);scrollbar-width:none}
  .cf-rejilla::-webkit-scrollbar{display:none}
  .cf-pieza,.cf-ancha{flex:0 0 min(86%,380px);scroll-snap-align:start;scroll-snap-stop:always;display:grid;grid-template-columns:minmax(0,1fr);
    align-content:space-between;padding:24px;gap:24px;border-radius:28px}
  .cf-visual{min-height:200px}
  .cf-rejilla .revela{animation:none}
  .cf-cifras{grid-template-columns:minmax(0,1fr);gap:14px}
  .cf-cifras > div{grid-template-columns:minmax(0,1fr) auto;align-items:baseline;padding:14px 0 0;border-left:0;border-top:1px solid var(--claro-linea)}
  .cf-cifras > div:first-child{padding-top:0;border-top:0}
  .cf-cifras dd{font-size:40px}
  .cf-pie{margin-top:0}
}
@media (prefers-reduced-motion:reduce){.cf-prueba .flecha{transition:none}}
`;
