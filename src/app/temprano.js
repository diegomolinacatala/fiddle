// ============================================================================
// SCRIPTS QUE VAN ANTES DE REACT
// ----------------------------------------------------------------------------
// Chrome avisa UNA vez de que la página se puede instalar (beforeinstallprompt)
// y a veces lo hace antes de que React arranque. Este script en línea lo recoge
// y lo deja en `window.__instalar` para el hook useInstalar (app/instalable.js).
// Módulo aparte, sin "use client": lo importan páginas de servidor.
// ============================================================================

export const CAPTURAR_INSTALAR = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__instalar = e;
  window.dispatchEvent(new Event("instalable"));
});`;

export const REGISTRAR_SW = `
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});`;

// MODO OSCURO (BotonTema): lo elige cada dispositivo y se guarda en él. Se pone
// antes de pintar: si esperase a React, cada carga daría un fogonazo blanco.
// Claro de partida: sin nada guardado, o si el navegador no deja leerlo.
export const CLAVE_TEMA = "fiddle-tema";
export const TEMA_TEMPRANO = `
try { if (localStorage.getItem("${CLAVE_TEMA}") === "oscuro") document.documentElement.dataset.tema = "oscuro"; } catch (e) {}`;
