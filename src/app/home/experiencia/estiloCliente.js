// ============================================================================
// EL CLIENTE: su sitio en la escena y cómo se mueve
// ----------------------------------------------------------------------------
// Entra solo en la prueba (transform + opacity). En reposo está vivo muy poco:
// respira, parpadea y el brazo flota. Cuando llega un aviso (`.suena-0` / `.suena-1`,
// dos nombres para la misma animación: así se reinicia sin remontar) el móvil
// vibra, la pantalla se enciende y él lo mira y sonríe más; dura ~1,3 s.
// Solo transform y opacity. Con «reducir movimiento» (.prob-quieto), quieto.
// ============================================================================

const alerta = (i) => `
.suena-${i} .cli-movil{animation:cli-vibra-${i} .6s linear both}
.suena-${i} .cli-pantalla{animation:cli-enciende-${i} 1.2s ease-out both}
.suena-${i} .cli-cabeza{animation:cli-mira-${i} 1.4s ease-in-out both}
.suena-${i} .cli-ojos{animation:cli-ojos-${i} 1.4s ease-in-out both}
.suena-${i} .cli-cejas{animation:cli-cejas-${i} 1.4s ease-in-out both}
.suena-${i} .cli-boca{animation:cli-sonrie-${i} 1.4s ease-in-out both}
@keyframes cli-vibra-${i}{0%,100%{transform:none}10%{transform:translate(-2px,0) rotate(-4deg)}20%{transform:translate(2px,1px) rotate(4deg)}
  30%{transform:translate(-2px,0) rotate(-3deg)}40%{transform:translate(2px,1px) rotate(3deg)}50%{transform:translate(-1px,0) rotate(-2deg)}65%{transform:translate(1px,0) rotate(1.5deg)}}
@keyframes cli-enciende-${i}{0%{opacity:0}12%{opacity:.55}100%{opacity:0}}
@keyframes cli-mira-${i}{0%,100%{transform:none}22%,72%{transform:rotate(5deg) translate(2px,3px)}}
@keyframes cli-ojos-${i}{0%,100%{transform:none}22%,72%{transform:translate(3px,4px)}}
@keyframes cli-cejas-${i}{0%,100%{transform:none}22%,72%{transform:translateY(-3px)}}
@keyframes cli-sonrie-${i}{0%,100%{transform:none}22%,72%{transform:scale(1.2,1.5)}}`;

export const cssCliente = `
.exp-cliente{position:absolute;z-index:2;pointer-events:none;bottom:0;left:72%;height:62%;aspect-ratio:4/5;translate:-50% 0;
  opacity:0;transform:translateY(36px);transition:transform .22s cubic-bezier(.4,0,1,1),opacity .18s}
.exp-cliente.presente{opacity:1;transform:none;transition:transform .6s var(--curva) .12s,opacity .35s .12s}
.exp-cliente svg{display:block;width:100%;height:100%;overflow:visible}
.cli-cuerpo,.cli-cabeza,.cli-ojos,.cli-cejas,.cli-boca,.cli-ojo,.cli-movil{transform-box:fill-box}
.cli-cuerpo{transform-origin:50% 100%;animation:cli-respira 4.2s ease-in-out infinite alternate}
.cli-cabeza{transform-origin:50% 100%}
.cli-ojo,.cli-boca,.cli-movil{transform-origin:50% 50%}
.cli-ojo{animation:cli-parpadea 5.4s infinite}
.cli-brazo{animation:cli-flota 3.4s ease-in-out infinite alternate}
@keyframes cli-respira{to{transform:scaleY(1.018)}}
@keyframes cli-parpadea{0%,91%,100%{transform:none}95%{transform:scaleY(.1)}}
@keyframes cli-flota{to{transform:translateY(-3px)}}
${alerta(0)}
${alerta(1)}

/* pantalla ancha: más grande, a la derecha de la tarjeta */
@media (min-width:900px){.exp-cliente{left:70%;height:min(64%,560px)}}
/* móvil bajo: cliente y tarjeta, más pequeños */
@media (max-width:899.98px) and (max-height:640px){.exp-cliente{left:74%;height:60%}}
/* móvil en horizontal: la escena es estrecha */
@media (max-width:899.98px) and (orientation:landscape){.exp-cliente{left:72%;height:56%}}

.prob-quieto .exp-cliente,.prob-quieto .exp-cliente *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.exp-cliente,.exp-cliente *{animation:none!important;transition:none!important}}
`;
