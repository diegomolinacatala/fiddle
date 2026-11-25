import { PALETA as P } from "@/app/home/paleta";

// ============================================================================
// EL CRISTAL DE LOS PRIMEROS PASOS (va lo último: manda sobre los estilos de cada paso)
// ----------------------------------------------------------------------------
// El toque de las pantallas de Apple: superficies de vidrio esmerilado sobre un
// fondo de color que se mueve despacio. Para que el cristal se note tiene que haber
// algo de color detrás que difuminar: son manchas del color de la tienda (--tono, el
// de la tarjeta, y --tono-2, su acento) más el verde de fiddle, por toda la página,
// también bajo el panel. Sin ellas el vidrio sobre el papel es solo crema.
//
// Tres recetas, siempre las mismas:
//   cristal       el panel: mucho desenfoque, borde de luz arriba y sombra larga
//   cristal fino  lo que se toca dentro (opciones, chips, campos): blanco a medias,
//                 un filo de luz y relieve; sin desenfoque propio (el panel ya lo
//                 tiene, y veinte desenfoques en un móvil se notan)
//   píldora       la cabecera (logo y «Terminar luego"), que flota sobre la escena
//
// Con «reducir transparencia» o sin backdrop-filter, todo opaco: el texto no puede
// depender de lo que pase por detrás. Con «reducir movimiento», el fondo quieto.
// ============================================================================

const alfa = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

const BLANCO = (a) => `rgba(255,255,255,${a})`;
// Un filo de luz arriba y un contorno blanco: lo que hace que el vidrio parezca vidrio.
const FILO = `inset 0 1px 0 ${BLANCO(0.9)},inset 0 0 0 1px ${BLANCO(0.55)}`;
const RELIEVE = `0 1px 2px ${alfa(P.espresso, 0.06)},0 8px 18px -12px ${alfa(P.espresso, 0.28)}`;

const FONDO = `
/* ---------- el color de detrás: manchas que derivan despacio ---------- */
.pp .prob-halo{overflow:hidden}
.pp .prob-halo::before,.pp .prob-halo::after{content:"";position:absolute;inset:-20%;pointer-events:none;will-change:transform}
.pp .prob-halo::before{
  background:
    radial-gradient(38% 30% at 18% 78%,color-mix(in oklab,var(--tono) 38%,transparent),transparent 70%),
    radial-gradient(34% 28% at 86% 20%,color-mix(in oklab,var(--tono-2) 30%,transparent),transparent 70%);
  animation:pp-deriva 22s ease-in-out infinite alternate}
.pp .prob-halo::after{
  background:
    radial-gradient(30% 26% at 72% 84%,${alfa(P.verde, 0.22)},transparent 70%),
    radial-gradient(26% 22% at 30% 24%,color-mix(in oklab,var(--tono) 22%,transparent),transparent 70%);
  animation:pp-deriva-2 28s ease-in-out infinite alternate}
@keyframes pp-deriva{to{transform:translate3d(6%,-5%,0) scale(1.08)}}
@keyframes pp-deriva-2{to{transform:translate3d(-7%,4%,0) scale(1.1)}}
.prob-quieto.pp .prob-halo::before,.prob-quieto.pp .prob-halo::after{animation:none}
@media (prefers-reduced-motion:reduce){.pp .prob-halo::before,.pp .prob-halo::after{animation:none}}
`;

const PANEL = `
/* ---------- el panel: el cristal grande ---------- */
.pp .exp-panel{
  background:linear-gradient(165deg,${BLANCO(0.74)},${BLANCO(0.5)});
  -webkit-backdrop-filter:blur(34px) saturate(190%);backdrop-filter:blur(34px) saturate(190%);
  box-shadow:${FILO},0 40px 80px -36px ${alfa(P.espresso, 0.4)},0 2px 8px ${alfa(P.espresso, 0.05)}}
/* Un reflejo suave arriba a la izquierda, como la luz sobre un vidrio. */
.pp .exp-panel::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;
  background:radial-gradient(120% 60% at 0% 0%,${BLANCO(0.55)},transparent 55%)}
.pp .exp-panel > *{position:relative;z-index:1}
@media (max-width:899.98px) and (orientation:portrait){
  .pp .exp-panel{box-shadow:${FILO},0 -18px 40px -24px ${alfa(P.espresso, 0.3)}}
}

/* ---------- la cabecera: píldoras de cristal sobre la escena ---------- */
.pp .prob-volver,.pp .exp-entrar{
  background:linear-gradient(170deg,${BLANCO(0.7)},${BLANCO(0.42)});
  -webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);
  box-shadow:${FILO},0 6px 18px -10px ${alfa(P.espresso, 0.35)};color:var(--tinta)}
.pp .exp-entrar{font-weight:600}
/* Lo que flota en la escena: las cajas de los grupos (Clientes) y «Otra vez» (QR). */
.pp :is(.pp-cli-caja,.pp-qr-otra){
  background:linear-gradient(170deg,${BLANCO(0.66)},${BLANCO(0.36)});
  -webkit-backdrop-filter:blur(14px) saturate(170%);backdrop-filter:blur(14px) saturate(170%);
  box-shadow:${FILO},0 14px 30px -18px ${alfa(P.espresso, 0.35)}}
@media (hover:hover){.pp .exp-entrar:hover{background:${BLANCO(0.85)}}}
`;

