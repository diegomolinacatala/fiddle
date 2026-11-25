// ============================================================================
// ESTILO DEL PASO PROMOCIONES (clases pp-pro-)
// ----------------------------------------------------------------------------
// La escena es un contenedor de tamaño: el móvil se mide con cqw / cqh. En el
// móvil del dueño la escena es baja, así que el teléfono se enseña recortado por
// abajo (solo la parte de arriba de la pantalla de bloqueo, donde llegan los
// avisos); en escritorio entero. El aviso entra con muelle (transform y opacity); con «reducir
// movimiento», quieto.
// ============================================================================

export const cssPromos = `
.pp-pro-escena{container-type:size}
.pp-pro-lienzo{--w:min(86cqw,300px);box-sizing:border-box;position:relative;width:100%;height:100%;overflow:hidden;display:grid;justify-items:center;align-items:start}

/* ---------- el móvil ---------- */
.pp-pro-movil{position:relative;width:var(--w);height:calc(var(--w) * 2.05);padding:calc(var(--w) * .035);border-radius:calc(var(--w) * .16);
  background:linear-gradient(150deg,#3b3a35,#141410 45%,#28271f);box-shadow:0 30px 50px -26px rgba(31,24,18,.55)}
.pp-pro-pantalla{position:relative;height:100%;overflow:hidden;border-radius:calc(var(--w) * .13);color:#fff;
  background:
    radial-gradient(90% 45% at 50% 100%,color-mix(in oklab,var(--tono) 38%,transparent),transparent 70%),
    linear-gradient(170deg,#2c2219,#14100c)}
.pp-pro-isla{position:absolute;top:calc(var(--w) * .035);left:50%;width:calc(var(--w) * .3);height:calc(var(--w) * .085);
  border-radius:99px;background:#000;translate:-50% 0}
.pp-pro-hora{display:grid;justify-items:center;gap:0;padding-top:calc(var(--w) * .17);text-align:center;font-family:var(--apple)}
.pp-pro-hora small{font-size:max(12px,calc(var(--w) * .047));font-weight:560;opacity:.86}
.pp-pro-hora strong{font-size:calc(var(--w) * .19);line-height:1.05;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.pp-pro-aviso{margin:calc(var(--w) * .07) calc(var(--w) * .04) 0;animation:pp-pro-llega .65s var(--muelle) both}
.pp-pro-aviso .aviso{background:rgba(250,250,250,.95)}
.pp-pro-aviso.ejemplo .aviso{opacity:.62}
.pp-pro-barra{position:absolute;bottom:calc(var(--w) * .03);left:50%;width:34%;height:4px;border-radius:99px;background:rgba(255,255,255,.7);translate:-50% 0}
@keyframes pp-pro-llega{
  0%{opacity:0;transform:translateY(-30px) scale(.94)}
  60%{opacity:1;transform:translateY(4px) scale(1.01)}
  100%{opacity:1;transform:none}}

/* ---------- en escritorio: el móvil entero ---------- */
@media (min-width:900px){
  .pp-pro-lienzo{--w:min(calc(94cqh / 2.05),300px,60cqw);align-items:center}
}


/* ---------- el campo ---------- */
.pp-pro-cuerpo{gap:14px}
.pp-pro-campo{display:grid;gap:0}
.pp-pro-entrada{position:relative;display:block}
.pp-pro-entrada input{width:100%;height:54px;padding:0 66px 0 16px;border:0;border-radius:16px;background:#fff;color:var(--tinta);
  font:inherit;font-size:17px;font-weight:580;letter-spacing:-.015em;outline:none;box-shadow:inset 0 0 0 1px var(--linea);transition:box-shadow .25s}
.pp-pro-entrada input::placeholder{color:var(--tinta-3);opacity:.7}
.pp-pro-entrada input:focus{box-shadow:inset 0 0 0 2px var(--tinta)}
.pp-pro-cuenta{position:absolute;right:14px;top:50%;translate:0 -50%;font-size:12.5px;color:var(--tinta-3);font-variant-numeric:tabular-nums;pointer-events:none}
.pp-pro-cuenta.tope{color:#9b1c1c;font-weight:600}

/* ---------- las ideas ---------- */
.pp-pro-chips{display:flex;flex-wrap:wrap;gap:8px}
.pp-pro-chip{min-height:44px;padding:0 14px;border:0;border-radius:999px;cursor:pointer;background:#fff;color:var(--tinta-2);
  font-size:14px;font-weight:560;text-align:left;box-shadow:inset 0 0 0 1px var(--linea);transition:box-shadow .25s,transform .3s var(--muelle)}
.pp-pro-chip:active{transform:scale(.97)}
.pp-pro-chip.igual{box-shadow:inset 0 0 0 2px var(--tinta);color:var(--tinta)}
@media (hover:hover){.pp-pro-chip:hover{transform:translateY(-1px);color:var(--tinta)}}

/* ---------- sin movimiento ---------- */
.prob-quieto .pp-pro-aviso{animation:none!important}
.prob-quieto :is(.pp-pro-chip,.pp-pro-entrada input){transition:none}
@media (prefers-reduced-motion:reduce){
  .pp-pro-aviso{animation:none!important}
  :is(.pp-pro-chip,.pp-pro-entrada input){transition:none}
}
`;
