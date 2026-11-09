// Las pestañas de Clientes: aquí y no en PanelCrm para que loading.js las enseñe
// sin cargar el panel entero.
export const PESTANAS = [["resumen", "Resumen"], ["grupos", "Grupos"], ["clientes", "Clientes"], ["actividad", "Actividad"]];

// Las que deja su plan (lib/planes.js): el Resumen son las estadísticas y Grupos va
// con los avisos a un grupo. La lista y la Actividad, siempre. Sin `funciones`, todas.
export const pestanasDe = (funciones) => PESTANAS.filter(([clave]) =>
  (clave !== "resumen" || funciones?.estadisticas !== false) && (clave !== "grupos" || funciones?.grupos !== false));
