import { PALETA as P } from "../paleta";

// ============================================================================
// ESTILO DE LA PANTALLA FINAL (Final.js)
// ----------------------------------------------------------------------------
// Su tarjeta sobre un halo teñido con SU color (--fin-tono, lo pone Final.js),
// un poco girada y con una segunda hoja detrás para que tenga cuerpo. Solo se
// anima transform y opacidad; con «reducir movimiento», nada.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const cssFinal = `
/* ---------- cabecera mínima ---------- */
.fin-cabecera{max-width:var(--ancho);margin:0 auto;display:flex;align-items:center;justify-content:space-between;
  gap:12px;padding:max(8px,env(safe-area-inset-top)) var(--margen) 0;min-height:64px}
.fin-marca{display:flex;align-items:center;min-height:44px;border-radius:10px;text-decoration:none}
.fin-entrar{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;font-size:14.5px;font-weight:500;
  color:var(--tinta-2);text-decoration:none;transition:color .2s}
@media (hover:hover){.fin-entrar:hover{color:var(--tinta)}}

/* ---------- su tarjeta y el estado ---------- */
.fin-estado{max-width:var(--ancho);margin:0 auto;padding:clamp(12px,3vw,32px) var(--margen) clamp(36px,6vw,72px);
  display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(20px,4vw,32px);align-items:center;justify-items:center;text-align:center}
@media (min-width:760px){
  .fin-estado{grid-template-columns:auto minmax(0,1fr);gap:clamp(40px,6vw,88px);justify-items:start;text-align:left;
    max-width:min(880px,100%)}
}
.fin-escena{position:relative;display:grid;place-items:center;padding:clamp(8px,2vw,20px);min-width:0}
.fin-halo{position:absolute;inset:0;margin:auto;width:min(340px,100%);aspect-ratio:1;border-radius:50%;
  background:radial-gradient(closest-side,color-mix(in srgb,var(--fin-tono) 62%,transparent),transparent 100%);
  opacity:.8;pointer-events:none}
.fin-tarjeta{position:relative;width:200px;max-width:100%;transform:rotate(-3deg);transform-origin:50% 60%;
  filter:drop-shadow(0 26px 24px ${alfa(P.espresso, 0.24)}) drop-shadow(0 5px 7px ${alfa(P.espresso, 0.16)})}
.fin-tarjeta::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:20px;background:var(--fin-tono);
  opacity:.55;transform:translate(12px,9px) rotate(6deg)}
.fin-tarjeta article{box-shadow:none!important}
@media (min-width:760px){.fin-tarjeta{width:260px}}
.fin-texto{display:grid;gap:14px;min-width:0;justify-items:center}
@media (min-width:760px){.fin-texto{justify-items:start}}
.fin-texto .entradilla{max-width:26em}
.fin-texto .boton{margin-top:6px}
.fin-titulo{font-size:clamp(32px,1.2rem + 2.6vw,48px)}
.fin-titulo:focus-visible{outline:none}
.fin-sello{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--marca);color:${P.papel}}
@media (prefers-reduced-motion:no-preference){
  .fin-texto{animation:fin-entra .5s var(--curva)}
  @keyframes fin-entra{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
}

/* ---------- los precios ---------- */
.fin-precios{max-width:var(--ancho);margin:0 auto;padding:clamp(20px,4vw,40px) var(--margen) clamp(40px,6vw,72px)}
.fin-titulo-precios{font-size:clamp(30px,1.2rem + 2.2vw,44px)}

/* ---------- una línea final ---------- */
.fin-pie{max-width:var(--ancho);margin:0 auto;display:grid;gap:6px;justify-items:center;text-align:center;
  padding:8px var(--margen) max(32px,env(safe-area-inset-bottom));color:var(--tinta-2)}
.fin-pie a{display:inline-flex;align-items:center;min-height:44px;color:var(--marca);font-weight:600;
  text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}
.fin-letra{font-size:13.5px;color:var(--tinta-3);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:0 14px}
.fin-letra a{font-weight:500;color:var(--tinta-3)}
@media (hover:hover){.fin-pie a:hover{color:var(--marca-encima)}}
`;
