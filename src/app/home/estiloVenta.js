import { PALETA as P } from "./paleta";
import { CONSULTA_MOVIL } from "./consultaMovil";

// ============================================================================
// LO QUE EMPUJA HACIA LA DEMO EN LA WEB (/home)
// ----------------------------------------------------------------------------
// Va después de estilo.js y estiloMovil.js y solo retoca lo que hace falta para
// que la mirada vaya a una sola acción:
// - Portada: «Prueba la demo» es el botón grande y con sombra; WhatsApp, al
//   lado y callado.
// - Cabecera: en pantalla ancha, la píldora verde (.entrar, la de siempre) es
//   «Prueba la demo» y «Entrar» pasa a ser texto. En el móvil la píldora no
//   cabe junto al logo: ahí se queda «Entrar» de texto, y la acción la llevan la
//   portada y la barra de abajo (BarraMovil).
// - Al final, antes de quiénes somos, una invitación corta (.invita).
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const cssVenta = `
/* ---------- cabecera ---------- */
.cabecera-entrar{display:inline-flex;align-items:center;min-height:44px;padding:0 6px;font-size:14.5px;font-weight:600;
  color:var(--tinta);text-decoration:none;white-space:nowrap;border-radius:10px}
@media (hover:hover){.cabecera-entrar:hover{color:var(--marca)}}

/* ---------- portada ---------- */
.venta-principal{min-height:58px;padding:0 30px;font-size:17px;
  box-shadow:0 14px 30px -14px ${alfa(P.verde, 0.75)},0 2px 6px ${alfa(P.verde, 0.18)}}
.venta-principal .flecha{transition:transform .3s var(--curva)}
@media (hover:hover){
  .venta-principal:hover{background:var(--marca-encima)}
  .venta-principal:hover .flecha{transform:translateX(3px)}
}
.venta-hablar{min-height:58px;color:var(--tinta-2)}
.venta-nota{font-size:14px;color:var(--tinta-3)}

/* ---------- la portada, entera en la primera pantalla ----------
   En pantalla ancha la portada es UNA vista: ocupa lo que queda bajo la cabecera y
   nada se corta. El titular se limita también por el alto (svh) y el teléfono
   (unos 740 px con su pie) se encoge por escalones de alto con zoom, que encoge
   también su caja y no deja huecos. */
@media (min-width:960px){
  .portada{min-height:calc(100svh - 64px);padding-top:clamp(16px,3svh,40px);padding-bottom:clamp(16px,3svh,40px);gap:clamp(32px,4vw,64px)}
  .titular{font-size:clamp(44px,min(1.3rem + 5.8vw,10.5svh),86px)}
  .portada-texto{gap:clamp(14px,2.4svh,22px)}
  .portada-texto .entradilla{font-size:clamp(16px,min(.95rem + .4vw,2.4svh),21px)}
}
@media (min-width:960px) and (max-height:900px){.portada-visual .movil{zoom:.9}}
@media (min-width:960px) and (max-height:820px){.portada-visual .movil{zoom:.8}}
@media (min-width:960px) and (max-height:740px){.portada-visual .movil{zoom:.7}}
@media (min-width:960px) and (max-height:660px){.portada-visual .movil{zoom:.6}}

/* Al entrar, el texto de la portada llega por partes: primero qué es, luego la
   promesa, luego qué hacer. Solo al cargar, corto, y nada si se pide quietud. */
@media (prefers-reduced-motion:no-preference){
  .portada-texto > *{animation:venta-entra .7s cubic-bezier(.16,1,.3,1) both}
  .portada-texto > :nth-child(2){animation-delay:.08s}
  .portada-texto > :nth-child(3){animation-delay:.18s}
  .portada-texto > :nth-child(4){animation-delay:.28s}
  .portada-texto > :nth-child(5){animation-delay:.36s}
}
@keyframes venta-entra{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}

/* ---------- la invitación del final ---------- */
.invita{display:grid;justify-items:center;gap:22px;max-width:var(--ancho);margin:0 auto;
  padding:clamp(28px,4vw,48px) var(--margen) clamp(72px,9vw,112px);text-align:center}
.invita-titulo{font-size:clamp(28px,1.1rem + 2.2vw,42px);line-height:1.05;font-weight:660;letter-spacing:-.04em;text-wrap:balance}

@media ${CONSULTA_MOVIL}{
  .cabecera .entrar{display:none}
  .cabecera-entrar{margin-left:auto}
  .venta-principal,.venta-hablar{min-height:54px}
}
`;
