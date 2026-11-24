import { CONSULTA_MOVIL } from "./consultaMovil";

// ============================================================================
// EL MOVIMIENTO AL BAJAR (/home)
// ----------------------------------------------------------------------------
// Va el ÚLTIMO en el <style> de page.js y retoca lo anterior. Todo es CSS atado
// al scroll (animation-timeline: view() / scroll()), sin librerías:
//   - el aire entre secciones baja y las entradas empiezan al asomar, no al 70 %;
//   - los titulares se «escriben» (de tono apagado a tinta, de izquierda a derecha);
//   - los pasos de «Así de simple» suben escalonados, su hilo de puntos se dibuja y la banda del panel entra la última;
//   - el móvil de la portada se despide al salir; las barras de La Delicantería
//     crecen; los precios entran como un abanico que se cierra;
//   - una línea de progreso de lectura bajo la cabecera.
// Reglas: solo transform/opacity/translate/scale/rotate/background-position (el
// layout no se mueve) y, para lo que anima el scroll, todo dentro de
// prefers-reduced-motion + @supports: donde no hay soporte (Firefox, Safari
// antiguo) o se pide quietud, la página se ve COMPLETA y quieta. Los rangos van con
// fill «both»: quien llega ya bajado (#precios) ve cada cosa en su sitio.
// Se usan las propiedades `translate`/`scale`/`rotate` y no `transform`, para no
// pisar los :active ni las transiciones que ya llevan transform.
// ============================================================================

// Pantalla ancha: donde los pasos van en tres columnas y los planes, dos columnas.
const ANCHA = "(min-width:760px) and (not ((pointer:coarse) and (max-height:500px)))";

export const cssScroll = `
/* ---------- menos vacío entre secciones ---------- */
.bloque{padding-top:clamp(44px,5.5vw,76px);padding-bottom:clamp(44px,5.5vw,76px)}
.invita{padding-bottom:clamp(56px,7vw,88px)}
@media ${CONSULTA_MOVIL}{.bloque{padding-top:48px;padding-bottom:48px}}

/* La cifra que cuenta (Cuenta.js): el duplicado vivo tapa al real solo mientras cuenta. */
.sc-cuenta,.sc-cuenta b{font:inherit;letter-spacing:inherit}
.sc-cuenta{display:inline-flex}
.sc-cuenta-numero{position:relative;display:inline-block}
.sc-cuenta-viva{position:absolute;left:0;top:0;visibility:hidden}
.sc-cuenta-numero[data-cuenta=espera] .sc-cuenta-real{opacity:0}
.sc-cuenta-numero[data-cuenta=espera] .sc-cuenta-viva{visibility:visible}

/* La línea de progreso, apagada hasta que el navegador sepa atarla al scroll. */
.sc-progreso{display:none}

/* ---------- los precios, como un abanico que se cierra (Aparece.js, por tiempo) ---------- */
@media (prefers-reduced-motion:no-preference) and ${ANCHA}{
  .plan{transform-origin:50% 100%}
  [data-aparece=espera] .plan:nth-child(1){rotate:-7deg;translate:46px 26px}
  [data-aparece=espera] .plan:nth-child(2){translate:0 34px}
  [data-aparece=espera] .plan:nth-child(3){rotate:7deg;translate:-46px 26px}
  [data-aparece=visto] .plan{transition:transform 1.1s var(--curva) calc(var(--i) * 120ms),
    rotate 1.1s var(--curva) calc(var(--i) * 120ms),translate 1.1s var(--curva) calc(var(--i) * 120ms),
    scale 1.1s var(--curva) calc(var(--i) * 120ms)}
}

@media (prefers-reduced-motion:no-preference){
  @supports (animation-timeline:view()){
    /* Que asome y ya aparezca: antes esperaba al 70 % y dejaba pantallas casi vacías. */
    .revela{animation-range:entry 0% entry 35%}

    /* ---------- titulares que se «escriben» al bajar ---------- */
    @supports (color:color-mix(in srgb,red,blue)){
      .titulo-bloque,.invita-titulo{
        --sc-tono:var(--tinta);
        color:transparent;-webkit-background-clip:text;background-clip:text;
        background-image:linear-gradient(90deg,var(--sc-tono) 40%,color-mix(in srgb,var(--sc-tono) 18%,transparent) 60%);
        background-size:250% 100%;background-repeat:no-repeat;
        /* Que el degradado no corte las colas de la g o la p. */
        padding-top:.08em;padding-bottom:.14em;margin-top:-.08em;margin-bottom:-.14em;
        animation:sc-escribe linear both;animation-timeline:view();animation-range:entry 10% cover 42%}
      .oscuro .titulo-bloque{--sc-tono:var(--claro)}
    }

    /* ---------- barras de La Delicantería ---------- */
    .cifra-barra{transform-origin:50% 100%;animation:sc-barra linear both;animation-timeline:view();
      animation-range:entry calc(var(--i,0) * 14%) entry calc(70% + var(--i,0) * 14%)}

    /* ---------- «¿Cómo sería la tuya?» ---------- */
    .invita-titulo{animation-name:sc-escribe,sc-escala;animation-range:entry 10% cover 42%,entry 0% entry 80%}
    .probar{animation:sc-escala linear both;animation-timeline:view();animation-range:entry 20% entry 100%}
  }

  @supports (animation-timeline:view()){
    @media ${ANCHA}{
      /* Los tres pasos suben escalonados (--k), el hilo se dibuja detrás y la banda entra la última. */
      .cf-paso.revela,.cf-banda.revela{animation:sc-sube linear both;animation-timeline:view();
        animation-range:entry calc(var(--k) * 14%) entry calc(42% + var(--k) * 14%)}
      .cf-paso .cf-marca::after{animation:sc-hilo linear both;animation-timeline:view();
        animation-range:entry calc(20% + var(--k) * 14%) entry calc(90% + var(--k) * 6%)}
      .cf-banda .cf-cifras dd{transform-origin:0 100%;animation:sc-zoom linear both;animation-timeline:view();
        animation-range:entry 30% entry 100%}
    }
    /* El móvil de la portada se aleja al salir. Solo cuando está al lado del texto. */
    @media (min-width:960px){
      .portada-visual{transform-origin:50% 40%;animation:sc-despide linear both;animation-timeline:view();
        animation-range:exit 0% exit 100%}
    }
  }

  @supports (animation-timeline:scroll()){
    .sc-progreso{display:block;position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--marca);
      transform-origin:0 50%;pointer-events:none;animation:sc-progreso linear both;animation-timeline:scroll(root)}
  }
}

@keyframes sc-escribe{from{background-position:100% 0}to{background-position:0 0}}
@keyframes sc-sube{from{opacity:0;translate:0 40px}to{opacity:1;translate:0 0}}
@keyframes sc-hilo{from{scale:0 1}to{scale:1 1}}
@keyframes sc-zoom{from{scale:.82}to{scale:1}}
@keyframes sc-barra{from{scale:1 0}to{scale:1 1}}
@keyframes sc-escala{from{opacity:0;scale:.9}to{opacity:1;scale:1}}
@keyframes sc-despide{from{opacity:1;translate:0 0;scale:1}to{opacity:.4;translate:0 -36px;scale:.92}}
@keyframes sc-progreso{from{scale:0 1}to{scale:1 1}}
`;
