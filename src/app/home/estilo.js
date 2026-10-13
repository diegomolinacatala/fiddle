import { PALETA as P } from "./paleta";

// ============================================================================
// ESTILO DE LA WEB DE FIDDLE
// ----------------------------------------------------------------------------
// Los colores de la marca salen de paleta.js (los del iPhone, de iOS). Reparto:
//   papel de fondo, espresso para el texto, verde para el violín y los botones;
//   bandas oscuras en verde (el panel) y espresso (contacto y pie).
//   El punto de los títulos es el sello: camel sobre claro, avena sobre oscuro.
//   La avena nunca va en texto sobre claro (1,6:1).
//
// Movimiento: solo opacidad y desplazamiento. El texto de la portada no se anima:
// tiene que verse aunque el navegador no llegue a correr ni una animación. Las
// entradas al hacer scroll van con animation-timeline: donde no existe, todo se
// ve desde el principio; y con «reducir movimiento», nada se mueve. Los precios,
// no: entran una vez y por tiempo (Aparece.js), sin quedarse a medias.
//
// Lo que solo es del móvil (menú, filas que se deslizan, barra de abajo) está en
// estiloMovil.js; aquí, lo de todas las pantallas.
// ============================================================================

// "#rrggbb" + alfa, para sombras y líneas.
const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

