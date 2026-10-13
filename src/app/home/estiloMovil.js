import { PALETA as P } from "./paleta";
import { CONSULTA_MOVIL } from "./consultaMovil";

// ============================================================================
// LA WEB DE FIDDLE EN EL MÓVIL (/home, hasta 759 px)
// ----------------------------------------------------------------------------
// Casi todas las cafeterías la abren desde el móvil (el QR del cartel, un enlace
// por WhatsApp). La misma página, ordenada para el pulgar:
// - Cabecera corta: logo, «Entrar» y el menú (Menu.js). Las secciones van ahí.
// - Lo que en ancho va en columnas, aquí es una fila que se desliza (pasos,
//   panel, precios) con sus pestañas o puntos (Indicador.js). La página queda en
//   la mitad de alto y asoma la siguiente tarjeta: se ve que hay más.
// - WhatsApp siempre a mano, abajo (BarraMovil.js), salvo arriba del todo y al
//   final, donde ya se ve.
// - Toques de 44 px como poco, nada pegado al borde (ni al notch: --margen) y
//   letra de 16 px o más en lo que se lee.
// También un móvil en horizontal (ancho de tableta pero 400 de alto y dedo): con
// la de ordenador, el título solo ya llenaba la pantalla.
// Probada de 320 a 430 px de ancho, y en horizontal.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

// Alto de la cabecera en el móvil: el menú se abre justo debajo.
const CABECERA = 60;

