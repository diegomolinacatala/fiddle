import { PALETA as P } from "../paleta";
import { cssCliente } from "./estiloCliente";

// ============================================================================
// LA PRUEBA: las dos teclas del panel y los avisos que saltan del móvil del cliente
// ----------------------------------------------------------------------------
// Las teclas son los dos botones principales (uno con el color de la tienda, otro
// con el verde de fiddle). Los avisos son de la zona `.exp-aviso-zona`, encima de
// la escena: cada uno lleva dos envoltorios que mueve AvisoEnEscena.js (el vuelo
// desde el móvil); aquí solo su sitio, el apagado del anterior y la salida.
// Solo transform y opacity.
// ============================================================================

export const cssPrueba = `
.exp-prueba{grid-template-rows:auto minmax(0,1fr);align-content:stretch}
.exp-centro{display:grid;align-content:center;gap:12px}
/* Dos teclas lado a lado si caben a 150 px cada una; si no, una sobre otra. */
.exp-teclas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.exp-tecla{position:relative;display:grid;grid-template-columns:minmax(0,1fr);align-content:center;justify-items:start;gap:2px;min-height:112px;
  padding:14px 14px 13px;border:0;border-radius:22px;cursor:pointer;text-align:left;color:${P.papel};
  box-shadow:0 14px 24px -16px rgba(0,0,0,.5);transition:transform .2s var(--muelle)}
.exp-tecla:active{transform:scale(.97)}
.exp-tecla-tono{background:var(--tono)}
.exp-tecla-marca{background:var(--marca)}
@media (hover:hover){.exp-tecla-marca:hover{background:var(--marca-encima)}}
.exp-tecla-icono{display:grid;place-items:center;width:40px;height:40px;margin-bottom:8px;border-radius:13px;background:rgba(255,255,255,.18)}
.exp-tecla-nombre{font-size:17px;line-height:1.15;font-weight:650;letter-spacing:-.02em}
.exp-tecla-nota{font-size:12.5px;line-height:1.25;opacity:.86}
/* El pulso es un aro que crece y se desvanece: transform y opacity. */
.exp-pulso::after{content:"";position:absolute;inset:0;border-radius:inherit;border:2px solid var(--tono);pointer-events:none;
  animation:exp-pulso 1.8s var(--curva) infinite}
@keyframes exp-pulso{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.07,1.2);opacity:0}}
.exp-estado{min-height:24px;text-align:center;font-size:15px;font-weight:560;color:var(--tinta-2);font-variant-numeric:tabular-nums;
  animation:exp-estado .3s var(--curva) both}
@keyframes exp-estado{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.exp-sigue{display:flex;align-items:center;justify-content:center;height:48px;border:0;border-radius:999px;cursor:pointer;background:transparent;
  box-shadow:inset 0 0 0 1px var(--linea);color:var(--tinta-2);font-size:15px;font-weight:600;letter-spacing:-.01em;opacity:.55;
  transition:opacity .3s,background-color .3s,color .3s,transform .2s var(--muelle)}
.exp-sigue:active{transform:scale(.97)}
.exp-sigue.exp-listo{opacity:1;background:var(--marca);color:${P.papel};box-shadow:none}
@media (hover:hover){.exp-sigue.exp-listo:hover{background:var(--marca-encima)}}

/* los avisos: arriba de la escena, el nuevo delante y el anterior debajo, apagado */
.exp-aviso .aviso{background:var(--superficie);box-shadow:0 14px 34px -14px rgba(0,0,0,.4),0 2px 8px rgba(0,0,0,.08)}
.exp-aviso-zona{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
.exp-aviso{position:absolute;top:calc(env(safe-area-inset-top) + 64px);left:0;right:0;margin:0 auto;width:min(340px,calc(100% - 24px));
  transition:translate .45s var(--curva),scale .45s var(--curva),opacity .45s var(--curva)}
.exp-aviso.i1{translate:0 52px;scale:.94;opacity:.5}
.exp-aviso.i2{translate:0 96px;scale:.88;opacity:0}
.exp-aviso.sale{animation:exp-sale .2s cubic-bezier(.4,0,1,1) both}
@keyframes exp-sale{to{opacity:0;transform:translateY(-14px)}}

@media (min-width:900px){.exp-aviso{top:78px}}
@media (max-width:899.98px) and (max-height:640px){
  .exp-aviso{top:calc(env(safe-area-inset-top) + 56px)}
  /* Sin sitio para dos: el de antes le tapaba la cara al cliente. Solo el último. */
  .exp-aviso.i1,.exp-aviso.i2{display:none}
  /* En un móvil bajo el panel mide ~340 px: una sobre otra, las teclas tapaban el
     título y se salían por abajo. Siempre lado a lado, y sin la línea pequeña (lo
     que dice ya lo dice la frase de arriba). */
  .exp-teclas{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .exp-tecla{min-height:84px;padding:10px 11px}
  .exp-tecla-icono{width:30px;height:30px;margin-bottom:5px;border-radius:10px}
  .exp-tecla-nombre{font-size:15px}
  .exp-tecla-nota{display:none}
  .exp-centro{gap:6px}
}
@media (max-width:899.98px) and (orientation:landscape){
  .exp-aviso{top:56px}
  .exp-aviso.i1{translate:0 44px}
  .exp-tecla{min-height:84px;padding:10px 12px}
  .exp-tecla-icono{width:30px;height:30px;margin-bottom:2px}
}

.prob-quieto .exp-aviso,.prob-quieto .exp-pulso::after,.prob-quieto .exp-estado{animation:none}
.prob-quieto .exp-aviso,.prob-quieto .exp-tecla{transition:none}
@media (prefers-reduced-motion:reduce){
  .exp-aviso,.exp-pulso::after,.exp-estado{animation:none;transition:none}
  .exp-tecla,.exp-sigue{transition:none}
}
` + cssCliente;
