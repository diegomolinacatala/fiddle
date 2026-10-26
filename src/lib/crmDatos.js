import { listClientes, listEventosDeNegocio, listCampanas, registrosDeTienda, getNegocio } from "./store";
import { perfilesDe, metricas, conteoGrupos, curvaDeVuelta, puenteActivos, repartoCartillas, efectoCampana, telefonosDe, LISTA_GRUPOS, LISTA_ESTADOS } from "./crm";
import { plantillaPublica } from "./plantilla";
import { TIPO_WEB } from "./push/suscripcion";
import { TIPO_GOOGLE } from "./google/pase";

// Los canales de Android (la tarjeta web con sus avisos y Google Wallet); el resto son Pass Type ID de Apple.
const telefonoDe = (passType) => (passType === TIPO_WEB || passType === TIPO_GOOGLE ? "android" : "iphone");

/**
 * Todo lo que pinta el panel del CRM de una tienda, o null si no existe. Lo usan
 * la página (en el servidor, para pintar sin esperar a otra petición) y
 * /api/crm (para recargar tras una campaña o una nota).
 *
 * Los eventos van crudos (con su hora) porque las cuentas que dependen de la
 * hora local —a qué hora viene la gente— hay que hacerlas en el navegador: el
 * servidor vive en UTC y sacaría el café de las 9 a las 7.
 */
// La ventana de historial que ve el panel. Con tope: ver listEventosDeNegocio.
const VENTANA = { dias: 120, limite: 5000 };

export async function datosCrm(slug) {
  const negocio = await getNegocio(slug);
  if (!negocio) return null;

  const [clientes, eventos, campanas, registros] = await Promise.all([
    listClientes(slug),
    listEventosDeNegocio(slug, VENTANA),
    listCampanas(slug),
    registrosDeTienda(slug),
  ]);
  const registrados = new Set(registros.map((r) => r.serial));

  // `instalado` es la fecha de alta en el Wallet, pero quien manda la verdad
  // de "¿se le puede avisar AHORA?" son los registros vivos de Apple.
  const conRegistro = clientes.map((c) => ({
    ...c,
    instalado: c.instalado || (registrados.has(c.serial) ? c.creado : null),
    desinstalado: registrados.has(c.serial) ? null : c.desinstalado,
  }));
  // Todos a la vez: a los que aún no tienen costumbre se les mide con la de la tienda.
  const { perfiles, ritmoTienda } = perfilesDe(conRegistro, negocio);
  // Desde cuándo está TODO el historial. Si se llenó el tope, el día más viejo
  // llega a medias: la Actividad no cuadra caja con él (lib/actividad.js) y las
  // cifras no comparan con un mes que no está entero (metricas).
  const historialCompletoDesde = eventos.length >= VENTANA.limite
    ? eventos.at(-1).ts
    : new Date(Date.now() - VENTANA.dias * 864e5).toISOString();
  const historialDesde = Date.parse(historialCompletoDesde);

  return {
    negocio: {
      slug: negocio.slug, nombre: negocio.nombre, tipo: negocio.tipo, meta: negocio.meta,
      premio: negocio.premio, cartillas: negocio.cartillas ?? null, tema: negocio.tema,
      // Para las observaciones (qué horas son tranquilas DE LAS QUE ABRE).
      horario: negocio.horario ?? null,
      // Sin automáticos ni programados, «Programarles un aviso» no sale.
      avisosAvanzados: negocio.avisosAvanzados === true,
      // Para poner nombre a quién hizo cada movimiento en Actividad (lib/plantilla.js). Sin hashes de PIN.
      plantilla: plantillaPublica(negocio.plantilla),
    },
    metricas: metricas(perfiles, eventos, clientes, Date.now(), { historialDesde }),
    grupos: conteoGrupos(perfiles),
    // Las dos miran el pasado con el historial: solo hasta donde llega entero.
    puente: puenteActivos(conRegistro, perfiles, eventos, negocio, { historialDesde, ritmoTienda }),
    vuelta: curvaDeVuelta(conRegistro, eventos, { historialDesde }),
    cartillas: repartoCartillas(clientes, perfiles, negocio),
    // iPhone o Android: solo las cuentas, nada de quién.
    telefonos: telefonosDe(perfiles, registros.map((r) => ({ serial: r.serial, telefono: telefonoDe(r.pass_type) }))),
    estados: LISTA_ESTADOS,
    catalogoGrupos: LISTA_GRUPOS,
    // Ficha por cliente: lo guardado + lo calculado, ya cruzado.
    clientes: conRegistro.map((c, i) => ({
      serial: c.serial, codigo: c.codigo, nombre: c.nombre, premios: c.premios,
      sellos: c.sellos, sellos2: c.sellos2, guardados: c.guardados, guardados2: c.guardados2,
      creado: c.creado, ultima_visita: c.ultima_visita, origen: c.origen,
      mensaje: c.mensaje, nota: c.nota,
      perfil: perfiles[i],
    })),
    campanas: campanas.map((c) => ({
      id: c.id, grupo: c.grupo, texto: c.texto, creado: c.creado,
      destinatarios: c.destinatarios, avisados: c.avisados,
      ...efectoCampana(c, eventos),
    })),
    eventos,
    historialCompletoDesde,
  };
}
