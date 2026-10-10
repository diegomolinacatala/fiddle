import { listClientes, listEventosDeNegocio, getNegocio } from "./store";

// La misma ventana de historial que el CRM (lib/crmDatos.js). Con tope: ver listEventosDeNegocio.
const VENTANA = { dias: 120, limite: 5000 };

/**
 * Todo lo que pinta la pestaña Plantilla de una tienda, o null si no existe. Lo
 * usa la página en el servidor: la pantalla llega ya pintada (app/Esqueleto.js
 * mientras tanto). Las cuentas (lib/plantilla.js) se hacen en el navegador con
 * la hora de la tienda, igual que en Clientes.
 *
 * De los clientes solo van el serial, el código y la fecha de alta: para los
 * «estrenos» y para enseñar el código en el registro. Ningún nombre.
 */
export async function datosPlantilla(slug) {
  const negocio = await getNegocio(slug);
  if (!negocio) return null;
  const [clientes, eventos] = await Promise.all([listClientes(slug), listEventosDeNegocio(slug, VENTANA)]);
  return {
    negocio: {
      slug: negocio.slug, nombre: negocio.nombre, tipo: negocio.tipo, tema: negocio.tema,
      horario: negocio.horario ?? null, cartillas: negocio.cartillas ?? null, plantilla: negocio.plantilla,
    },
    clientes: clientes.map((c) => ({ serial: c.serial, codigo: c.codigo, creado: c.creado })),
    eventos,
    // Desde cuándo está TODO el historial (ver crmDatos): un periodo que empiece antes avisa.
    historialCompletoDesde: eventos.length >= VENTANA.limite
      ? eventos.at(-1).ts
      : new Date(Date.now() - VENTANA.dias * 864e5).toISOString(),
  };
}
