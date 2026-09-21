// ============================================================================
// APPLE WALLET — contenido del pase (pass.json)
// ----------------------------------------------------------------------------
// Función PURA: estado del cliente + config del negocio -> pass.json. Es la única
// fuente de verdad del aspecto del pase en Apple Wallet. Cada vez que el iPhone
// pide el pase actualizado, se reconstruye desde aquí.
//
// Estilos:  negocio "sellos"     -> storeCard (tarjeta de fidelización)
//           negocio "descuento"  -> coupon    (queda "anulado" al usarse)
//
// Los campos con `changeMessage` son los que generan la notificación en la
// pantalla de bloqueo cuando cambian (p.ej. "Tienes 5 de 8 sellos").
// ============================================================================

const MAX_UBICACIONES = 10; // límite de Apple

/** "#ff5c8a" -> "rgb(255, 92, 138)" (formato que exige pass.json). */
export function hexARgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`Color no válido: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

export const cuponUsado = (cliente) => (cliente.premios || 0) > 0;

/** Nivel de fidelidad (lo usa el estilo "barber"). */
export function nivelDe(premios) {
  if (premios >= 3) return "Oro";
  if (premios >= 1) return "Plata";
  return "Bronce";
}

function camposSellos(cliente, negocio) {
  const faltan = Math.max(0, negocio.meta - cliente.sellos);
  const completa = faltan === 0;

  const header = negocio.tema.estilo === "barber"
    ? [{ key: "nivel", label: "NIVEL", value: nivelDe(cliente.premios || 0), changeMessage: "Subes a nivel %@" }]
    : [{ key: "canjeados", label: "PREMIOS", value: cliente.premios || 0, changeMessage: "Premios canjeados: %@" }];

  // NO hay campo "SELLOS 5 de 8": eso ya lo dicen los círculos de la banda, y
  // gastaba una columna de las pocas que hay (ver camposDelPase).
  //
  // Ojo: el aviso en la pantalla de bloqueo lo dispara un CAMPO que cambia, no
  // la banda (la imagen se actualiza en silencio). Como "PREMIO" cambia con
  // cada sello —"Faltan 3 · café gratis" -> "Faltan 2 · café gratis"— es él
  // quien lleva ahora el changeMessage, y de paso el aviso se lee mejor.
  const premio = {
    key: "premio",
    label: completa ? "PREMIO LISTO" : "PREMIO",
    value: completa ? `¡${negocio.premio}!` : `Faltan ${faltan} · ${negocio.premio}`,
    changeMessage: "%@",
  };

  return { headerFields: header, primaryFields: [], secondaryFields: [premio] };
}

function camposCupon(cliente, negocio) {
  const usado = cuponUsado(cliente);
  return {
    headerFields: [],
    primaryFields: [{ key: "descuento", label: "DESCUENTO", value: negocio.premio }],
    secondaryFields: [
      { key: "estado", label: "ESTADO", value: usado ? "Usado" : "Válido · un uso", changeMessage: "Cupón: %@" },
    ],
  };
}

/** Ubicaciones válidas del negocio en formato Apple (máx. 10). */
export function ubicacionesApple(negocio) {
  return (negocio.ubicaciones || [])
    .filter((u) => Number.isFinite(u?.lat) && Number.isFinite(u?.lng))
    .slice(0, MAX_UBICACIONES)
    .map((u) => ({
      latitude: u.lat,
      longitude: u.lng,
      relevantText: u.texto || `Estás cerca de ${negocio.nombre}. Enseña tu tarjeta en caja.`,
    }));
}

/**
 * Campos del pase (cara y reverso) para un cliente. Exportado aparte de
 * `construirPassJson` para que la VISTA PREVIA del manager pinte exactamente lo
 * mismo que acaba dentro del .pkpass, sin poder desviarse.
 * @returns {{headerFields:object[], primaryFields:object[], secondaryFields:object[], auxiliaryFields:object[], backFields:object[]}}
 */
export function camposDelPase(cliente, negocio) {
  const esCupon = negocio.tipo === "descuento";
  const campos = esCupon ? camposCupon(cliente, negocio) : camposSellos(cliente, negocio);

  // CUÁNTOS CAMPOS CABEN. Cuando el pase lleva banda, iOS mete secundarios y
  // auxiliares en UNA sola fila: con cuatro campos salen cuatro columnas
  // apretadas y el texto se corta. Así que debajo de la banda va lo mínimo:
  // el premio y, si la hay, la promo. Dos columnas como mucho.
  //
  // La promo tiene que estar en la CARA: iOS solo avisa en la pantalla de
  // bloqueo cuando cambia un campo visible; uno del reverso cambia en silencio.
  //
  // El nombre del cliente NO va en el pase: él ya se lo sabe y la tienda lo ve
  // en la caja. Ocupaba una columna de las dos que hay.
  //
  // El MENSAJE del cliente gana a la promo de la tienda: una campaña va dirigida
  // a un grupo ("hace tiempo que no te vemos") y no tendría sentido que la tapara
  // el 2x1 de todos. Es la misma columna del pase, así que solo cabe uno.
  const avisoPersonal = cliente.mensaje || null;
  const auxiliaryFields = avisoPersonal || negocio.promo
    ? [{
        key: "promo",
        label: avisoPersonal ? "PARA TI" : "PROMO",
        value: avisoPersonal || negocio.promo,
        changeMessage: "%@",
      }]
    : [];

  const backFields = [
    { key: "como", label: "Cómo funciona", value: negocio.tema.atras },
    { key: "codigo", label: "Tu código", value: codigoDe(cliente) },
  ];

  return { ...campos, auxiliaryFields, backFields };
}

/** Clave corta del cliente ("K7M"). Los pases antiguos caen a los 3 primeros del serial. */
const codigoDe = (cliente) => cliente.codigo || String(cliente.serial || "").slice(0, 3).toUpperCase();

/**
 * @param {{serial:string, codigo?:string, sellos:number, premios:number, nombre:string|null, auth_token:string}} cliente
 * @param {{slug:string, nombre:string, tipo:string, tema:object, meta:number, premio:string, promo:string|null, ubicaciones?:object[]}} negocio
 * @param {{passTypeId:string, teamId:string, appUrl:string}} opciones
 * @returns {object} pass.json
 */
export function construirPassJson(cliente, negocio, { passTypeId, teamId, appUrl }) {
  if (!cliente?.auth_token || cliente.auth_token.length < 16) {
    throw new Error("El cliente no tiene authenticationToken válido (mín. 16 caracteres)");
  }
  const t = negocio.tema;
  const esCupon = negocio.tipo === "descuento";
  const { backFields, ...cara } = camposDelPase(cliente, negocio);

  const pase = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    serialNumber: cliente.serial,
    organizationName: negocio.nombre,
    description: esCupon ? `Cupón de ${negocio.nombre}` : `Tarjeta de fidelización de ${negocio.nombre}`,
    logoText: negocio.nombre,
    backgroundColor: hexARgb(t.cardBg),
    foregroundColor: hexARgb(t.ink),
    labelColor: hexARgb(t.accent),
    // Actualizaciones: el iPhone se registra aquí y pide el pase nuevo tras cada aviso.
    webServiceURL: `${appUrl}/api/wallet`,
    authenticationToken: cliente.auth_token,
    // Dificulta pasarse el pase por AirDrop/Mensajes (anti-fraude básico).
    sharingProhibited: true,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: `${appUrl}/w/${cliente.serial}`,
        messageEncoding: "iso-8859-1",
        // Debajo del QR: la clave corta que se dice en voz alta en el mostrador.
        altText: codigoDe(cliente),
      },
    ],
    [esCupon ? "coupon" : "storeCard"]: { ...cara, backFields },
  };

  const ubicaciones = ubicacionesApple(negocio);
  if (ubicaciones.length) pase.locations = ubicaciones;
  if (esCupon && cuponUsado(cliente)) pase.voided = true;

  return pase;
}
