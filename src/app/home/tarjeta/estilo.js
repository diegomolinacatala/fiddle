import { PALETA as P } from "../paleta";

// ============================================================================
// ESTILO DE «DISEÑA TU TARJETA»
// ----------------------------------------------------------------------------
// Los colores de fiddle (paleta.js) para todo lo de alrededor; el fondo de la
// escena se tiñe con el color de la tarjeta elegida (`--tono`, registrado con
// @property para que el cambio se funda y no salte).
//
// Pantalla ancha: la escena a la izquierda y el panel de cristal a la derecha.
// Móvil: la escena arriba y el panel como una hoja abajo.
//
// Movimiento: la inclinación la escribe Probador.js en cada fotograma; aquí
// solo las transiciones (la cámara, las capas que se funden, el panel). Con
// «reducir movimiento» (.prob-quieto y la media query), nada se anima.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const css = `
@property --tono{syntax:"<color>";inherits:true;initial-value:${P.camel}}
@property --tono-2{syntax:"<color>";inherits:true;initial-value:${P.crema}}
body:has(.prob){background:${P.papel};overflow:hidden}
.prob{
  --papel:${P.papel}; --tinta:${P.espresso}; --tinta-2:${P.vison}; --tinta-3:${P.tintaSuave}; --marca:${P.verde};
  --marca-encima:${P.verdeEncima}; --linea:${alfa(P.espresso, 0.1)}; --curva:cubic-bezier(.16,1,.3,1);
  --muelle:cubic-bezier(.34,1.32,.5,1);
  position:fixed; inset:0; display:flex; flex-direction:column; overflow:hidden;
  background:var(--papel); color:var(--tinta); color-scheme:light;
  font-family:var(--fuente-web),system-ui,-apple-system,"Segoe UI",sans-serif; font-size:16px; line-height:1.45;
  -webkit-font-smoothing:antialiased; -webkit-text-size-adjust:100%;
  transition:--tono .9s var(--curva),--tono-2 .9s var(--curva);
}
.prob *,.prob *::before,.prob *::after{box-sizing:border-box}
.prob :where(h1,h2,p){margin:0}
:where(.prob) button{font:inherit;color:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.prob a{-webkit-tap-highlight-color:transparent}
.prob :focus-visible{outline:2px solid var(--tinta);outline-offset:3px}
.prob-oculto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ---------- arriba ---------- */
.prob-arriba{position:absolute;z-index:5!important;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:max(14px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 0 max(18px,env(safe-area-inset-left));pointer-events:none}
.prob-arriba > *{pointer-events:auto}
.prob-volver{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 16px 0 12px;border-radius:999px;
  color:var(--tinta);text-decoration:none;background:${alfa(P.superficie, 0.6)};
  -webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);
  box-shadow:inset 0 0 0 1px var(--linea);transition:background-color .2s}
@media (hover:hover){
  .prob-volver:hover{background:${alfa(P.superficie, 0.9)}}
}

/* ---------- la escena ---------- */
.prob-escena{position:relative;flex:1;min-height:0;display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);place-items:center;perspective:1300px;
  touch-action:none;user-select:none;-webkit-user-select:none;isolation:isolate}
/* El halo cubre toda la página (si no, se le ve el borde junto al panel) y se
   centra en la escena: --cx/--cy cambian con la disposición. */
.prob-halo{position:absolute;inset:0;z-index:0;pointer-events:none;--cx:50%;--cy:38%;
  background:
    radial-gradient(ellipse 34% 40% at var(--cx) var(--cy),color-mix(in oklab,var(--tono) 30%,transparent),transparent 72%),
    radial-gradient(ellipse 70% 80% at var(--cx) var(--cy),color-mix(in oklab,var(--tono-2) 20%,var(--papel)),var(--papel) 80%)}
