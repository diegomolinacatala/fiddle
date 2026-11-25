import { PALETA as P } from "@/app/home/paleta";

// ============================================================================
// ESTILO DEL PASO HORARIO (clases pp-hor-, pp-hora-, pp-tira-, pp-mini)
// ----------------------------------------------------------------------------
// Los tipos de día (con su dibujito de barras), los siete botones de los días, las
// horas con «−» y «+» (números grandes y tabulares: no bailan al cambiar) y la tira
// de la semana bajo la tarjeta. Movimiento: solo transform y opacity; las barras
// de la tira crecen con scaleX desde su sitio. Quieto, todo salta sin animar.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const cssHorario = `
/* ---------- la escena: tarjeta arriba, semana debajo ---------- */
.pp .pp-escena-horario{grid-template:minmax(0,1fr) auto/minmax(0,1fr);place-items:stretch}
.pp-escena-horario > .prob-escena{min-height:0;place-items:center}
.pp-tira{display:grid;gap:4px;width:min(300px,calc(100% - 32px));justify-self:center;margin:0 0 14px;padding:10px 12px 8px;
  border-radius:16px;background:${alfa(P.papel, 0.72)};box-shadow:inset 0 0 0 1px var(--linea);backdrop-filter:blur(8px)}
.pp-tira-filas{display:grid;gap:5px}
.pp-tira-fila,.pp-tira-eje{display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:8px}
.pp-tira-dia{font-size:11px;font-weight:600;text-align:center;color:var(--tinta-3)}
.pp-tira-fila.hoy .pp-tira-dia{color:var(--tinta);font-weight:720}
.pp-tira-pista{position:relative;height:6px;border-radius:99px;overflow:hidden;background:${alfa(P.espresso, 0.08)}}
.pp-tira-fila.hoy .pp-tira-pista{box-shadow:0 0 0 1.5px ${alfa(P.espresso, 0.32)}}
.pp-tira-pista i{position:absolute;inset:0;background:var(--tono-2);transform-origin:0 50%;
  transition:transform .5s var(--curva)}
.pp-tira-marcas{position:relative;display:block;height:12px}
.pp-tira-marcas em{position:absolute;top:0;translate:-50% 0;font-style:normal;font-size:10px;line-height:12px;color:var(--tinta-3);
  font-variant-numeric:tabular-nums}
.pp-tira-marcas em:first-child{translate:0 0}
.pp-tira-marcas em:last-child{translate:-100% 0}
@media (max-height:520px){.pp-tira{display:none}}
/* En el móvil la escena es baja: con la tira, la tarjeta quedaba diminuta y lo que se
   está enseñando es su «Abierto hasta…». La semana ya se ve en los botones del panel. */
@media (max-width:899.98px) and (orientation:portrait) and (max-height:960px){.pp-tira{display:none}}

/* ---------- los tres tipos de día ---------- */
.pp-hor{gap:14px}
.pp-hor-tipos{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pp-hor-tipos .prob-opcion{min-height:68px;padding:12px 6px 10px;align-content:space-between}
.pp-hor-tipos .prob-opcion-texto{text-align:center;line-height:1.2;text-wrap:balance}
.pp-mini{position:relative;display:block;width:100%;height:8px;border-radius:99px;overflow:hidden;background:${alfa(P.espresso, 0.09)}}
.pp-mini i{position:absolute;top:0;bottom:0;border-radius:99px;background:var(--tinta-3);transition:background-color .3s}
.prob-opcion[aria-checked="true"] .pp-mini i{background:var(--tono-2)}

/* ---------- los días ---------- */
.pp-hor-dias{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.pp-hor-dia{height:48px;padding:0;border:0;border-radius:14px;cursor:pointer;background:#fff;color:var(--tinta-2);
  box-shadow:inset 0 0 0 1px var(--linea);font-size:15px;font-weight:620;transition:background-color .25s,color .25s,transform .3s var(--muelle)}
.pp-hor-dia[aria-pressed="true"]{background:var(--tinta);color:${P.papel};box-shadow:none}
.pp-hor-dia:active{transform:scale(.94)}
@media (hover:hover){.pp-hor-dia[aria-pressed="false"]:hover{color:var(--tinta);box-shadow:inset 0 0 0 1.5px var(--tinta-3)}}

/* ---------- las horas ---------- */
.pp-hor-horas{display:grid;gap:14px}
.pp-hor-tramo{display:grid;gap:6px}
.pp-hor-tramo-nombre{margin:0;font-size:12.5px;font-weight:600;color:var(--tinta-3)}
.pp-hora-fila{display:grid;grid-template-columns:minmax(0,1fr) 44px 84px 44px;align-items:center;gap:6px}
.pp-hora-et{font-size:15px;font-weight:560;color:var(--tinta-2)}
.pp-hora-valor{display:block;text-align:center;font-size:24px;font-weight:660;letter-spacing:-.02em;color:var(--tinta);
  font-variant-numeric:tabular-nums}
.pp-hora-boton{display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:50%;cursor:pointer;
  background:#fff;color:var(--tinta);box-shadow:inset 0 0 0 1px var(--linea);transition:transform .3s var(--muelle),opacity .2s}
.pp-hora-boton:active:not(:disabled){transform:scale(.9)}
.pp-hora-boton:disabled{opacity:.35;cursor:default}
@media (hover:hover){.pp-hora-boton:hover:not(:disabled){box-shadow:inset 0 0 0 1.5px var(--tinta)}}

.pp-hor-nota{margin:0;font-size:13px;line-height:1.4;color:var(--tinta-3)}

/* ---------- el resumen de un horario que ya existe ---------- */
.pp-hor-resumen{display:grid;gap:10px;justify-items:start;padding:16px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1px var(--linea)}
.pp-hor-resumen-et{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--marca)}
.pp-hor-resumen-texto{margin:0;font-size:17px;line-height:1.35;font-weight:600;color:var(--tinta);font-variant-numeric:tabular-nums}
.pp-hor-sec{height:44px;padding:0 18px;border:0;border-radius:999px;cursor:pointer;background:${alfa(P.espresso, 0.07)};
  font:inherit;font-size:14.5px;font-weight:600;color:var(--tinta);transition:background-color .2s,transform .3s var(--muelle)}
.pp-hor-sec:active{transform:scale(.97)}
@media (hover:hover){.pp-hor-sec:hover{background:${alfa(P.espresso, 0.12)}}}

/* ---------- quieto ---------- */
.prob-quieto .pp-tira-pista i,.prob-quieto .pp-mini i,.prob-quieto .pp-hor-dia,.prob-quieto .pp-hora-boton,.prob-quieto .pp-hor-sec{transition:none}
@media (prefers-reduced-motion:reduce){
  .pp-tira-pista i,.pp-mini i,.pp-hor-dia,.pp-hora-boton,.pp-hor-sec{transition:none}
}
@media (max-width:359px){
  .pp-hora-fila{grid-template-columns:minmax(0,1fr) 44px 70px 44px}
  .pp-hora-valor{font-size:22px}
}
`;