export const css = `
.home{
  --fondo:${P.papel}; --superficie:${P.superficie}; --tinta:${P.espresso}; --tinta-2:${P.vison}; --tinta-3:${P.tintaSuave};
  --linea:${alfa(P.espresso, 0.11)}; --marca:${P.verde}; --marca-encima:${P.verdeEncima}; --acento:${P.camel}; --avena:${P.avena};
  --claro:${P.papel}; --claro-2:${alfa(P.papel, 0.74)}; --claro-linea:${alfa(P.papel, 0.14)};
  --ancho:1120px; --curva:cubic-bezier(.16,1,.3,1);
  /* Con viewport-fit=cover (layout.js), en horizontal el notch se come los lados. */
  --margen:max(clamp(20px,4vw,40px),env(safe-area-inset-left),env(safe-area-inset-right));
  --apple:-apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;
  min-height:100dvh; background:var(--fondo); color:var(--tinta); color-scheme:light;
  font-family:var(--fuente-web),system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:16px; line-height:1.5; overflow-x:clip; -webkit-font-smoothing:antialiased;
  -webkit-text-size-adjust:100%; text-size-adjust:100%; interpolate-size:allow-keywords;
}
.home button{font:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
body:has(.home){background:${P.papel}}
@media (prefers-reduced-motion:no-preference){html:has(.home){scroll-behavior:smooth}}
.home [id]{scroll-margin-top:76px}
.home a{color:inherit;-webkit-tap-highlight-color:transparent}
.home :focus-visible{outline:2px solid var(--tinta);outline-offset:3px;border-radius:6px}
.home .oscuro :focus-visible{outline-color:var(--claro)}
/* Sin especificidad: así cualquier clase de abajo puede darles su margen. */
:where(.home) :where(h1,h2,h3,p){margin:0}

.saltar{position:absolute;left:12px;top:-60px;z-index:100;padding:10px 16px;border-radius:12px;
  background:var(--marca);color:var(--claro)!important;font-weight:600;text-decoration:none}
.saltar:focus{top:10px}

/* ---------- cabecera ---------- */
.cabecera{position:sticky;top:0;z-index:50;background:${alfa(P.papel, 0.82)};
  -webkit-backdrop-filter:saturate(160%) blur(18px);backdrop-filter:saturate(160%) blur(18px);
  box-shadow:0 1px 0 transparent}
.cabecera-dentro{max-width:var(--ancho);margin:0 auto;padding:0 var(--margen);height:64px;
  display:flex;align-items:center;gap:clamp(12px,3vw,32px)}
.cabecera-marca{display:flex;align-items:center;min-height:44px;text-decoration:none;border-radius:10px}
.cabecera-nav{margin-left:auto;display:flex;align-items:center;gap:clamp(4px,2.2vw,28px)}
.cabecera-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 6px;font-size:14.5px;font-weight:500;
  color:var(--tinta-2);text-decoration:none;transition:color .2s}
@media (hover:hover){.cabecera-nav a:hover{color:var(--tinta)}}
.entrar{position:relative;display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 20px;
  border-radius:999px;background:var(--marca);color:var(--claro)!important;font-size:14.5px;font-weight:600;
  text-decoration:none;white-space:nowrap;transition:background-color .2s,transform .15s}
.entrar::before{content:"";position:absolute;inset:-4px}
@media (hover:hover){.entrar:hover{background:var(--marca-encima)}}
.entrar:active{transform:scale(.97)}
/* Lo del móvil (estiloMovil.js) no existe en pantalla ancha. */
.menu,.barra,.indicador{display:none}

/* ---------- comunes ---------- */
.punto{display:inline-block;width:.19em;height:.19em;margin-left:.07em;border-radius:50%;background:var(--acento);vertical-align:baseline}
.oscuro .punto{background:var(--avena)}
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
.boton{background:var(--marca);color:var(--claro)!important}
.boton-suave{border:1px solid ${alfa(P.espresso, 0.2)};color:var(--tinta)}
.boton-claro{background:var(--claro);color:var(--marca)!important}
@media (hover:hover){
  .boton:hover{background:var(--marca-encima)}
  .boton-suave:hover{background:${alfa(P.espresso, 0.05)};border-color:${alfa(P.espresso, 0.3)}}
  .boton-claro:hover{background:#fff}
}
.boton:active,.boton-suave:active{transform:scale(.98)}

/* ---------- portada ---------- */
.portada{max-width:var(--ancho);margin:0 auto;padding:clamp(40px,7vw,88px) var(--margen) clamp(72px,9vw,120px);
  display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(48px,6vw,72px);align-items:center}
.portada-texto{display:grid;gap:22px;justify-items:center;text-align:center}
.portada-texto .entradilla{max-width:30em}
.titular{font-size:clamp(44px,1.3rem + 5.8vw,86px);line-height:.98;font-weight:680;letter-spacing:-.05em;text-wrap:balance}
.acciones{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:10px}
.portada-visual{display:grid;justify-items:center}
@media (min-width:960px){
  .portada{grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);padding-top:64px}
  .portada-texto{justify-items:start;text-align:left}
  .acciones{justify-content:flex-start}
}

/* el móvil que va pasando tarjetas (Carrusel.js) */
.movil{position:relative;margin:0;width:322px;font-family:var(--apple)}
.movil-cuerpo{position:relative;padding:11px;border-radius:56px;background:linear-gradient(150deg,#3b3a35,#141410 45%,#28271f);
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.08),0 60px 90px -40px ${alfa(P.espresso, 0.55)},0 28px 40px -28px ${alfa(P.espresso, 0.35)};
  touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none}
.movil-isla{position:absolute;z-index:2;top:22px;left:50%;width:94px;height:28px;border-radius:20px;background:#000;translate:-50% 0}
.movil-pantalla{height:640px;display:flex;flex-direction:column;overflow:hidden;border-radius:45px;background:#f2f2f7;padding:0 12px;color:#000}
.movil-estado{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;height:54px;padding:6px 20px 0 26px;
  font-size:15px;font-weight:600;letter-spacing:-.01em}
.movil-cartera{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:2px 4px 12px;color:#007aff;font-size:16px}
.movil-mas{display:inline-flex;align-items:center;justify-content:center;gap:3px;width:28px;height:28px;border-radius:50%;background:rgba(0,122,255,.12)}
.movil-mas i{width:4px;height:4px;border-radius:50%;background:currentColor}
.movil-tarjetas{position:relative;flex:1}
.movil-tarjeta{position:absolute;inset:0 0 auto 0;transition:transform .55s var(--curva),opacity .55s var(--curva)}
.movil-tarjeta.activa{transform:none;opacity:1}
.movil-tarjeta.sale{transform:translateX(-112%);opacity:0}
/* Las que esperan se colocan a la derecha sin animar: entran desde ahí. */
.movil-tarjeta.espera{transform:translateX(112%);opacity:0;visibility:hidden;transition:none}
/* Hacia atrás, al revés: la nueva viene de la izquierda y la que sale se va por la derecha. */
.atras > .movil-tarjeta.sale{transform:translateX(112%)}
.atras > .movil-tarjeta.espera{transform:translateX(-112%)}
.movil img{pointer-events:none;-webkit-user-drag:none}
/* Las flechas de los lados: casi no se ven hasta que se buscan (el móvil manda).
   Centradas en el cuerpo del teléfono (662 px de alto). */
.movil-flecha{position:absolute;z-index:4;top:331px;translate:0 -50%;width:44px;height:44px;display:grid;place-items:center;
  padding:0;border:0;border-radius:50%;background:transparent;color:var(--tinta-2);opacity:.38;cursor:pointer;
  transition:opacity .2s,background-color .2s,transform .15s}
.movil-flecha-antes{left:-62px}
.movil-flecha-antes svg{rotate:180deg}
.movil-flecha-despues{right:-62px}
@media (hover:hover){
  .movil:hover .movil-flecha{opacity:.6}
  .movil .movil-flecha:hover{opacity:1;background:${alfa(P.espresso, 0.06)}}
}
.movil-flecha:focus-visible{opacity:1}
.movil-flecha:active{transform:scale(.9);opacity:1}
.movil-qr{display:grid;justify-items:center;gap:8px;padding:16px 18px 18px}
.movil-qr img{padding:4px;background:#fff;border-radius:10px}
.movil-qr span{font-size:13px;font-weight:600;letter-spacing:.18em;opacity:.75}
.movil-aviso{position:absolute;z-index:3;pointer-events:none;left:50%;top:536px;width:calc(100% - 28px);translate:-50% 0}
@media (min-width:1100px){.movil-aviso{left:-84px;width:300px;translate:none}}
.movil-pie{display:grid;justify-items:center;gap:4px;margin-top:22px;font-family:var(--fuente-web),system-ui,sans-serif}
.movil-titulo{font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--tinta)}
.movil-controles{display:flex;align-items:center}
.movil-punto{width:28px;height:44px;display:grid;place-items:center;padding:0;border:0;background:none;cursor:pointer;border-radius:8px}
.movil-punto i{width:7px;height:7px;border-radius:999px;background:${alfa(P.espresso, 0.55)};transition:width .3s var(--curva),background-color .3s}
.movil-punto[aria-current] i{width:22px;background:var(--marca)}
@media (hover:hover){.movil-punto:not([aria-current]):hover i{background:${alfa(P.espresso, 0.8)}}}
.movil-pausa{margin-left:10px;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;cursor:pointer;
  border:1px solid ${alfa(P.espresso, 0.18)};background:none;color:var(--tinta-2)}
@media (hover:hover){.movil-pausa:hover{color:var(--tinta);border-color:${alfa(P.espresso, 0.32)}}}

/* la cinta de tarjetitas entre secciones (Cinta.js, Desfile.js): rellena el hueco
   que antes era solo margen, así que lo de alrededor se aprieta. */
.cinta{--hueco:clamp(14px,1.6vw,22px);position:relative;overflow:hidden;padding:10px 0 30px;cursor:default;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.cinta-pista{display:flex;width:max-content}
.cinta-tanda{display:flex;gap:var(--hueco);padding-right:var(--hueco)}
.cinta-tarjeta{flex-shrink:0;width:300px;zoom:.62}
.cinta-tarjeta article{box-shadow:0 18px 30px -16px rgba(0,0,0,.4),0 2px 8px rgba(0,0,0,.08)!important}
.portada:has(+ .cinta){padding-bottom:clamp(24px,4vw,48px)}
.cinta + .bloque{padding-top:clamp(44px,6vw,84px)}
.bloque:has(+ .cinta){padding-bottom:clamp(36px,5vw,64px)}
@media (max-width:759px){.cinta{--hueco:12px;padding-bottom:24px}.cinta-tarjeta{zoom:.52}}

/* un aviso de la pantalla de bloqueo */
.aviso{display:grid;grid-template-columns:38px minmax(0,1fr);gap:11px;align-items:center;padding:11px 14px 12px 11px;
  border-radius:22px;background:rgba(250,250,250,.88);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
  box-shadow:0 14px 34px -14px ${alfa(P.espresso, 0.36)},0 0 0 .5px ${alfa(P.espresso, 0.08)};font-family:var(--apple);color:#1c1c1e;text-align:left}
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
.paso > h3,.paso > p,.paso-dato{margin-left:28px;margin-right:28px}
.paso > h3{margin-top:4px;font-size:21px;font-weight:620;letter-spacing:-.025em}
.paso > p{margin-top:6px;color:var(--tinta-2);line-height:1.55}
/* El dato grande de cada paso: lo que se tarda o lo que cuesta, que es lo que nos distingue. */
.paso-dato{margin-top:24px;font-size:clamp(30px,1.4rem + 1vw,38px);line-height:1.05;font-weight:680;letter-spacing:-.045em;color:var(--marca)}
.paso-visual{height:236px;display:grid;place-items:center;overflow:hidden}
.paso-cartel{background:linear-gradient(160deg,${P.verdeClaro},${P.verdeHondo})}
.paso-caja{background:linear-gradient(160deg,${P.camelClaro},${P.camelHondo})}
.paso-avisos{background:linear-gradient(160deg,${P.avenaClara},${P.avenaHonda})}
.cartel{display:grid;justify-items:center;gap:10px;width:156px;padding:16px 14px 14px;border-radius:16px;background:${P.crema};color:${P.verde};
  box-shadow:0 18px 30px -16px ${alfa(P.verde, 0.5)};rotate:-4deg}
.cartel img:last-of-type{width:104px;height:104px}
.cartel span{font-size:11.5px;font-weight:650;line-height:1.25;text-align:center;letter-spacing:-.01em}
.caja{display:grid;gap:10px;width:236px;padding:14px;border-radius:20px;background:#fff;font-family:var(--apple);
  box-shadow:0 18px 34px -18px ${alfa(P.espresso, 0.42)}}
.caja-fila{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.caja-fila span{padding:2px 8px;border-radius:7px;background:#f2f2f7;font-size:12px;font-weight:650;letter-spacing:.12em}
.caja-banda{display:block;width:100%;height:auto;border-radius:10px}
.caja-boton{display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:12px;background:var(--marca);color:var(--claro);font-size:15px;font-weight:600}
.avisos{display:grid;gap:8px;width:272px}
.aviso-viejo{opacity:.62;scale:.95}
.montaje{display:flex;align-items:center;gap:18px;margin-top:18px;padding:22px 26px;border-radius:26px;
  background:var(--superficie);box-shadow:0 0 0 1px var(--linea)}
.montaje p{color:var(--tinta-2);line-height:1.55;text-wrap:pretty}
.montaje strong{color:var(--tinta);font-weight:620}
.montaje-icono{flex-shrink:0;width:46px;height:46px;display:grid;place-items:center;border-radius:50%;background:var(--avena);color:var(--marca)}
@media (max-width:400px){.montaje{flex-direction:column;align-items:flex-start;gap:12px;padding:20px}}

/* ---------- bandas oscuras ---------- */
/* Van de lado a lado; lo de dentro, al ancho de las demás. */
.oscuro{color:var(--claro)}
.oscuro .entradilla{color:var(--claro-2)}
.bloque.oscuro{max-width:none;padding-left:0;padding-right:0}
.fondo-verde{background:var(--marca)}
.fondo-espresso{background:var(--tinta)}
.panel-dentro,.contacto-dentro{max-width:var(--ancho);margin:0 auto;padding:0 var(--margen)}

/* ---------- el panel del dueño (Panel.js) ---------- */
.panel{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
@media (min-width:900px){
  .panel{grid-template-columns:repeat(6,minmax(0,1fr))}
  .panel-ancha{grid-column:span 4}
  .panel-estrecha{grid-column:span 2}
  .panel-media{grid-column:span 3}
}
.panel-pieza{display:grid;align-content:start;gap:22px;padding:clamp(20px,2.4vw,28px);border-radius:28px;
  background:${alfa(P.papel, 0.06)};box-shadow:inset 0 0 0 1px var(--claro-linea)}
.panel-texto{display:grid;gap:6px}
.panel-texto h3{font-size:21px;font-weight:620;letter-spacing:-.025em}
.panel-texto p{color:var(--claro-2);line-height:1.5;text-wrap:pretty}
.panel-ui{display:grid;gap:12px;padding:18px;border-radius:20px;background:var(--superficie);color:var(--tinta);
  box-shadow:0 24px 40px -24px rgba(0,0,0,.55)}
.panel-etiqueta{font-size:11px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--tinta-3)}
.panel-cifras{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:6px}
.panel-cifras > div{display:grid;align-content:start;gap:2px;padding:12px;border-radius:14px;background:var(--fondo)}
.panel-cifras strong{font-size:28px;font-weight:660;letter-spacing:-.03em;line-height:1.1;font-variant-numeric:tabular-nums}
.panel-pie{font-size:11.5px;color:var(--tinta-3);line-height:1.3}
@media (max-width:480px){.panel-pie{display:none}.panel-cifras > div{align-content:space-between}}
@media (max-width:400px){
  .panel-cifras{gap:6px}
  .panel-cifras > div{padding:10px 8px}
  .panel-cifras .panel-etiqueta{font-size:10px;letter-spacing:.03em}
  .panel-cifras strong{font-size:24px}
}
.panel-barras{display:flex;align-items:flex-end;gap:3px;height:84px}
.panel-barras i{flex:1;border-radius:3px 3px 1px 1px;background:${alfa(P.vison, 0.45)}}
.panel-barras i.hoy{background:var(--marca)}
.panel-barras i.cerrado{background:${alfa(P.espresso, 0.12)}}
.panel-linea{font-size:13.5px;color:var(--tinta-2)}
.panel-linea strong{color:var(--tinta)}
.panel-mapa{position:relative;display:grid;align-content:end;min-height:270px;padding:14px;border-radius:20px;overflow:hidden;
  background-color:${P.verdeClaro};
  background-image:linear-gradient(35deg,transparent 46%,rgba(255,255,255,.9) 46% 54%,transparent 54%),
    repeating-linear-gradient(90deg,transparent 0 46px,rgba(255,255,255,.75) 46px 54px),
    repeating-linear-gradient(0deg,transparent 0 58px,rgba(255,255,255,.75) 58px 66px)}
.panel-chincheta{position:absolute;left:50%;top:36%;width:18px;height:18px;border-radius:50%;background:var(--marca);translate:-50% -50%;
  box-shadow:0 0 0 5px ${alfa(P.papel, 0.95)},0 0 0 26px ${alfa(P.verde, 0.14)},0 0 0 52px ${alfa(P.verde, 0.07)}}
.panel-grupos{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px}
.panel-grupos span{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;font-size:13px;font-weight:550;
  background:var(--fondo);color:var(--tinta-2);box-shadow:inset 0 0 0 1px var(--linea)}
.panel-grupos .elegido{background:var(--marca);color:var(--claro);box-shadow:none}
.panel-mensaje{padding:12px 14px;border-radius:14px;background:var(--fondo);font-size:14.5px;line-height:1.4}
.panel-enviar{justify-self:start;display:inline-flex;align-items:center;height:40px;padding:0 18px;border-radius:999px;
  background:var(--marca);color:var(--claro);font-size:14px;font-weight:600}
.panel-rejilla{display:grid;gap:3px;align-items:center;margin-bottom:6px}
.panel-fila{display:contents}
.panel-fila span{font-size:11px;font-weight:600;color:var(--tinta-3)}
.panel-fila i{height:16px;border-radius:4px;background:var(--tinta-2)}
.panel-idea{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:var(--fondo);
  font-size:14px;font-weight:600;line-height:1.35}
.panel-idea svg{flex-shrink:0;color:${P.camelOscuro}}
.panel-nota{margin-top:26px;color:var(--claro-2)}
.panel-nota a{color:var(--claro);font-weight:600;text-decoration-thickness:1px;text-underline-offset:3px}

/* ---------- precios ---------- */
.planes{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;max-width:900px;margin:0 auto}
@media (min-width:760px){.planes{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}}
.plan{display:flex;flex-direction:column;padding:clamp(26px,3.5vw,38px);border-radius:32px;background:var(--superficie);
  box-shadow:0 0 0 1px var(--linea)}
.plan-destacado{background:var(--tinta);box-shadow:0 40px 70px -40px ${alfa(P.espresso, 0.6)}}
.plan-cabeza{display:flex;align-items:center;justify-content:space-between;gap:12px}
.plan-cabeza h3{font-size:22px;font-weight:650;letter-spacing:-.03em}
.plan-etiqueta{padding:5px 11px;border-radius:999px;background:var(--avena);color:var(--tinta);font-size:12.5px;font-weight:650;white-space:nowrap}
.plan-lema{margin-top:4px;color:var(--tinta-2)}
.plan-precio{display:flex;align-items:baseline;gap:10px;margin:26px 0 26px}
.plan-cifra{font-size:clamp(52px,2.4rem + 1.6vw,64px);line-height:1;font-weight:660;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.plan-periodo{font-size:16px;color:var(--tinta-3)}
.plan-destacado .plan-lema,.plan-destacado .plan-periodo{color:var(--claro-2)}
.plan-lista{list-style:none;margin:0 0 32px;padding:24px 0 0;display:grid;gap:13px;border-top:1px solid var(--linea);flex:1;align-content:start}
.plan-destacado .plan-lista{border-top-color:var(--claro-linea)}
.plan-lista li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:12px;align-items:start;line-height:1.4}
.plan-lista svg{margin-top:1px;color:var(--acento)}
.plan-destacado .plan-lista svg{color:var(--avena)}
.plan .boton{width:100%}
/* La entrada de los precios (Aparece.js): cada tarjeta sube una vez, la cifra sale
   de debajo de su línea y la lista se escribe de arriba abajo. Nunca transparente
   a medias: el desplazamiento va sin opacidad y lo poco que se funde, se funde
   deprisa y por tiempo. --i es la tarjeta, --j la línea. */
.plan-precio{overflow:hidden;padding-bottom:4px}
@media (prefers-reduced-motion:no-preference){
  [data-aparece=espera] .plan{transform:translateY(44px)}
  [data-aparece=espera] .plan-precio > *{transform:translateY(110%)}
  [data-aparece=espera] .plan-lista li{opacity:0;transform:translateX(-10px)}
  [data-aparece=espera] .plan-etiqueta{opacity:0;transform:scale(.8)}
  [data-aparece=visto] .plan{transition:transform 1.1s var(--curva) calc(var(--i) * 120ms)}
  [data-aparece=visto] .plan-precio > *{transition:transform .9s var(--curva) calc(var(--i) * 120ms + 180ms)}
  [data-aparece=visto] .plan-precio > :last-child{transition-delay:calc(var(--i) * 120ms + 260ms)}
  [data-aparece=visto] .plan-lista li{transition:opacity .35s ease-out,transform .6s var(--curva);
    transition-delay:calc(var(--i) * 120ms + 340ms + var(--j) * 55ms)}
  [data-aparece=visto] .plan-etiqueta{transition:opacity .3s,transform .5s cubic-bezier(.34,1.56,.64,1);transition-delay:.75s}
}
.planes-nota{margin-top:28px;text-align:center;color:var(--tinta-2)}
.planes-nota a{font-weight:600;color:var(--marca);text-decoration-thickness:1px;text-underline-offset:3px}

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
/* Abrir y cerrar sin saltos donde se puede animar hasta «auto»; donde no, como siempre. */
@media (prefers-reduced-motion:no-preference){
  .pregunta::details-content{block-size:0;overflow:hidden;transition:block-size .32s var(--curva),content-visibility .32s allow-discrete}
  .pregunta[open]::details-content{block-size:auto}
}

/* ---------- contacto ---------- */
.contacto-dentro{display:grid;grid-template-columns:minmax(0,1fr);gap:44px;align-items:center}
@media (min-width:900px){.contacto-dentro{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:64px}}
.contacto-texto{display:grid;gap:20px;justify-items:start}
.iniciales{display:flex;margin-bottom:6px}
.iniciales span{width:56px;height:56px;display:grid;place-items:center;border-radius:50%;font-size:21px;font-weight:650;
  color:var(--tinta);box-shadow:0 0 0 3px var(--tinta)}
.iniciales span:first-child{background:var(--avena)}
.iniciales span:last-child{background:var(--claro);margin-left:-12px}
.contacto-acciones{display:grid;gap:12px}
.contacto-via{display:flex;align-items:center;gap:16px;min-height:76px;padding:16px 20px;border-radius:22px;text-decoration:none;
  background:${alfa(P.papel, 0.06)};box-shadow:inset 0 0 0 1px var(--claro-linea);transition:background-color .2s}
@media (hover:hover){.contacto-via:hover{background:${alfa(P.papel, 0.11)}}.contacto-via:hover .flecha{translate:3px 0}}
.contacto-via > span:nth-child(2){display:grid;gap:2px;min-width:0}
.contacto-via strong{font-size:17px;font-weight:620;letter-spacing:-.015em}
.contacto-via > span:nth-child(2) span{color:var(--claro-2);overflow-wrap:anywhere}
@media (max-width:400px){.contacto-via > span:nth-child(2) span{font-size:13.5px}}
.contacto-icono{flex-shrink:0;width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:${alfa(P.papel, 0.1)}}
.flecha{flex-shrink:0;margin-left:auto;opacity:.7;transition:translate .2s var(--curva)}
/* El correo y «Copiar» (Correo.js). Un botón no puede ir dentro del enlace, así que va
   al lado en el código y encima en pantalla, donde las otras filas llevan la flecha:
   así no le quita ancho a la dirección. */
.contacto-correo{position:relative}
.contacto-correo .contacto-via{padding-right:92px}
.contacto-copiar{position:absolute;top:50%;right:12px;translate:0 -50%;display:grid;place-items:center;align-content:center;gap:3px;
  min-width:68px;height:56px;padding:0 8px;border:0;border-radius:16px;cursor:pointer;background:${alfa(P.papel, 0.08)};
  box-shadow:inset 0 0 0 1px var(--claro-linea);color:var(--claro);font-size:12.5px;font-weight:600;transition:background-color .2s}
@media (hover:hover){.contacto-copiar:hover{background:${alfa(P.papel, 0.11)}}}
.solo-lector{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

/* ---------- pie ---------- */
.pie{background:var(--tinta);border-top:1px solid var(--claro-linea)}
.pie-dentro{max-width:var(--ancho);margin:0 auto;padding:36px var(--margen) max(36px,env(safe-area-inset-bottom));
  display:grid;justify-items:start;gap:14px}
.pie-nav{display:flex;flex-wrap:wrap;gap:0 22px}
@media (min-width:760px){.pie-dentro{display:flex;align-items:center;gap:16px 36px}.pie-nav{flex:1}}
.pie-nav a{display:inline-flex;align-items:center;min-height:44px;font-size:14.5px;color:var(--claro-2);text-decoration:none}
@media (hover:hover){.pie-nav a:hover{color:var(--claro)}}
.pie-firma{font-size:13.5px;color:var(--claro-2)}

/* ---------- movimiento ---------- */
@media (prefers-reduced-motion:no-preference){
  .movil{animation:sube 1s var(--curva) 120ms both}
  /* El aviso llega cuando la tarjeta ya está quieta; el primero, tras la entrada del móvil. */
  .movil-aviso{animation:llega .6s var(--curva) .45s both}
  .movil-aviso.primera{animation-delay:1.2s}
  @supports (animation-timeline:view()){
    .revela{animation:revela linear both;animation-timeline:view();animation-range:entry 0% entry 70%}
  }
  @supports (animation-timeline:scroll()){
    .cabecera{animation:borde linear both;animation-timeline:scroll(root);animation-range:0 120px}
  }
}
@media (prefers-reduced-motion:no-preference){
  .cinta-pista.corre{animation:cinta var(--vuelta) linear infinite}
  .cinta-pista.quieta{animation-play-state:paused}
}
@media (prefers-reduced-motion:no-preference) and (hover:hover){.cinta:hover .cinta-pista{animation-play-state:paused}}
/* Una tanda de las --tandas que lleva la pista (Desfile.js). */
@keyframes cinta{to{transform:translate3d(calc(-100% / var(--tandas)),0,0)}}
@media (prefers-reduced-motion:reduce){.movil-tarjeta{transition:none}}
@keyframes sube{from{opacity:0;transform:translateY(36px) scale(.97)}to{opacity:1;transform:none}}
@keyframes llega{from{opacity:0;transform:translateY(-16px) scale(.94)}to{opacity:1;transform:none}}
@keyframes revela{from{opacity:0;translate:0 32px}to{opacity:1;translate:0 0}}
@keyframes borde{to{box-shadow:0 1px 0 var(--linea)}}
`;
