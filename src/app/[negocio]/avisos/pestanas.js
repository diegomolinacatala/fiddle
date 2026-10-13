// Las pestañas de Avisos (la tercera: solo con los avanzados encendidos). Aquí y
// no en PanelAvisos para que loading.js las enseñe sin cargar el panel entero.
export const PESTANAS = [["automaticos", "Automáticos", true], ["programados", "Programados", true], ["enviar", "Enviar", false], ["enviados", "Enviados", false]];

export const pestanasDe = (avanzados) => PESTANAS.filter(([, , avanzada]) => avanzados || !avanzada);
export const primeraDe = (avanzados) => (avanzados ? "automaticos" : "enviar");
