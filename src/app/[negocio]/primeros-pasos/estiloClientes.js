// ============================================================================
// ESTILO DEL PASO CLIENTES (clases pp-cli-)
// ----------------------------------------------------------------------------
// El lienzo es un contenedor de tamaño (cqw / cqh): las posiciones de los
// clientes van en % del lienzo y la escena se ve igual de bien a 320 px que en
// escritorio. Los clientes vuelan con transform; los grupos se apagan y se
// resaltan con opacity (el aro de la caja elegida es un ::after que se enciende).
// Con «reducir movimiento», todo quieto y ya ordenado.
// ============================================================================

export const cssClientes = `
.pp-cli-escena{container-type:size}
.pp-cli-lienzo{--d:max(7.2cqw,20px);container-type:size;position:relative;width:min(92cqw,168cqh,560px);aspect-ratio:16/9}

/* ---------- las cuatro cajas: aparecen cuando empieza a ordenarse ---------- */
.pp-cli-caja{position:absolute;left:var(--x);top:var(--y);width:48%;height:46%;border-radius:clamp(12px,3.2cqw,20px);
  background:rgba(255,255,255,.62);box-shadow:inset 0 0 0 1px var(--linea);opacity:0;transform:scale(.95);
  transition:opacity .5s var(--curva),transform .6s var(--curva)}
.pp-cli-caja::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
  background:color-mix(in oklab,var(--g) 9%,transparent);box-shadow:inset 0 0 0 2px var(--g);transition:opacity .3s}
.pp-cli-caja.resalta::after{opacity:1}
.pp-cli-nombre{position:absolute;left:clamp(8px,2.4cqw,14px);right:8px;top:clamp(7px,2cqw,12px);display:flex;align-items:center;gap:5px;
  min-width:0;font-size:clamp(11px,2.3cqw,14px);font-weight:620;letter-spacing:-.01em;color:var(--g)}
.pp-cli-nombre svg{flex:none}
.pp-cli-nombre span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:is(.pp-cli-orden,.pp-cli-fin) .pp-cli-caja{opacity:1;transform:none;transition-delay:calc(var(--j) * 90ms)}
:is(.pp-cli-orden,.pp-cli-fin) .pp-cli-caja.apagada{opacity:.3;transition-delay:0s}

/* ---------- los clientes ---------- */
.pp-cli-punto{position:absolute;left:0;top:0;width:var(--d);height:var(--d);
  transform:translate(calc(var(--mx) * 1cqw),calc(var(--my) * 1cqh));
  transition:transform .85s var(--curva) calc(var(--i) * 55ms),opacity .35s}
:is(.pp-cli-orden,.pp-cli-fin) .pp-cli-punto{transform:translate(calc(var(--gx) * 1cqw),calc(var(--gy) * 1cqh))}
.pp-cli-punto.apagado{opacity:.28}
.pp-cli-cuerpo-punto{position:absolute;inset:0;display:block;transition:transform .35s var(--muelle)}
.pp-cli-punto.resalta .pp-cli-cuerpo-punto{transform:scale(1.12)}
.pp-cli-cuerpo-punto b{position:absolute;inset:0;display:grid;place-items:center;border-radius:50%;
  font-size:calc(var(--d) * .36);font-weight:640;letter-spacing:.01em}
.pp-cli-base{background:var(--suave);color:#1f1812;box-shadow:inset 0 0 0 1px rgba(31,24,18,.08)}
/* El color de su grupo se enciende encima cuando ya está en su sitio. */
.pp-cli-final{background:var(--g);color:#fff;opacity:0}
:is(.pp-cli-orden,.pp-cli-fin) .pp-cli-final{opacity:1;transition:opacity .4s var(--curva) calc(var(--i) * 55ms + .5s)}
/* Mezclados, flotan un poco, cada uno a su compás. */
.pp-cli-mezcla .pp-cli-cuerpo-punto{animation:pp-cli-flota 2.2s ease-in-out infinite alternate;animation-delay:calc(var(--i) * -.37s)}
@keyframes pp-cli-flota{from{transform:translateY(-8%)}to{transform:translateY(8%)}}

/* ---------- el panel ---------- */
.pp-cli-cuerpo{gap:14px}
.pp-cli-opciones{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pp-cli-opcion{display:flex;align-items:center;gap:9px;min-width:0;min-height:46px;padding:5px 10px 5px 7px;border:0;border-radius:15px;
  cursor:pointer;background:#fff;text-align:left;font-size:14px;font-weight:580;color:var(--tinta-2);
  box-shadow:inset 0 0 0 1px var(--linea);transition:box-shadow .3s,transform .3s var(--muelle)}
.pp-cli-opcion[aria-checked="true"]{box-shadow:inset 0 0 0 2px var(--g);color:var(--tinta)}
.pp-cli-opcion:active{transform:scale(.97)}
@media (hover:hover){.pp-cli-opcion:hover{transform:translateY(-1px)}}
.pp-cli-ico{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--g);color:#fff}
.pp-cli-etiqueta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-cli-nueva{display:grid;gap:8px;animation:pp-cli-entra .35s var(--curva) both}
.pp-cli-desc{font-size:15px;line-height:1.4;color:var(--tinta)}
.pp-cli-idea{padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.4;color:var(--tinta-2);
  background:color-mix(in oklab,var(--g) 9%,#fff)}
.pp-cli-idea span{font-weight:620;color:var(--tinta)}
@keyframes pp-cli-entra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ---------- sin movimiento ---------- */
.prob-quieto :is(.pp-cli-punto,.pp-cli-caja,.pp-cli-cuerpo-punto,.pp-cli-final,.pp-cli-nueva){animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){
  :is(.pp-cli-punto,.pp-cli-caja,.pp-cli-cuerpo-punto,.pp-cli-final,.pp-cli-nueva){animation:none!important;transition:none!important}
  .pp-cli-mezcla .pp-cli-cuerpo-punto{animation:none}
}
`;
