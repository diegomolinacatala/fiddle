import { PALETA as P } from "../paleta";
import { cssPrueba } from "./estiloPrueba";

// ============================================================================
// ESTILO DE LA EXPERIENCIA (clases exp-)
// ----------------------------------------------------------------------------
// La disposición a pantalla completa es la de tarjeta/estilo.js (`.prob-pagina`:
// escena + panel). Aquí solo lo que añade la experiencia: el panel con un paso
// cada vez (progreso arriba, cuerpo que puede deslizar y acción siempre abajo),
// la cabecera mínima. La prueba (teclas, avisos y cliente) vive en estiloPrueba.js.
//
// El panel tiene alto FIJO en cada disposición: el paso cambia por dentro, la
// tarjeta no salta. La acción principal va fuera del cuerpo que desliza, así que
// siempre está a la vista (en `guarda`, el botón del formulario se queda pegado).
// Movimiento: solo transform y opacity. Con «reducir movimiento», nada se anima.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const cssExperiencia = `
.exp .prob [data-titulo]:focus-visible,.exp [data-titulo]:focus-visible{outline:none}

/* ---------- la cabecera mínima ---------- */
.exp-entrar{display:inline-flex;align-items:center;height:44px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:560;
  color:var(--tinta-2);text-decoration:none;transition:background-color .2s,transform .2s var(--muelle)}
.exp-entrar:active{transform:scale(.97)}
@media (hover:hover){.exp-entrar:hover{background:${alfa(P.espresso, 0.06)};color:var(--tinta)}}
.exp .prob-volver{padding:0 16px}

/* ---------- el panel: progreso, cuerpo, acción ---------- */
.exp .exp-panel{display:flex;flex-direction:column;overflow:hidden}
.exp-progreso{display:flex;align-items:center;gap:10px;padding:6px 18px 0 6px}
.exp-atras{display:grid;place-items:center;flex:none;width:44px;height:44px;border:0;border-radius:50%;cursor:pointer;background:none;
  transition:opacity .2s,transform .2s var(--muelle),background-color .2s}
.exp-atras:active{transform:scale(.94)}
.exp-atras:disabled{opacity:.28;cursor:default}
@media (hover:hover){.exp-atras:not(:disabled):hover{background:${alfa(P.espresso, 0.06)}}}
.exp-barra{flex:1;height:4px;border-radius:99px;overflow:hidden;background:${alfa(P.espresso, 0.09)}}
.exp-barra i{display:block;width:100%;height:100%;background:var(--tinta);transform-origin:0 50%;transition:transform .45s var(--curva)}
.exp-pasos{flex:none;min-width:40px;text-align:right;font-size:13px;font-weight:560;color:var(--tinta-3);font-variant-numeric:tabular-nums}

.exp-paso{flex:1;min-height:0;display:flex;flex-direction:column}
.exp-paso.desde-dcha{animation:prob-entra-d .3s var(--curva) both}
.exp-paso.desde-izda{animation:prob-entra-i .3s var(--curva) both}
.exp-cuerpo{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:18px;padding:14px 22px 16px;
  overflow:hidden auto;overscroll-behavior:contain;scrollbar-width:thin}
.exp .prob-cabeza :is(h1,h2){font-size:28px;line-height:1.1;font-weight:660;letter-spacing:-.035em;text-wrap:balance}
.exp-accion{display:grid;gap:10px;padding:10px 22px max(18px,env(safe-area-inset-bottom))}
.exp-principal{height:54px;font-size:16px}
.exp-nota{text-align:center;font-size:13px;color:var(--tinta-3)}

/* ---------- hola ---------- */
.exp-hola{align-content:center}
.exp-hola .prob-cabeza{gap:10px}
.exp .exp-hola .prob-cabeza h1{font-size:34px;line-height:1.02;letter-spacing:-.045em}
.exp-hola .prob-cabeza p{font-size:16px}
.exp-etiqueta{display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:var(--tinta-3)}
.exp-nombre input{height:56px;padding:0 18px;font-size:20px}

