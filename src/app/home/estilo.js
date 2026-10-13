// ============================================================================
// ESTILO DE LA WEB DE FIDDLE
// ----------------------------------------------------------------------------
// Los colores son los del logo (docs/marca): la tinta, la crema y el rosa del
// sello. El rosa NO va en texto pequeño sobre claro (no llega a 3:1): es el punto
// de los títulos, las marcas de la lista oscura y poco más; sobre claro, el rosa
// oscuro (--rosa-tinta).
//
// Movimiento: solo opacidad y desplazamiento. El texto de la portada no se anima:
// tiene que verse aunque el navegador no llegue a correr ni una animación. Las
// entradas al hacer scroll van con animation-timeline: donde no existe, todo se
// ve desde el principio; y con «reducir movimiento», nada se mueve.
// ============================================================================

export const css = `
.home{
  --fondo:#f6f4ef; --superficie:#fff; --tinta:#1d1b2e; --tinta-2:#4a4760; --tinta-3:#6b6880;
  --linea:rgba(29,27,46,.1); --rosa:#ff5c8a; --rosa-tinta:#d23a6a; --crema:#fff7ea;
  --crema-2:rgba(255,247,234,.72); --crema-linea:rgba(255,247,234,.13);
  --ancho:1120px; --margen:clamp(20px,4vw,40px); --curva:cubic-bezier(.16,1,.3,1);
  --apple:-apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;
  min-height:100dvh; background:var(--fondo); color:var(--tinta); color-scheme:light;
  font-family:var(--fuente-web),system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:16px; line-height:1.5; overflow-x:clip; -webkit-font-smoothing:antialiased;
}
body:has(.home){background:#f6f4ef}
@media (prefers-reduced-motion:no-preference){html:has(.home){scroll-behavior:smooth}}
.home [id]{scroll-margin-top:76px}
.home a{color:inherit;-webkit-tap-highlight-color:transparent}
.home :focus-visible{outline:2px solid var(--tinta);outline-offset:3px;border-radius:6px}
.home .bloque-noche :focus-visible,.home .pie :focus-visible,.home .plan-destacado :focus-visible{outline-color:var(--crema)}
/* Sin especificidad: así cualquier clase de abajo puede darles su margen. */
:where(.home) :where(h1,h2,h3,p){margin:0}

.saltar{position:absolute;left:12px;top:-60px;z-index:100;padding:10px 16px;border-radius:12px;
  background:var(--tinta);color:var(--crema)!important;font-weight:600;text-decoration:none}
.saltar:focus{top:10px}

/* ---------- cabecera ---------- */
.cabecera{position:sticky;top:0;z-index:50;background:rgba(246,244,239,.8);
  -webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px);
  box-shadow:0 1px 0 transparent}
.cabecera-dentro{max-width:var(--ancho);margin:0 auto;padding:0 var(--margen);height:64px;
  display:flex;align-items:center;gap:clamp(12px,3vw,32px)}
.cabecera-marca{display:flex;align-items:center;min-height:44px;text-decoration:none;border-radius:10px}
.cabecera-nav{margin-left:auto;display:flex;align-items:center;gap:clamp(4px,2.2vw,28px)}
.cabecera-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 6px;font-size:14.5px;font-weight:500;
  color:var(--tinta-2);text-decoration:none;transition:color .2s}
@media (hover:hover){.cabecera-nav a:hover{color:var(--tinta)}}
.entrar{position:relative;display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 20px;
  border-radius:999px;background:var(--tinta);color:var(--crema)!important;font-size:14.5px;font-weight:600;
  text-decoration:none;white-space:nowrap;transition:background-color .2s,transform .15s}
.entrar::before{content:"";position:absolute;inset:-4px}
@media (hover:hover){.entrar:hover{background:#34304f}}
.entrar:active{transform:scale(.97)}
@media (max-width:719px){.solo-ancho{display:none!important}}

/* ---------- comunes ---------- */
.punto{display:inline-block;width:.19em;height:.19em;margin-left:.07em;border-radius:50%;background:var(--rosa);vertical-align:baseline}
.antetitulo{font-size:15px;font-weight:550;color:var(--tinta-2);letter-spacing:-.005em}
.entradilla{font-size:clamp(17px,.95rem + .4vw,21px);line-height:1.5;color:var(--tinta-2);max-width:34em;text-wrap:pretty;letter-spacing:-.01em}
.titulo-bloque{font-size:clamp(34px,1.3rem + 3.3vw,56px);line-height:1.03;font-weight:660;letter-spacing:-.042em;text-wrap:balance}
.bloque{max-width:var(--ancho);margin:0 auto;padding:clamp(72px,10vw,128px) var(--margen)}
.bloque-estrecho{max-width:860px}
.encabezado{display:grid;gap:18px;margin-bottom:clamp(36px,5vw,60px)}
.encabezado-centro{justify-items:center;text-align:center}
.boton,.boton-suave{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 26px;
  border-radius:999px;font-size:16px;font-weight:600;letter-spacing:-.01em;text-decoration:none;cursor:pointer;
  transition:background-color .2s,border-color .2s,transform .15s}
.boton{background:var(--tinta);color:var(--crema)!important}
.boton-suave{border:1px solid rgba(29,27,46,.18);color:var(--tinta)}
.boton-claro{background:var(--crema);color:var(--tinta)!important}
@media (hover:hover){
  .boton:hover{background:#34304f}
  .boton-suave:hover{background:rgba(29,27,46,.05);border-color:rgba(29,27,46,.28)}
  .boton-claro:hover{background:#fff}
}
.boton:active,.boton-suave:active{transform:scale(.98)}

/* ---------- portada ---------- */
.portada{max-width:var(--ancho);margin:0 auto;padding:clamp(40px,7vw,88px) var(--margen) clamp(72px,9vw,120px);
  display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(48px,6vw,72px);align-items:center}
.portada-texto{display:grid;gap:22px;justify-items:center;text-align:center}
.portada-texto .entradilla{max-width:30em}
.titular{font-size:clamp(46px,1.4rem + 6vw,88px);line-height:.98;font-weight:680;letter-spacing:-.05em;text-wrap:balance}
.acciones{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:10px}
.portada-visual{display:grid;justify-items:center}
@media (min-width:960px){
  .portada{grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);padding-top:72px}
  .portada-texto{justify-items:start;text-align:left}
  .acciones{justify-content:flex-start}
}

/* el móvil */
.movil{position:relative;margin:0;width:322px;font-family:var(--apple)}
.movil-cuerpo{position:relative;padding:11px;border-radius:56px;background:linear-gradient(150deg,#3a3846,#121119 45%,#26242f);
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.08),0 60px 90px -40px rgba(29,27,46,.55),0 28px 40px -28px rgba(29,27,46,.35)}
.movil-isla{position:absolute;z-index:2;top:22px;left:50%;width:94px;height:28px;border-radius:20px;background:#000;translate:-50% 0}
.movil-pantalla{height:640px;overflow:hidden;border-radius:45px;background:#f2f2f7;padding:0 12px;color:#000}
.movil-estado{display:flex;align-items:center;justify-content:space-between;height:54px;padding:6px 20px 0 26px;
  font-size:15px;font-weight:600;letter-spacing:-.01em}
.movil-cartera{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 12px;color:#007aff;font-size:16px}
.movil-mas{display:inline-flex;align-items:center;justify-content:center;gap:3px;width:28px;height:28px;border-radius:50%;background:rgba(0,122,255,.12)}
.movil-mas i{width:4px;height:4px;border-radius:50%;background:currentColor}
.movil-qr{display:grid;justify-items:center;gap:8px;padding:18px 18px 20px}
.movil-qr img{padding:4px;background:#fff;border-radius:10px}
.movil-qr span{font-size:13px;font-weight:600;letter-spacing:.18em;opacity:.75}
.movil-aviso{position:absolute;z-index:3;left:50%;bottom:48px;width:calc(100% - 28px);translate:-50% 0}
@media (min-width:1100px){.movil-aviso{left:-84px;bottom:60px;width:300px;translate:none}}
@media (max-width:379px){.movil{zoom:.88}}
@media (max-width:339px){.movil{zoom:.8}}

/* un aviso de la pantalla de bloqueo */
.aviso{display:grid;grid-template-columns:38px minmax(0,1fr);gap:11px;align-items:center;padding:11px 14px 12px 11px;
  border-radius:22px;background:rgba(250,250,252,.88);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
  box-shadow:0 14px 34px -14px rgba(29,27,46,.34),0 0 0 .5px rgba(29,27,46,.08);font-family:var(--apple);color:#1c1c1e;text-align:left}
.aviso-texto{min-width:0}
.aviso-cabeza{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.aviso-cabeza strong{font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aviso-cabeza span{flex-shrink:0;font-size:12.5px;color:#8a8a8e}
.aviso p{margin-top:1px;font-size:14.5px;line-height:1.3;overflow-wrap:anywhere}

/* ---------- cómo funciona ---------- */
.pasos{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
@media (min-width:900px){.pasos{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}}
.paso{display:grid;align-content:start;background:var(--superficie);border-radius:30px;padding-bottom:30px;
  box-shadow:0 0 0 1px var(--linea);overflow:hidden}
.paso > h3,.paso > p,.paso-numero{margin-left:28px;margin-right:28px}
.paso > h3{margin-top:10px;font-size:21px;font-weight:620;letter-spacing:-.025em}
.paso > p{margin-top:6px;color:var(--tinta-2);line-height:1.55}
.paso-numero{margin-top:26px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;
  box-shadow:inset 0 0 0 1px rgba(29,27,46,.2);font-size:13px;font-weight:650;color:var(--tinta-2)}
.paso-visual{height:236px;display:grid;place-items:center;overflow:hidden}
.paso-cartel{background:linear-gradient(160deg,#fde7ee,#fbd9e3)}
.paso-caja{background:linear-gradient(160deg,#ecebf5,#e1dfee)}
.paso-avisos{background:linear-gradient(160deg,#f4efe6,#ebe3d6)}
.cartel{display:grid;justify-items:center;gap:10px;width:156px;padding:16px 14px 14px;border-radius:16px;background:#fff7f2;color:#4a2c2a;
  box-shadow:0 18px 30px -16px rgba(74,44,42,.45);rotate:-4deg}
.cartel img:last-of-type{width:104px;height:104px}
.cartel span{font-size:11.5px;font-weight:650;line-height:1.25;text-align:center;letter-spacing:-.01em}
.caja{display:grid;gap:10px;width:236px;padding:14px;border-radius:20px;background:#fff;font-family:var(--apple);
  box-shadow:0 18px 34px -18px rgba(29,27,46,.4)}
.caja-fila{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.caja-fila span{padding:2px 8px;border-radius:7px;background:#f2f2f7;font-size:12px;font-weight:650;letter-spacing:.12em}
.caja-banda{display:block;width:100%;height:auto;border-radius:10px}
.caja-boton{display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:12px;background:var(--tinta);color:var(--crema);font-size:15px;font-weight:600}
.avisos{display:grid;gap:8px;width:272px}
.aviso-viejo{opacity:.62;scale:.95}

/* ---------- con tu marca ---------- */
/* Las bandas oscuras van de lado a lado; lo de dentro, al ancho de las demás. */
.bloque-noche{max-width:none;padding-left:0;padding-right:0;background:var(--tinta);color:var(--crema)}
.bloque-noche .entradilla{color:var(--crema-2)}
.marca-dentro,.contacto-dentro{max-width:var(--ancho);margin:0 auto;padding:0 var(--margen)}
.mazo{display:grid;justify-items:center;max-width:340px;margin:0 auto}
.mazo-carta{width:100%;position:relative}
.mazo-carta + .mazo-carta{margin-top:-72px}
@media (min-width:900px){
  .mazo{max-width:none;display:flex;justify-content:center;align-items:flex-start;gap:28px}
  .mazo-carta{width:320px}
  .mazo-carta + .mazo-carta{margin-top:0}
  .mazo-carta:nth-child(2){margin-top:44px}
}

/* ---------- precios ---------- */
.planes{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;max-width:900px;margin:0 auto}
@media (min-width:760px){.planes{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}}
.plan{display:flex;flex-direction:column;padding:clamp(26px,3.5vw,38px);border-radius:32px;background:var(--superficie);
  box-shadow:0 0 0 1px var(--linea)}
.plan-destacado{background:var(--tinta);color:var(--crema);box-shadow:0 40px 70px -40px rgba(29,27,46,.6)}
.plan-cabeza{display:flex;align-items:center;justify-content:space-between;gap:12px}
.plan-cabeza h3{font-size:22px;font-weight:650;letter-spacing:-.03em}
.plan-etiqueta{padding:5px 11px;border-radius:999px;background:var(--rosa);color:var(--tinta);font-size:12.5px;font-weight:650;white-space:nowrap}
.plan-lema{margin-top:4px;color:var(--tinta-2)}
.plan-destacado .plan-lema{color:var(--crema-2)}
.plan-precio{display:flex;align-items:baseline;gap:10px;margin:26px 0 26px}
.plan-cifra{font-size:clamp(52px,2.4rem + 1.6vw,64px);line-height:1;font-weight:660;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.plan-periodo{font-size:16px;color:var(--tinta-3)}
.plan-destacado .plan-periodo{color:var(--crema-2)}
.plan-lista{list-style:none;margin:0 0 32px;padding:24px 0 0;display:grid;gap:13px;border-top:1px solid var(--linea);flex:1;align-content:start}
.plan-destacado .plan-lista{border-top-color:var(--crema-linea)}
.plan-lista li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:12px;align-items:start;line-height:1.4}
.plan-lista svg{margin-top:1px;color:var(--rosa-tinta)}
.plan-destacado .plan-lista svg{color:var(--rosa)}
.plan .boton{width:100%}
.planes-nota{margin-top:28px;text-align:center;color:var(--tinta-2)}
.planes-nota a{font-weight:600;color:var(--tinta);text-decoration-thickness:1px;text-underline-offset:3px}

/* ---------- preguntas ---------- */
.preguntas{border-top:1px solid var(--linea)}
.pregunta{border-bottom:1px solid var(--linea)}
.pregunta summary{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:44px;padding:22px 0;
  list-style:none;cursor:pointer;font-size:clamp(17px,1rem + .3vw,19px);font-weight:580;letter-spacing:-.02em;border-radius:6px}
.pregunta summary::-webkit-details-marker{display:none}
.pregunta summary svg{flex-shrink:0;color:var(--tinta-3);transition:rotate .25s var(--curva)}
.pregunta[open] summary svg{rotate:45deg}
@media (hover:hover){.pregunta summary:hover svg{color:var(--tinta)}}
.pregunta p{padding:0 44px 24px 0;color:var(--tinta-2);line-height:1.6;max-width:62ch}

/* ---------- contacto ---------- */
.contacto-dentro{display:grid;grid-template-columns:minmax(0,1fr);gap:44px;align-items:center}
@media (min-width:900px){.contacto-dentro{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:64px}}
.contacto-texto{display:grid;gap:20px;justify-items:start}
.iniciales{display:flex;margin-bottom:6px}
.iniciales span{width:56px;height:56px;display:grid;place-items:center;border-radius:50%;font-size:21px;font-weight:650;
  color:var(--tinta);box-shadow:0 0 0 3px var(--tinta)}
.iniciales span:first-child{background:var(--rosa)}
.iniciales span:last-child{background:var(--crema);margin-left:-12px}
.contacto-acciones{display:grid;gap:12px}
.contacto-via{display:flex;align-items:center;gap:16px;min-height:76px;padding:16px 20px;border-radius:22px;text-decoration:none;
  background:rgba(255,247,234,.06);box-shadow:inset 0 0 0 1px var(--crema-linea);transition:background-color .2s}
@media (hover:hover){.contacto-via:hover{background:rgba(255,247,234,.11)}.contacto-via:hover .flecha{translate:3px 0}}
.contacto-via > span:nth-child(2){display:grid;gap:2px;min-width:0}
.contacto-via strong{font-size:17px;font-weight:620;letter-spacing:-.015em}
.contacto-via > span:nth-child(2) span{color:var(--crema-2);overflow-wrap:anywhere}
@media (max-width:400px){.contacto-via > span:nth-child(2) span{font-size:13.5px}}
.contacto-icono{flex-shrink:0;width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:rgba(255,247,234,.1)}
.flecha{flex-shrink:0;margin-left:auto;opacity:.7;transition:translate .2s var(--curva)}

/* ---------- pie ---------- */
.pie{background:var(--tinta);color:var(--crema);border-top:1px solid var(--crema-linea)}
.pie-dentro{max-width:var(--ancho);margin:0 auto;padding:36px var(--margen) max(36px,env(safe-area-inset-bottom));
  display:grid;justify-items:start;gap:14px}
.pie-nav{display:flex;flex-wrap:wrap;gap:0 22px}
@media (min-width:760px){.pie-dentro{display:flex;align-items:center;gap:16px 36px}.pie-nav{flex:1}}
.pie-nav a{display:inline-flex;align-items:center;min-height:44px;font-size:14.5px;color:var(--crema-2);text-decoration:none}
@media (hover:hover){.pie-nav a:hover{color:var(--crema)}}
.pie-firma{font-size:13.5px;color:var(--crema-2)}

/* ---------- movimiento ---------- */
@media (prefers-reduced-motion:no-preference){
  .movil{animation:sube 1s var(--curva) 120ms both}
  .movil-aviso{animation:llega .7s var(--curva) 1.2s both}
  @supports (animation-timeline:view()){
    .revela{animation:revela linear both;animation-timeline:view();animation-range:entry 0% entry 70%}
  }
  @supports (animation-timeline:scroll()){
    .cabecera{animation:borde linear both;animation-timeline:scroll(root);animation-range:0 120px}
  }
}
@keyframes sube{from{opacity:0;transform:translateY(36px) scale(.97)}to{opacity:1;transform:none}}
@keyframes llega{from{opacity:0;transform:translateY(-16px) scale(.94)}to{opacity:1;transform:none}}
@keyframes revela{from{opacity:0;translate:0 32px}to{opacity:1;translate:0 0}}
@keyframes borde{to{box-shadow:0 1px 0 var(--linea)}}
`;