export const cssMovil = `
@media ${CONSULTA_MOVIL}{
  /* ---------- cabecera y menú ---------- */
  .cabecera-dentro{height:${CABECERA}px;gap:8px}
  .cabecera-nav{display:none}
  .entrar{margin-left:auto;height:38px;padding:0 16px;font-size:14.5px}
  html.menu-abierto{overflow:hidden}
  html.menu-abierto .cabecera{background:var(--fondo);box-shadow:0 1px 0 var(--linea)}
  .menu{display:block}
  .menu-boton{position:relative;width:44px;height:44px;margin-right:-8px;display:grid;place-items:center;padding:0;border:0;
    border-radius:12px;background:none;color:var(--tinta);cursor:pointer}
  .menu-boton span{position:absolute;left:12px;right:12px;height:2px;border-radius:2px;background:currentColor;
    transition:transform .3s var(--curva)}
  .menu-boton span:first-child{transform:translateY(-4px)}
  .menu-boton span:last-child{transform:translateY(4px)}
  .menu-boton[aria-expanded=true] span:first-child{transform:rotate(45deg)}
  .menu-boton[aria-expanded=true] span:last-child{transform:rotate(-45deg)}
  /* Colgados de la cabecera (sticky, así que hace de caja en cualquier navegador):
     top:100% es justo debajo, y la página no se mueve mientras están abiertos. */
  .menu-fondo{position:absolute;left:0;right:0;top:100%;height:100vh;height:100dvh;background:${alfa(P.espresso, 0.34)};
    opacity:0;pointer-events:none;transition:opacity .25s}
  .menu-fondo.visto{opacity:1;pointer-events:auto}
  .menu-caja{position:absolute;left:0;right:0;top:100%;max-height:calc(100vh - ${CABECERA}px);max-height:calc(100dvh - ${CABECERA}px);
    overflow-y:auto;overscroll-behavior:contain;
    padding:4px var(--margen) max(22px,env(safe-area-inset-bottom));background:var(--fondo);border-radius:0 0 28px 28px;
    box-shadow:0 34px 50px -30px ${alfa(P.espresso, 0.5)};
    opacity:0;visibility:hidden;transform:translateY(-10px);transition:opacity .18s,transform .22s var(--curva),visibility 0s .22s}
  .menu-caja.visto{opacity:1;visibility:visible;transform:none;transition:opacity .22s,transform .35s var(--curva)}
  .menu-caja ul{list-style:none;margin:0;padding:0}
  .menu-caja li + li{border-top:1px solid var(--linea)}
  .menu-caja li a{display:flex;align-items:center;justify-content:space-between;min-height:58px;font-size:20px;font-weight:620;
    letter-spacing:-.025em;text-decoration:none}
  .menu-caja li a svg{color:var(--tinta-3)}
  .menu-caja li a:active{color:var(--marca)}
  .menu-pie{padding-top:14px}
  .menu-pie .boton{width:100%}

  /* ---------- portada ---------- */
  .portada{padding-top:28px;gap:34px}
  .portada-texto{gap:16px}
  .antetitulo{font-size:14px}
  .titular{font-size:clamp(40px,11.6vw,58px);line-height:1}
  .acciones{display:grid;width:100%;max-width:420px;gap:10px;margin-top:8px}
  .acciones a{width:100%}
  /* El teléfono, más pequeño y algo más corto: la tarjeta cabe igual y la
     portada no se hace eterna. Las flechas, en el hueco de los lados. */
  .movil{zoom:.84}
  .movil-pantalla{height:600px}
  .movil-aviso{top:496px}
  /* Con el zoom todo encoge: flechas, puntos y pausa se agrandan para seguir
     rondando los 44 px de dedo. Sin ratón no hay «pasar por encima»: un punto más
     visibles que en el ordenador. */
  .movil-flecha{top:311px;width:52px;height:52px;opacity:.6}
  .movil-flecha-antes{left:-60px}
  .movil-flecha-despues{right:-60px}
  .movil-punto{width:32px;height:52px}
  .movil-pausa{position:relative}
  .movil-pausa::before{content:"";position:absolute;inset:-9px}
  /* El desenfoque del aviso, cada 2 s sobre una tarjeta que se mueve: en un
     Android modesto es lo que más cuesta. Opaco se ve igual. */
  .movil-aviso .aviso{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(250,250,250,.97)}
  .movil-pie{margin-top:16px}
  .movil-titulo{font-size:17px}

  /* ---------- secciones ---------- */
  .bloque{padding-top:60px;padding-bottom:60px}
  .encabezado{gap:12px;margin-bottom:26px}
  .titulo-bloque{font-size:clamp(33px,9.4vw,42px)}
  .entradilla{font-size:17px}

  /* ---------- filas que se deslizan (pasos, panel, precios) ---------- */
  .pasos,.panel,.planes{display:flex;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;
    position:relative;max-width:none;margin:0 calc(-1 * var(--margen));padding:4px var(--margen) 30px;
    scroll-padding-inline:var(--margen);scrollbar-width:none}
  .pasos::-webkit-scrollbar,.panel::-webkit-scrollbar,.planes::-webkit-scrollbar{display:none}
  .pasos > *,.panel > *,.planes > *{flex:0 0 min(86%,380px);scroll-snap-align:start;scroll-snap-stop:always}
  /* Los pasos y el panel miden casi lo mismo y quedan mejor iguales; los planes no:
     estirado, Tarjetas quedaba con un hueco vacío entre la lista y el botón. */
  .planes{align-items:flex-start}
  /* Las entradas con el scroll miden la página; dentro de una fila que se mueve de
     lado se quedarían a medias. */
  .pasos .revela,.panel .revela{animation:none}

  .indicador{display:flex;justify-content:center}
  .indicador-puntos{margin-top:-16px}
  .indicador-puntos button{width:32px;height:44px;display:grid;place-items:center;padding:0;border:0;background:none;cursor:pointer}
  .indicador-puntos i{width:7px;height:7px;border-radius:99px;background:${alfa(P.espresso, 0.3)};
    transition:width .3s var(--curva),background-color .3s}
  .indicador-puntos [aria-current] i{width:22px;background:var(--marca)}
  /* Pestañas como un selector de iOS: todo el ancho, a partes iguales. */
  .indicador-pestanas{width:100%;max-width:440px;margin:0 auto 14px;gap:4px;padding:4px;border-radius:16px;
    background:${alfa(P.espresso, 0.06)}}
  .indicador-pestanas button{flex:1;min-width:0;min-height:42px;padding:0 6px;border:0;border-radius:12px;background:none;
    color:var(--tinta-2);font-size:14.5px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;cursor:pointer;
    transition:background-color .2s,color .2s,box-shadow .2s}
  .indicador-pestanas [aria-current]{background:var(--superficie);color:var(--tinta);box-shadow:0 1px 2px ${alfa(P.espresso, 0.12)},0 2px 8px ${alfa(P.espresso, 0.06)}}
  .oscuro .indicador-pestanas{background:${alfa(P.papel, 0.1)}}
  .oscuro .indicador-pestanas button{color:var(--claro-2)}
  .oscuro .indicador-pestanas [aria-current]{background:var(--claro);color:var(--marca);box-shadow:none}

  /* pasos */
  .paso-visual{height:200px}
  .paso > h3,.paso > p,.paso-dato{margin-left:22px;margin-right:22px}
  .paso-dato{margin-top:20px}
  .paso{padding-bottom:24px}
  .montaje{margin-top:8px}

  /* panel */
  .panel-pieza{padding:18px;gap:18px;border-radius:24px}
  .panel-ui{padding:14px}
  .panel-mapa{min-height:236px}
  .panel-nota{margin-top:6px}

  /* precios */
  .planes{padding-bottom:44px}
  .plan{padding:24px 22px}
  .plan-precio{margin:18px 0 20px}
  .plan-lista{gap:11px;margin-bottom:26px;padding-top:20px}
  .planes-nota{margin-top:4px}

  /* preguntas */
  .pregunta summary{padding:18px 0;font-size:17px}
  .pregunta p{padding-right:8px}

  /* contacto y pie: el pie deja sitio a la barra de abajo */
  .contacto-dentro{gap:32px}
  .iniciales span{width:50px;height:50px;font-size:19px}

  /* ---------- la barra de abajo (BarraMovil.js) ---------- */
  .barra{display:block;position:fixed;z-index:40;left:0;right:0;bottom:0;
    padding:10px var(--margen) max(10px,env(safe-area-inset-bottom));
    background:${alfa(P.papel, 0.86)};-webkit-backdrop-filter:saturate(160%) blur(18px);backdrop-filter:saturate(160%) blur(18px);
    box-shadow:0 -1px 0 var(--linea);transform:translateY(110%);transition:transform .32s var(--curva)}
  .barra.vista{transform:none}
  html.menu-abierto .barra{transform:translateY(110%)}
  html:has(.barra.vista){scroll-padding-bottom:84px}
  .barra .boton{display:flex;width:100%;max-width:480px;min-height:50px;margin:0 auto}
}
/* En horizontal el alto es oro: la barra, más fina. */
@media (pointer:coarse) and (max-height:500px){
  .barra{padding-top:6px;padding-bottom:max(6px,env(safe-area-inset-bottom))}
  .barra .boton{min-height:44px}
}

/* Móviles pequeños (iPhone SE, Android de 360): un poco menos de todo. */
@media (max-width:379px){
  .movil{zoom:.76}
  .titular{font-size:clamp(36px,11.4vw,44px)}
  .indicador-pestanas button{font-size:13.5px}
  .plan{padding:22px 18px}
}
@media (max-width:339px){
  .movil{zoom:.7}
  .entrar{padding:0 13px}
}
`;