/* ---------- guarda ---------- */
.exp-guarda{gap:16px}
/* El botón de guardar se queda pegado abajo del cuerpo si no cabe todo. */
.exp-guarda .prob-guardar button[type="submit"]{position:sticky;bottom:2px;z-index:1;height:54px;font-size:16px}
.exp-precios{display:grid;justify-items:center;gap:0;text-align:center}
.exp-precios p{font-size:13.5px;color:var(--tinta-3)}
.exp-enlace{height:44px;padding:0 12px;border:0;background:none;cursor:pointer;font-size:14px;font-weight:600;color:var(--tinta-2);
  text-decoration:underline;text-underline-offset:3px;transition:transform .2s var(--muelle)}
.exp-enlace:active{transform:scale(.97)}

/* ---------- pantalla ancha: el panel, más ancho y centrado ---------- */
@media (min-width:900px){
  .exp.prob-pagina .prob-halo{--cx:calc((100% - 492px) / 2);--cy:50%}
  .exp .exp-panel{width:460px;height:min(680px,calc(100% - 112px));align-self:center;margin:52px 32px 0 0;border-radius:32px}
  .exp .exp-hola .prob-cabeza h1{font-size:46px}
  .exp-hola .prob-cabeza p{font-size:17px}
  .exp-cuerpo{padding:18px 28px 18px}
  .exp-accion{padding:10px 28px 24px}
}

/* ---------- móvil: la escena arriba, el panel como una hoja de alto fijo ---------- */
@media (max-width:899.98px){
  .exp .exp-panel{flex:none;height:clamp(330px,60%,470px);max-height:none;border-radius:28px 28px 0 0}
  .exp-cuerpo{gap:14px;padding:12px 18px 12px}
  .exp-accion{padding:8px 18px max(14px,env(safe-area-inset-bottom))}
  .exp .prob-cabeza :is(h1,h2){font-size:22px}
  .exp .exp-hola .prob-cabeza h1{font-size:38px;max-width:8.6em;text-wrap:balance}
  .exp-hola .prob-cabeza p{font-size:15px}
  .exp-nombre input{height:52px}
  .exp-guarda{gap:12px}
  /* Con el teclado abierto la escena se queda en lo justo y el panel toma el resto. */
  .exp-teclado .prob-escena{flex:0 0 104px}
  .exp-teclado .exp-panel{flex:1;height:auto}
}
@media (max-width:340px){
  .exp .exp-hola .prob-cabeza h1{font-size:30px}
}
@media (max-width:899.98px) and (max-height:640px) and (orientation:portrait){
  .exp .exp-hola .prob-cabeza h1{font-size:27px;max-width:none}
  .exp-hola .prob-cabeza{gap:6px}
  .exp-hola .prob-cabeza p{font-size:14px}
  .exp-hola{gap:10px}
  .exp-nombre input{height:48px}
  .exp-principal{height:50px}
}
/* Móvil en horizontal: la escena a la izquierda y el panel entero a la derecha. */
@media (max-width:899.98px) and (orientation:landscape){
  .exp .exp-panel{height:auto;align-self:stretch;border-radius:0}
  /* «Entrar» queda encima del panel en esta disposición: el progreso le deja sitio. */
  .exp .exp-progreso{padding-right:84px}
  .exp .exp-hola .prob-cabeza h1{font-size:24px;max-width:none}
  .exp-hola .prob-cabeza p{display:none}
  .exp-cuerpo{gap:10px;padding-top:6px}
  .exp-accion{padding-bottom:max(10px,env(safe-area-inset-bottom))}
  .exp-principal{height:48px}
}

/* ---------- reducir movimiento ---------- */
.prob-quieto .exp-paso{animation:none}
.prob-quieto .exp-barra i{transition:none}
@media (prefers-reduced-motion:reduce){
  .exp-paso{animation:none}
  .exp-barra i{transition:none}
}
` + cssPrueba;
