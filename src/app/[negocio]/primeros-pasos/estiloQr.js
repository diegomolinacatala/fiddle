// ============================================================================
// ESTILO DEL PASO «QR DEL MOSTRADOR» (clases pp-qr-)
// ----------------------------------------------------------------------------
// El lienzo es de 400x300 px fijos (EscenaQr lo escala al hueco). Lo que no lleva
// `.pp-qr-juega` ya es el estado FINAL: las animaciones solo recorren el camino
// hasta él (con `both`, antes de empezar cada pieza espera en su primer fotograma).
//
//   0,0 s   el QR se dibuja grande, desde el centro; los tres cuadrados con muelle
//   0,5 s   sube el cartel
//   0,9 s   el QR se coloca en el cartel
//   1,7 s   entra el móvil
//   2,4 s   haz y línea de escaneo
//   3,2 s   la pantalla del móvil se llena con la tarjeta
//
// Solo transform, opacity y clip-path. Con «reducir movimiento», el final quieto.
// ============================================================================

const SECUENCIA = `
.pp-qr-juega .pp-qr-datos{animation:pp-qr-dibuja .95s var(--curva) both}
.pp-qr-juega .pp-qr-ojo{animation:pp-qr-ojo .5s var(--muelle) both}
.pp-qr-juega .pp-qr-ojo.o0{animation-delay:.1s}
.pp-qr-juega .pp-qr-ojo.o1{animation-delay:.25s}
.pp-qr-juega .pp-qr-ojo.o2{animation-delay:.4s}
.pp-qr-juega .pp-qr-codigo{animation:pp-qr-coloca 1.5s var(--curva) both}
.pp-qr-juega .pp-qr-cartel{animation:pp-qr-sube .6s var(--curva) .5s both}
.pp-qr-juega .pp-qr-movil{animation:pp-qr-entra .8s var(--curva) 1.7s both}
.pp-qr-juega .pp-qr-haz{animation:pp-qr-haz .8s ease-in-out 2.4s both}
.pp-qr-juega .pp-qr-barrido{animation:pp-qr-barre .8s ease-in-out 2.4s both}
.pp-qr-juega .pp-qr-camara{animation:pp-qr-camara 3.4s linear both}
.pp-qr-juega .pp-qr-sale{animation:pp-qr-sale .55s var(--muelle) 3.15s both}
@keyframes pp-qr-dibuja{from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(75% at 50% 50%)}}
@keyframes pp-qr-ojo{from{transform:scale(0);opacity:0}}
@keyframes pp-qr-coloca{0%,45%{transform:translate(80px,-12px) scale(1.7)}100%{transform:none}}
@keyframes pp-qr-sube{from{opacity:0;transform:translateY(26px)}}
@keyframes pp-qr-entra{from{opacity:0;transform:translate(150px,50px) rotate(9deg)}}
@keyframes pp-qr-haz{0%{opacity:0}20%,80%{opacity:1}100%{opacity:0}}
@keyframes pp-qr-barre{0%{opacity:0;transform:translateY(0)}12%,88%{opacity:1}100%{opacity:0;transform:translateY(108px)}}
@keyframes pp-qr-camara{0%,88%{opacity:1}100%{opacity:0}}
@keyframes pp-qr-sale{from{opacity:0;transform:scale(.82)}}
.pp-qr-otra{animation:pp-qr-otra .35s var(--curva) both}
@keyframes pp-qr-otra{from{opacity:0;transform:translateY(6px)}}
`;

const CALMA = `
.prob-quieto .pp-qr-lienzo *,.prob-quieto .pp-qr-otra{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.pp-qr-lienzo *,.pp-qr-otra{animation:none!important;transition:none!important}}
`;