.prob-arriba,.prob-escena{z-index:1}
.prob-inclina{position:relative;will-change:transform;transform-style:preserve-3d}
.prob-zoom{transition:transform 1s var(--curva);will-change:transform}
/* Pintada al doble (RESOLUCION en Probador.js): la cámara la encoge y, al acercarse, no se ve borrosa. */
.prob-tarjeta{position:relative;width:360px;zoom:2;transform-origin:50% 50%}
/* La sombra de la tarjeta va una sola vez, en .prob-capas: cada capa con la suya se sumaban. */
.prob-tarjeta article{box-shadow:none!important;transition:none}
.prob-tarjeta [data-parte]{cursor:pointer}
.prob-capas{display:grid;border-radius:13px;box-shadow:0 22px 44px -18px rgba(0,0,0,.45),0 4px 14px rgba(0,0,0,.1)}
.prob-capa{grid-area:1/1;min-width:0}
.prob-capa.entra{animation:prob-funde .48s var(--curva) both}
@keyframes prob-funde{from{opacity:0}to{opacity:1}}
/* La sombra va al revés de la inclinación: la luz viene de delante. */
.prob-sombra{position:absolute;inset:12% 8% -4%;z-index:-1;border-radius:40px;pointer-events:none;
  background:color-mix(in oklab,var(--tono) 45%,${P.espresso});opacity:.42;filter:blur(30px);
  transform:translate3d(var(--sx,0px),calc(var(--sy,0px) + 26px),0)}
.prob-brillo{position:absolute;inset:0;border-radius:13px;pointer-events:none;mix-blend-mode:soft-light;opacity:var(--brillo,.6);
  background:
    radial-gradient(circle at var(--bx,50%) var(--by,38%),rgba(255,255,255,.55),rgba(255,255,255,0) 46%),
    linear-gradient(115deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.18) 48%,rgba(255,255,255,0) 62%)}

/* ---------- el panel ---------- */
.prob-panel{position:relative;z-index:4;display:flex;flex-direction:column;min-height:0;
  background:${alfa(P.superficie, 0.78)};-webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%);
  box-shadow:inset 0 0 0 1px ${alfa(P.espresso, 0.07)},0 30px 60px -30px ${alfa(P.espresso, 0.35)}}
.prob-solapas{position:relative;margin:14px 14px 0;padding:4px;border-radius:999px;background:${alfa(P.espresso, 0.055)}}
.prob-solapas-fila{position:relative;z-index:1;display:grid;grid-auto-flow:column;grid-auto-columns:1fr}
.prob-solapas-fila button{height:38px;padding:0 6px;border:0;border-radius:999px;background:none;cursor:pointer;
  font-size:14px;font-weight:560;color:var(--tinta-2);letter-spacing:-.01em;transition:color .3s}
.prob-solapas-fila button[aria-selected="true"]{color:var(--tinta)}
.prob-pildora{position:absolute;top:4px;left:4px;height:38px;border-radius:999px;background:#fff;
  box-shadow:0 1px 2px ${alfa(P.espresso, 0.1)},0 6px 16px -8px ${alfa(P.espresso, 0.3)};
  transition:transform .55s var(--muelle),width .55s var(--muelle)}