// Lo que se toca dentro del panel, con su estado de elegido (si no, el filo lo pisaría).
const FINO = `
.pp :is(.prob-opcion,.pp-tarjeta-chip,.pp-pro-chip,.pp-cli-opcion,.pp-tarjeta-fila,.pp-hor-resumen,.pp-qr-accion,.pp-hora-boton,.pp-hor-dia[aria-pressed="false"]){
  background:linear-gradient(170deg,${BLANCO(0.82)},${BLANCO(0.56)});box-shadow:${FILO},${RELIEVE}}
.pp :is(.prob-nombre input,.pp-pro-entrada input){
  background:${BLANCO(0.8)};box-shadow:inset 0 1px 2px ${alfa(P.espresso, 0.08)},inset 0 0 0 1px ${BLANCO(0.7)}}
.pp :is(.prob-nombre input,.pp-pro-entrada input):focus{background:${BLANCO(0.95)};box-shadow:inset 0 0 0 2px var(--tinta)}
.pp .prob-segmentos{background:${alfa(P.espresso, 0.06)};box-shadow:inset 0 1px 2px ${alfa(P.espresso, 0.08)}}
.pp .prob-segmentos-pildora{background:linear-gradient(170deg,#fff,${BLANCO(0.82)});box-shadow:${FILO},${RELIEVE}}

/* elegido: el contorno de siempre, ahora sobre el vidrio */
.pp .prob-opcion[aria-checked="true"],.pp .pp-tarjeta-chip[aria-pressed="true"],.pp .pp-pro-chip[aria-pressed="true"]{
  background:${BLANCO(0.95)};box-shadow:inset 0 0 0 2px var(--tinta),0 12px 24px -14px ${alfa(P.espresso, 0.5)}}
.pp .pp-cli-opcion[aria-checked="true"]{background:${BLANCO(0.95)};box-shadow:inset 0 0 0 2px var(--g),0 12px 24px -14px ${alfa(P.espresso, 0.45)}}
.pp .pp-tarjeta-fila[aria-checked="true"]{background:${BLANCO(0.92)};box-shadow:inset 0 0 0 1.5px var(--marca),0 12px 24px -16px ${alfa(P.espresso, 0.5)}}
/* el día abierto: oscuro, con brillo de botón */
.pp .pp-hor-dia[aria-pressed="true"]{background:linear-gradient(180deg,${BLANCO(0.14)},transparent 60%),var(--tinta);
  box-shadow:inset 0 1px 0 ${BLANCO(0.22)},0 6px 14px -8px ${alfa(P.espresso, 0.6)}}
`;

const BOTON = `
/* ---------- el botón principal: verde con brillo de cristal ---------- */
.pp .exp-principal{
  background:linear-gradient(180deg,${BLANCO(0.2)},${BLANCO(0)} 55%),var(--marca);
  box-shadow:inset 0 1px 0 ${BLANCO(0.3)},inset 0 -1px 0 ${alfa("#000000", 0.18)},0 14px 28px -14px ${alfa(P.verde, 0.75)};
  transition:transform .3s var(--muelle),box-shadow .3s var(--curva),filter .2s}
@media (hover:hover){.pp .exp-principal:hover{filter:brightness(1.08)}}
.pp .exp-principal:active{transform:scale(.97);box-shadow:inset 0 1px 0 ${BLANCO(0.2)},0 6px 14px -10px ${alfa(P.verde, 0.7)}}
.pp .exp-principal:disabled{filter:saturate(.6);opacity:.7}
.pp .pp-hola-icono{box-shadow:inset 0 1px 0 ${BLANCO(0.7)}}
`;

const SIN_CRISTAL = `
/* ---------- sin cristal: opaco y legible ---------- */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .pp .exp-panel{background:${P.superficie}}
  .pp .prob-volver,.pp .exp-entrar{background:${P.superficie}}
}
@media (prefers-reduced-transparency:reduce){
  .pp :is(.exp-panel,.prob-volver,.exp-entrar,.pp-cli-caja,.pp-qr-otra){background:${P.superficie};-webkit-backdrop-filter:none;backdrop-filter:none}
  .pp .exp-panel::before,.pp .prob-halo::before,.pp .prob-halo::after{display:none}
}
`;

export const cssCristal = FONDO + PANEL + FINO + BOTON + SIN_CRISTAL;
