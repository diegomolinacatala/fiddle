import { PALETA as P } from "@/app/home/paleta";

// ============================================================================
// ESTILO DEL PASO «TU TARJETA» (clases pp-tarjeta-)
// ----------------------------------------------------------------------------
// Encima de lo de la demo (rejillas, segmentos, colores, opciones: prob-*) solo
// lo que ella no tiene: el campo del premio con sus ideas en chips, y las filas
// con interruptor de «Lo que puedes añadir». El interruptor mueve la bolita con
// transform y cambia el color de la pista; con «reducir movimiento», nada se anima.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const cssTarjeta = `
/* ---------- el color: aviso si el de ahora es propio ---------- */
.pp-tarjeta-aviso{margin:0;font-size:13.5px;line-height:1.4;color:var(--tinta-2)}

/* ---------- el premio ---------- */
.pp-tarjeta-campo .prob-nombre input{height:54px;font-size:17px;padding-right:58px}
.pp-tarjeta-chips{display:flex;flex-wrap:wrap;gap:8px}
.pp-tarjeta-chip{height:44px;padding:0 16px;border:0;border-radius:999px;cursor:pointer;background:#fff;color:var(--tinta-2);
  font:inherit;font-size:14.5px;font-weight:560;box-shadow:inset 0 0 0 1px var(--linea);
  transition:box-shadow .3s,color .2s,transform .35s var(--muelle)}
.pp-tarjeta-chip[aria-pressed="true"]{color:var(--tinta);box-shadow:inset 0 0 0 2px var(--tinta)}
.pp-tarjeta-chip:active{transform:scale(.96)}
@media (hover:hover){.pp-tarjeta-chip:hover{transform:translateY(-1px);color:var(--tinta)}}

/* ---------- los extras: filas con interruptor ---------- */
.pp-tarjeta-filas{display:grid;gap:10px}
.pp-tarjeta-fila{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;width:100%;min-height:68px;
  padding:12px 14px 12px 16px;border:0;border-radius:18px;cursor:pointer;text-align:left;font:inherit;background:#fff;
  box-shadow:inset 0 0 0 1px var(--linea);transition:box-shadow .3s,transform .35s var(--muelle)}
.pp-tarjeta-fila:active{transform:scale(.985)}
.pp-tarjeta-fila[aria-checked="true"]{box-shadow:inset 0 0 0 1px var(--marca),0 10px 22px -16px ${alfa(P.espresso, 0.5)}}
.pp-tarjeta-fila-texto{display:grid;gap:3px;min-width:0}
.pp-tarjeta-fila-texto strong{font-size:15.5px;line-height:1.25;font-weight:600;color:var(--tinta)}
.pp-tarjeta-fila-texto span{font-size:13.5px;line-height:1.35;color:var(--tinta-2)}
.pp-tarjeta-pista{position:relative;flex:none;width:52px;height:32px;border-radius:99px;background:${alfa(P.espresso, 0.18)};
  transition:background-color .3s var(--curva)}
.pp-tarjeta-pista i{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;
  box-shadow:0 1px 3px ${alfa(P.espresso, 0.35)};transition:transform .35s var(--muelle)}
.pp-tarjeta-fila[aria-checked="true"] .pp-tarjeta-pista{background:var(--marca)}
.pp-tarjeta-fila[aria-checked="true"] .pp-tarjeta-pista i{transform:translateX(20px)}
.pp-tarjeta-nota{margin:2px 0 0;font-size:13.5px;line-height:1.45;color:var(--tinta-3)}

.prob-quieto :is(.pp-tarjeta-chip,.pp-tarjeta-fila,.pp-tarjeta-pista,.pp-tarjeta-pista i){transition:none}
@media (prefers-reduced-motion:reduce){
  .pp-tarjeta-chip,.pp-tarjeta-fila,.pp-tarjeta-pista,.pp-tarjeta-pista i{transition:none}
}
`;