.prob-marco{position:relative;flex:1;min-height:0;overflow:hidden auto;overscroll-behavior:contain;scrollbar-width:thin}
.prob-seccion{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;padding:22px 22px 18px}
.prob-seccion.desde-dcha{animation:prob-entra-d .5s var(--curva) both}
.prob-seccion.desde-izda{animation:prob-entra-i .5s var(--curva) both}
@keyframes prob-entra-d{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
@keyframes prob-entra-i{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
.prob-cabeza{display:grid;gap:4px}
.prob-cabeza h1{font-size:28px;line-height:1.1;font-weight:660;letter-spacing:-.035em}
.prob-cabeza p{font-size:15px;color:var(--tinta-2)}
.prob-grupo{display:grid;gap:10px}
.prob-grupo h2{font-size:13px;font-weight:600;color:var(--tinta-3);letter-spacing:.01em}

/* los colores: un rectángulo que se desliza bajo un marco fijo */
.prob-colores{position:relative}
.prob-colores-fila{position:relative;display:flex;height:92px;overflow-x:auto;border-radius:18px;scroll-snap-type:x mandatory;scrollbar-width:none;cursor:grab}
.prob-colores-fila::-webkit-scrollbar{display:none}
.prob-colores-fila.arrastrando{scroll-snap-type:none;cursor:grabbing}
.prob-colores-fila.sin-iman{scroll-snap-type:none}
.prob-muestra{flex:none;width:72px;padding:0;border:0;border-radius:0;cursor:inherit;scroll-snap-align:center;background:var(--fondo)}
.prob .prob-muestra:focus-visible{outline:2px solid #fff;outline-offset:-8px}
.prob-colores-marco{position:absolute;top:-5px;bottom:-5px;left:calc(50% - 39px);width:78px;border-radius:16px;border:3px solid #fff;pointer-events:none;
  box-shadow:0 0 0 1px ${alfa(P.espresso, 0.3)},0 10px 22px -10px ${alfa(P.espresso, 0.6)}}

/* uno o dos premios: la tarjeta de verdad, en pequeño */
.prob-cuantas{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.prob-foto{display:block;width:360px;zoom:.42;pointer-events:none;text-align:left}
.prob-foto article{box-shadow:none!important}

/* segmentos con píldora que se desliza */
.prob-segmentos{position:relative;display:grid;grid-template-columns:repeat(var(--n),1fr);padding:4px;border-radius:14px;
  background:${alfa(P.espresso, 0.055)}}
.prob-segmentos button{position:relative;z-index:1;height:38px;border:0;background:none;border-radius:10px;cursor:pointer;
  font-size:14.5px;font-weight:560;color:var(--tinta-2);transition:color .25s}
.prob-segmentos button[aria-checked="true"]{color:var(--tinta)}
.prob-segmentos-pildora{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px) / var(--n));border-radius:10px;background:#fff;
  box-shadow:0 1px 2px ${alfa(P.espresso, 0.1)},0 6px 14px -8px ${alfa(P.espresso, 0.3)};
  transform:translateX(calc(var(--i) * 100%));transition:transform .5s var(--muelle)}

/* opciones en rejilla (iconos, formas de contar) */
.prob-rejilla{display:grid;gap:10px}
.prob-iconos{grid-template-columns:repeat(4,1fr)}
.prob-modos{grid-template-columns:repeat(2,1fr)}
.prob-opcion{display:grid;justify-items:center;align-content:start;gap:8px;padding:10px 8px;border:0;border-radius:18px;cursor:pointer;
  background:#fff;box-shadow:inset 0 0 0 1px var(--linea);transition:box-shadow .3s,transform .35s var(--muelle)}
.prob-opcion[aria-checked="true"]{box-shadow:inset 0 0 0 2px var(--tinta),0 10px 22px -14px ${alfa(P.espresso, 0.5)}}
@media (hover:hover){.prob-opcion:hover{transform:translateY(-2px)}}
.prob-opcion:active{transform:scale(.96)}
.prob-opcion-texto{font-size:13px;font-weight:550;color:var(--tinta-2)}
.prob-opcion[aria-checked="true"] .prob-opcion-texto{color:var(--tinta)}
.prob-icono{display:grid;place-items:center;width:52px;height:52px;border-radius:14px;box-shadow:inset 0 0 0 1px ${alfa(P.espresso, 0.08)};
  transition:background-color .6s var(--curva)}
.prob-modo-banda{display:block;width:100%;height:auto;border-radius:10px}

.prob-nombre{position:relative;display:block}
.prob-nombre input{width:100%;height:60px;padding:0 64px 0 18px;border:0;border-radius:18px;background:#fff;color:var(--tinta);
  font:inherit;font-size:20px;font-weight:600;letter-spacing:-.02em;box-shadow:inset 0 0 0 1px var(--linea);
  transition:box-shadow .25s;outline:none}
.prob-nombre input::placeholder{color:var(--tinta-3);opacity:.7}
.prob-nombre input:focus{box-shadow:inset 0 0 0 2px var(--tinta)}
.prob .prob-nombre input:focus-visible{outline:none}
.prob-cuenta{position:absolute;right:18px;top:50%;translate:0 -50%;font-size:13px;color:var(--tinta-3);font-variant-numeric:tabular-nums}

/* el último paso */
.prob-guardar{display:grid;gap:10px}
.prob-error{font-size:14px;font-weight:550;color:#b42318}
.prob-legal{font-size:12.5px;line-height:1.4;color:var(--tinta-3)}
.prob-legal a{color:inherit}
.prob-hecho{display:grid;justify-items:center;gap:6px;text-align:center;padding:8px 0;animation:prob-entra-d .5s var(--curva) both}
.prob-hecho-marca{display:grid;place-items:center;width:56px;height:56px;margin-bottom:6px;border-radius:50%;background:var(--marca);color:${P.papel}}
.prob-hecho strong{font-size:20px;letter-spacing:-.02em}
.prob-hecho p{color:var(--tinta-2);margin-bottom:12px;overflow-wrap:anywhere}

/* ---------- el pie del panel ---------- */
.prob-pie{display:flex;align-items:center;gap:12px;padding:12px 14px max(14px,env(safe-area-inset-bottom));border-top:1px solid var(--linea)}
.prob-atras{display:grid;place-items:center;width:48px;height:48px;border:0;border-radius:50%;cursor:pointer;background:${alfa(P.espresso, 0.06)};
  transition:opacity .25s,background-color .2s}
.prob-atras:disabled{opacity:.35;cursor:default}
.prob-paso{flex:1;display:flex;justify-content:center;gap:6px}
.prob-paso i{width:6px;height:6px;border-radius:99px;background:${alfa(P.espresso, 0.16)};transition:width .45s var(--muelle),background-color .3s}
.prob-paso i.hecho{background:${alfa(P.espresso, 0.4)}}
.prob-paso i.activo{width:20px;background:var(--tinta)}
.prob-siguiente{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 20px;border:0;border-radius:999px;
  cursor:pointer;background:var(--marca);color:${P.papel};font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-.01em;
  transition:background-color .2s,transform .3s var(--muelle)}
@media (hover:hover){.prob-siguiente:hover{background:var(--marca-encima)}}
.prob-siguiente:active{transform:scale(.97)}
.prob-siguiente:disabled{cursor:progress}
.prob-ancho{width:100%}
/* Sin botón, los puntos siguen en medio: lo que ocupa la flecha de atrás. */
.prob-sin-boton{width:48px}

/* ---------- pantalla ancha: escena a la izquierda, panel de cristal a la derecha ---------- */
@media (min-width:900px){
  .prob{flex-direction:row}
  .prob-halo{--cx:calc((100% - 432px) / 2);--cy:50%}
  .prob-panel{width:400px;flex:none;margin:16px;border-radius:30px;margin-top:76px}
}
/* ---------- móvil: la escena arriba, el panel como una hoja ---------- */
@media (max-width:899.98px){
  .prob-escena{padding-top:60px}
  .prob-panel{flex:none;max-height:min(50dvh,440px);border-radius:28px 28px 0 0}
  .prob-solapas{margin:10px 10px 0}
  .prob-seccion{padding:16px 18px 14px;gap:16px}
  .prob-cabeza p{font-size:14px}
  .prob-colores-fila{height:72px}
  .prob-muestra{width:62px}
  .prob-colores-marco{left:calc(50% - 34px);width:68px}
  .prob-foto{zoom:.4}
  .prob-solapas-fila button{font-size:13px;padding:0 2px}
  .prob-cabeza h1{font-size:22px}
  .prob-iconos{grid-template-columns:repeat(4,1fr);gap:8px}
  .prob-modos{grid-template-columns:repeat(2,1fr);gap:8px}
  .prob-opcion{padding:8px 6px;border-radius:14px}
  .prob-icono{width:44px;height:44px}
}
@media (max-width:899.98px) and (orientation:landscape){
  .prob{flex-direction:row}
  .prob-panel{max-height:none;width:min(380px,50vw);border-radius:0}
}

/* ---------- reducir movimiento ---------- */
.prob-quieto .prob-zoom,.prob-quieto .prob-pildora,.prob-quieto .prob-segmentos-pildora{transition:none}
.prob-quieto .prob-capa.entra,.prob-quieto .prob-seccion,.prob-quieto .prob-hecho{animation:none}
@media (prefers-reduced-motion:reduce){
  .prob{transition:none}
  .prob-opcion{transition:none}
}
`;
