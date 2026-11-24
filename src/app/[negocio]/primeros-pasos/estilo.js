import { PALETA as P } from "@/app/home/paleta";

// ============================================================================
// ESTILO DE LOS PRIMEROS PASOS (clases pp-)
// ----------------------------------------------------------------------------
// Encima de la demo de la web (home/tarjeta/estilo.js y home/experiencia/estilo.js:
// `.prob-pagina` es la escena + el panel, `.exp-` el panel con un paso). Aquí solo
// lo que añaden los primeros pasos: los cinco tramos del progreso, el «Ahora no»,
// el error junto al botón y la pantalla del final. Lo de cada paso, en su
// estiloX.js. Movimiento: solo transform y opacity; con «reducir movimiento», nada.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const cssPrimerosPasos = `
/* Solo para el lector de pantalla. */
.sr-solo{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---------- el progreso: cinco tramos ---------- */
.pp-tramos{flex:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:0;padding:0;list-style:none}
.pp-tramo{height:4px;border-radius:99px;overflow:hidden;background:${alfa(P.espresso, 0.1)}}
.pp-tramo i{display:block;width:100%;height:100%;background:var(--tinta);transform-origin:0 50%;transition:transform .5s var(--curva)}
.pp-tramo.hecho i{background:var(--marca)}
.pp-progreso .exp-pasos{display:grid;justify-items:end;color:var(--tinta-3)}
.pp-progreso .exp-pasos svg{color:var(--marca)}

/* ---------- los botones de abajo ---------- */
.pp-ahora-no{justify-self:center;height:44px;padding:0 14px;border:0;border-radius:999px;background:none;cursor:pointer;
  font:inherit;font-size:14.5px;font-weight:560;color:var(--tinta-2);transition:background-color .2s,transform .2s var(--muelle)}
.pp-ahora-no:active{transform:scale(.97)}
@media (hover:hover){.pp-ahora-no:hover{background:${alfa(P.espresso, 0.06)};color:var(--tinta)}}
.pp-error{margin:0;padding:10px 14px;border-radius:14px;background:#fdeceb;color:#9b1c1c;font-size:14px;line-height:1.35}
.pp .exp-accion{gap:4px}
.pp .exp-principal{margin-top:2px}

/* ---------- la escena de cada paso ---------- */
.pp-escena{z-index:1}
/* La escena de la tarjeta (Escena.js) dentro de la del paso: que la llene entera, sin
   repetir el hueco de la cabecera, o mide lo que ocupa la tarjeta y se agranda sola. */
.pp-escena > .prob-escena{place-self:stretch;width:100%;height:100%;min-height:0;padding-top:0}
/* La cabecera no es un enlace: el logo es solo marca. */
.pp .prob-volver{cursor:default}

/* ---------- listo ---------- */
.pp-listo{gap:14px}
.pp-lista{display:grid;gap:2px;margin:0;padding:0;list-style:none}
.pp-lista li{display:flex;align-items:center;gap:12px;min-height:48px;padding:4px 0;border-bottom:1px solid var(--linea)}
.pp-lista li:last-child{border-bottom:0}
.pp-marca{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;
  background:${alfa(P.espresso, 0.08)};color:var(--tinta-3)}
.pp-lista li.hecho .pp-marca{background:var(--marca);color:${P.papel}}
.pp-lista-nombre{flex:1;font-size:15.5px;font-weight:560;color:var(--tinta)}
.pp-lista li:not(.hecho) .pp-lista-nombre{color:var(--tinta-2)}
.pp-volver{height:40px;padding:0 12px;border:0;border-radius:999px;background:none;cursor:pointer;font:inherit;font-size:14px;
  font-weight:600;color:var(--marca);transition:background-color .2s,transform .2s var(--muelle)}
.pp-volver:active{transform:scale(.97)}
@media (hover:hover){.pp-volver:hover{background:${alfa(P.verde, 0.08)}}}
.pp-escena-listo .prob-escena{pointer-events:none}
.pp-onda{position:absolute;left:50%;top:50%;width:min(70vmin,560px);aspect-ratio:1;border-radius:50%;translate:-50% -50%;
  pointer-events:none;border:2px solid var(--tono);opacity:0;animation:pp-onda 2.4s var(--curva) .25s 2 both}
.pp-onda + .pp-onda{animation-delay:.85s}
@keyframes pp-onda{from{opacity:.55;transform:scale(.55)}to{opacity:0;transform:scale(1.15)}}
.prob-quieto .pp-onda{display:none}
@media (prefers-reduced-motion:reduce){.pp-onda{display:none}.pp-tramo i{transition:none}}
.prob-quieto .pp-tramo i{transition:none}
`;
