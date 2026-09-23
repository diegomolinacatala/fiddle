import { listClientes, listEventosDeNegocio, listCampanas, serialesRegistrados, getNegocio } from "./store";
import { perfilDe, metricas, conteoGrupos, cohortes, efectoCampana, LISTA_GRUPOS, LISTA_ESTADOS } from "./crm";

/**
 * Todo lo que pinta el panel del CRM de una tienda, o null si no existe. Lo usan
 * la página (en el servidor, para pintar sin esperar a otra petición) y
 * /api/crm (para recargar tras una campaña o una nota).
 *
 * Los eventos van crudos (con su hora) porque las cuentas que dependen de la
 * hora local —a qué hora viene la gente— hay que hacerlas en el navegador: el
 * servidor vive en UTC y sacaría el café de las 9 a las 7.
 */
export async function datosCrm(slug) {
  const negocio = await getNegocio(slug);
  if (!negocio) return null;

  const [clientes, eventos, campanas, registrados] = await Promise.all([
    listClientes(slug),
    listEventosDeNegocio(slug),
    listCampanas(slug),
    serialesRegistrados(slug),
  ]);

  // `instalado` es la fecha de alta en el Wallet, pero quien manda la verdad
  // de "¿se le puede avisar AHORA?" son los registros vivos de Apple.
  const conRegistro = clientes.map((c) => ({
    ...c,
    instalado: c.instalado || (registrados.has(c.serial) ? c.creado : null),
    desinstalado: registrados.has(c.serial) ? null : c.desinstalado,
  }));
  const perfiles = conRegistro.map((c) => perfilDe(c, negocio));

  return {
    negocio: {
      slug: negocio.slug, nombre: negocio.nombre, tipo: negocio.tipo, meta: negocio.meta,
      premio: negocio.premio, cartillas: negocio.cartillas ?? null, tema: negocio.tema,
    },
    metricas: metricas(perfiles, eventos, clientes),
    grupos: conteoGrupos(perfiles),
    cohortes: cohortes(clientes, perfiles),
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
  };
}
