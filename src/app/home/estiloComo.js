import { CONSULTA_MOVIL } from "./consultaMovil";

// ============================================================================
// ESTILO DE «CÓMO FUNCIONA» (ComoFunciona.js)
// ----------------------------------------------------------------------------
// Un recorrido, no una rejilla de cajas: tres columnas sin fondo, cada visual
// flotando sobre el papel y todos apoyados en el mismo suelo (alto fijo, alineados
// por abajo). Bajo cada uno, el número en un círculo; entre número y número, un
// hilo de puntos (el ::after de .cf-marca) que sugiere el camino. Debajo, la banda
// verde del panel, baja y con las cifras en línea.
// En el móvil, los pasos van uno bajo otro: el número a la izquierda y el hilo
// vertical bajando por esa columna.
// Se concatena DESPUÉS de estilo.js y estiloMovil.js; reutiliza .cartel, .caja* y
// .aviso* de estilo.js.
// ============================================================================

export const cssComo = `
.cf-pasos{--hueco:clamp(28px,4vw,56px);--circulo:36px;list-style:none;margin:0;padding:0;display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));column-gap:var(--hueco);row-gap:48px}
.cf-paso{display:flex;flex-direction:column;min-width:0}

/* El suelo común: mismo alto, todo apoyado abajo. La sombra suave los despega del papel. */
.cf-escena{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;height:272px;padding-bottom:6px}
.cf-escena .cartel,.cf-escena .caja,.cf-escena .aviso{box-shadow:0 22px 34px -18px rgba(40,25,10,.38),0 3px 10px rgba(40,25,10,.1)}
.cf-avisos{width:100%}
.cf-avisos .aviso{width:min(272px,100%)}
.cf-escena .caja{width:min(236px,100%)}

/* El número y su hilo de puntos hasta el siguiente: nace a la derecha del círculo y
   llega justo antes del círculo de la columna de al lado. */
.cf-marca{position:relative;display:block;height:var(--circulo);margin-top:30px}
.cf-marca b{display:grid;place-items:center;width:var(--circulo);height:var(--circulo);border-radius:50%;background:var(--marca);
  color:var(--claro);font-size:15px;font-weight:650;font-variant-numeric:tabular-nums}
.cf-paso:not(:last-child) .cf-marca::after{content:"";position:absolute;top:50%;left:calc(var(--circulo) + 10px);
  right:calc(10px - var(--hueco));height:4px;margin-top:-2px;transform-origin:0 50%;
  background:radial-gradient(circle,var(--tinta-3) 1.3px,transparent 1.7px) 0 50% / 10px 4px repeat-x}

.cf-texto{display:grid;gap:8px;align-content:start;margin-top:18px}
.cf-dato{font-size:13px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--marca)}
.cf-texto h3,.cf-banda h3{font-size:clamp(24px,1.1rem + 1vw,32px);line-height:1.1;font-weight:660;letter-spacing:-.04em;text-wrap:balance}
.cf-texto p{max-width:22em;color:var(--tinta-2);line-height:1.5;text-wrap:pretty}

/* La banda del panel: verde, baja y sin hueco. Texto a la izquierda, cifras a la derecha en línea. */
.cf-banda{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px clamp(28px,5vw,72px);
  margin-top:clamp(48px,6vw,72px);padding:clamp(24px,3vw,34px) clamp(24px,4vw,48px);border-radius:28px;background:var(--marca)}
.cf-banda-texto{display:grid;gap:6px}
.cf-banda .cf-dato{color:var(--avena)}
.cf-banda p{max-width:26em;color:var(--claro-2);line-height:1.45;text-wrap:pretty}
.cf-cifras{display:grid;grid-template-columns:repeat(3,auto);margin:0}
.cf-cifras > div{display:grid;gap:6px;padding:0 clamp(16px,2.4vw,32px);border-left:1px solid var(--claro-linea)}
.cf-cifras > div:first-child{padding-left:0;border-left:0}
.cf-cifras > div:last-child{padding-right:0}
.cf-cifras dt{font-size:13px;font-weight:600;line-height:1.25;color:var(--claro-2)}
.cf-cifras dd{margin:0;font-size:clamp(40px,1.6rem + 2vw,56px);line-height:1;font-weight:660;letter-spacing:-.05em;
  font-variant-numeric:tabular-nums;color:var(--claro)}

/* La invitación a probar: sin caja a propósito. */
.cf-pie{display:flex;justify-content:center;margin-top:22px}
.cf-prueba{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 4px;
  font-size:17px;font-weight:620;letter-spacing:-.015em;color:var(--marca);text-decoration:underline;
  text-decoration-thickness:1px;text-underline-offset:5px}
.cf-prueba .flecha{margin-left:0;opacity:1;transition:translate .3s var(--curva)}
@media (hover:hover){.cf-prueba:hover .flecha{translate:4px 0}}

/* Un poco más estrecho: la banda pasa a dos filas antes de apretar las cifras. */
@media (max-width:1000px){
  .cf-banda{grid-template-columns:minmax(0,1fr)}
}

@media ${CONSULTA_MOVIL}{
  .cf-pasos{grid-template-columns:minmax(0,1fr);row-gap:44px}
  /* Número a la izquierda, visual y texto a su derecha; el hilo baja por la columna del número. */
  .cf-paso{display:grid;grid-template-columns:var(--circulo) minmax(0,1fr);column-gap:14px;align-items:start}
  .cf-marca{grid-column:1;grid-row:1 / span 2;margin-top:0;height:auto;align-self:stretch}
  .cf-escena{grid-column:2;grid-row:1;height:auto;min-height:0;align-items:center;justify-content:flex-start;padding:0 0 4px}
  .cf-avisos{align-items:center}
  .cf-texto{grid-column:2;grid-row:2;margin-top:14px}
  .cf-paso:not(:last-child) .cf-marca::after{top:calc(var(--circulo) + 10px);bottom:-34px;left:50%;right:auto;width:4px;height:auto;
    margin:0 0 0 -2px;transform-origin:50% 0;
    background:radial-gradient(circle,var(--tinta-3) 1.3px,transparent 1.7px) 50% 0 / 4px 10px repeat-y}
  .cf-banda{padding:24px 22px;gap:22px;border-radius:24px}
  .cf-cifras{grid-template-columns:repeat(3,minmax(0,1fr))}
  .cf-cifras > div{padding:0 10px}
  .cf-cifras dd{font-size:clamp(30px,10vw,40px)}
  .cf-cifras dt{font-size:12px}
}
@media (prefers-reduced-motion:reduce){.cf-prueba .flecha{transition:none}}
`;