const ESCENA = `
.pp-qr-escena{overflow:hidden}
.pp-qr-caja{position:relative;align-self:stretch;justify-self:stretch;min-width:0;min-height:0}
.pp-qr-lienzo{position:absolute;left:50%;top:50%;width:400px;height:300px;margin:-150px 0 0 -200px;transform-origin:50% 50%}

/* el mostrador y el cartel de pie */
.pp-qr-mostrador{position:absolute;left:-60px;right:-60px;top:276px;height:80px;border-radius:14px 14px 0 0;
  background:color-mix(in srgb,var(--tinta) 8%,transparent)}
.pp-qr-cartel{position:absolute;left:30px;top:36px;width:180px;height:240px;display:flex;flex-direction:column;overflow:hidden;
  border-radius:16px 16px 6px 6px;background:#fff;box-shadow:0 18px 30px -18px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.08)}
.pp-qr-cab{display:grid;place-items:center;flex:none;height:56px;padding:0 12px;background:var(--tono);color:var(--tinta-cartel)}
.pp-qr-cab span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center;
  font-size:16px;line-height:1.15;font-weight:700;letter-spacing:-.02em}
.pp-qr-hueco{flex:none;height:140px}
.pp-qr-cartel p{margin:0;padding:0 14px;text-align:center;font-size:13px;line-height:1.25;font-weight:600;color:var(--tinta)}

/* el QR: una lámina blanca de 120 px colocada sobre el hueco del cartel */
.pp-qr-codigo{position:absolute;left:60px;top:102px;width:120px;height:120px}
.pp-qr-lamina{position:relative;width:100%;height:100%;padding:8px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06);overflow:hidden}
.pp-qr-datos,.pp-qr-ojos{position:absolute;inset:8px;width:104px;height:104px;display:block}
.pp-qr-ojo{transform-box:fill-box;transform-origin:50% 50%}
.pp-qr-barrido{position:absolute;left:6px;right:6px;top:8px;height:3px;border-radius:2px;opacity:0;
  background:var(--tono-2);box-shadow:0 0 10px 2px var(--tono-2)}

/* el haz que sale del móvil hacia el QR */
.pp-qr-haz{position:absolute;left:182px;top:102px;width:70px;height:120px;opacity:0;pointer-events:none;
  clip-path:polygon(0 0,100% 38%,100% 62%,0 100%);
  background:linear-gradient(to right,color-mix(in srgb,var(--tono-2) 38%,transparent),color-mix(in srgb,var(--tono-2) 8%,transparent))}

/* el móvil, plano como el de la demo */
.pp-qr-movil{position:absolute;left:244px;top:78px;width:116px;height:214px;padding:7px;border-radius:20px;background:#2b211b;
  box-shadow:0 20px 30px -14px rgba(0,0,0,.5);transform:rotate(-4deg)}
.pp-qr-pantalla{position:relative;width:102px;height:200px;border-radius:14px;overflow:hidden;background:var(--papel)}
.pp-qr-sale{position:absolute;left:0;right:0;top:22px;transform-origin:50% 30%}
.pp-qr-tarjeta{width:360px;transform:scale(.2833);transform-origin:0 0;height:150px}
.pp-qr-camara{position:absolute;inset:0;opacity:0;background:#14100d}
.pp-qr-camara i{position:absolute;width:16px;height:16px;border:2.5px solid #fff;opacity:.85}
.pp-qr-camara .a{left:20px;top:58px;border-right:0;border-bottom:0;border-top-left-radius:6px}
.pp-qr-camara .b{right:20px;top:58px;border-left:0;border-bottom:0;border-top-right-radius:6px}
.pp-qr-camara .c{left:20px;bottom:58px;border-right:0;border-top:0;border-bottom-left-radius:6px}
.pp-qr-camara .d{right:20px;bottom:58px;border-left:0;border-top:0;border-bottom-right-radius:6px}

/* «Otra vez»: discreto, dentro de la escena */
.pp-qr-otra{position:absolute;right:12px;bottom:10px;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;
  border:0;border-radius:999px;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:var(--tinta-2);
  background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1px var(--linea);transition:transform .2s var(--muelle),color .2s}
.pp-qr-otra:active{transform:scale(.97)}
@media (hover:hover){.pp-qr-otra:hover{color:var(--tinta)}}
.pp-qr-otra:focus-visible,.pp-qr-accion:focus-visible{outline:3px solid var(--marca);outline-offset:2px}
`;

const PANEL = `
.pp-qr-acciones{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px}
.pp-qr-accion{white-space:nowrap}
.pp .pp-qr-accion{color:var(--tinta);font-weight:600}
.pp-qr-accion{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 14px;border:0;border-radius:999px;
  cursor:pointer;text-decoration:none;background:transparent;box-shadow:inset 0 0 0 1px var(--linea);
  font:inherit;font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--tinta-2);transition:background-color .2s,color .2s,transform .2s var(--muelle)}
.pp-qr-accion:active{transform:scale(.97)}
@media (hover:hover){.pp-qr-accion:hover{background:color-mix(in srgb,var(--tinta) 5%,transparent);color:var(--tinta)}}
`;

// El cartel de papel: cuelga de <body> (CartelImpreso.js) y solo existe al imprimir.
const IMPRESION = `
.pp-qr-impresion{display:none}
@media print{
  @page{size:A5 portrait;margin:0}
  html,body{overflow:visible!important;height:auto!important;background:#fff!important}
  body>*:not(.pp-qr-impresion){display:none!important}
  .pp-qr-impresion{display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;
    width:148mm;height:210mm;padding:22mm 14mm 14mm;position:relative;text-align:center;color:#111;background:#fff;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;break-inside:avoid}
  .pp-qr-imp-banda{position:absolute;left:0;right:0;top:0;height:9mm;background:var(--tono-impreso);
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pp-qr-impresion h1{margin:0 0 9mm;font-size:34pt;line-height:1.05;font-weight:800;letter-spacing:-.02em}
  .pp-qr-impresion img{display:block;width:100mm;height:100mm}
  .pp-qr-imp-frase{margin:9mm 0 0;font-size:19pt;font-weight:700}
  .pp-qr-imp-pie{margin:3mm 0 0;font-size:11pt;color:#444}
}
`;

// En el móvil el panel de este paso es corto: que la escena se quede con el resto.
const MOVIL = `
@media (max-width:899.98px) and (orientation:portrait){
  .pp-en-qr .exp-panel{height:auto;min-height:0}
  .pp-en-qr .exp-cuerpo{flex:none}
  .pp-qr-otra{top:64px;bottom:auto;min-height:40px;padding:0 14px}
}
`;

export const cssQr = SECUENCIA + CALMA + ESCENA + PANEL + IMPRESION + MOVIL;
