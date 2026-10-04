import { camposDelPase } from "../apple/pase";
import { puntosDe, estadoDe } from "../resumen";
import { describirBanda, totalGuardados } from "../cartillas";
import { rutaLogo, rutaBanda } from "../rutasImagen";
import { enlacesDeContacto } from "../contacto";

// ============================================================================
// GOOGLE WALLET — contenido del pase (LoyaltyClass + LoyaltyObject)
// ----------------------------------------------------------------------------
// Funciones PURAS, como `construirPassJson` en Apple. La CLASE es la tienda
// (nombre, logo, color, cómo funciona); el OBJETO es la tarjeta de un cliente
// (sellos, banda, código). Una clase por tienda, un objeto por cliente.
//
// Los textos NO se inventan aquí: salen de `camposDelPase()` y `puntosDe()`, los
// mismos que llenan el pase de Apple y la vista previa del manager. Y la banda
// es la misma imagen, rasterizada al formato ancho de Google (1032x336).
//
// Clase y objeto se mandan ENTEROS (PUT), no a trozos: así lo que ya no aplica
// (una promo retirada, el mensaje de una campaña cuando el cliente ya vino)
// desaparece solo, sin tener que acordarse de borrarlo.
//
// Los MENSAJES son lo único delicado. Para que el teléfono SUENE hay que
// añadirlos con addMessage (tipo TEXT_AND_NOTIFY); si además fueran en el PUT
// saldrían repetidos. Por eso `sin: "<id>"` construye la versión sin ese, que
// es la que se manda justo antes de su addMessage (y `conMensajes: false`, sin
// ninguno).
//
// Los mensajes van en el OBJETO, nunca en la clase: la promo y el "Para ti" son
// promos, y quien dijo que no (`promos_no`) no recibe ninguna. Un mensaje de la
// clase llegaría a todas las tarjetas de la tienda.
// ============================================================================

export const TIPO_GOOGLE = "google";
const IDIOMA = "es-ES";

export const idClase = (issuerId, slug) => `${issuerId}.${slug}`;
export const idObjeto = (issuerId, serial) => `${issuerId}.${serial}`;

const texto = (valor) => ({ defaultValue: { language: IDIOMA, value: String(valor) } });
const imagen = (uri, descripcion) => ({ sourceUri: { uri }, contentDescription: texto(descripcion) });

/** Google solo acepta #rrggbb o #rgb. */
const colorHex = (c, porDefecto) => (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || "")) ? c : porDefecto);

/**
 * El ÚNICO color que Google deja elegir: el fondo de la tarjeta (el texto lo
 * pone Google, blanco o negro según ese fondo). De partida, el color de la
 * tienda; se puede pedir el fondo de la tarjeta de Apple u otro cualquiera.
 */
export function fondoGoogle(tema) {
  if (tema?.google === "tarjeta") return colorHex(tema.cardBg, "#1b1e23");
  if (/^#[0-9a-f]{6}$/i.test(String(tema?.google || ""))) return tema.google;
  return colorHex(tema?.accent, "#1b1e23");
}

/**
 * @param {object} negocio  getNegocio()
 * @param {{issuerId:string, appUrl:string}} opciones
 */
export function construirClase(negocio, { issuerId, appUrl }) {
  const clase = {
    id: idClase(issuerId, negocio.slug),
    issuerName: negocio.nombre,
    programName: negocio.nombre,
    programLogo: imagen(`${appUrl}${rutaLogo(negocio)}`, negocio.nombre),
    hexBackgroundColor: fondoGoogle(negocio.tema),
    reviewStatus: "UNDER_REVIEW",
    countryCode: "ES",
    // Un cliente, todos sus teléfonos. Pasarse la tarjeta a otro no tiene sentido.
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    accountIdLabel: "Código",
    textModulesData: [
      // "Abierto hasta las 18:30": en Apple va dibujado en la banda; Google no deja
      // cambiar su imagen cada hora, así que va el PRIMERO de los detalles. Es de la
      // clase: el reloj lo cambia con una sola llamada para todas las tarjetas.
      ...(negocio.tema?.abierto !== false && negocio.estadoPase ? [{ id: "estado", header: "Ahora", body: negocio.estadoPase }] : []),
      ...(negocio.tema?.atras ? [{ id: "como", header: "Cómo funciona", body: negocio.tema.atras }] : []),
    ],
    // Tiendas físicas: Google enseña la tarjeta al acercarse (como las ubicaciones de Apple).
    merchantLocations: (negocio.ubicaciones || [])
      .filter((u) => Number.isFinite(u?.lat) && Number.isFinite(u?.lng))
      .slice(0, 10)
      .map((u) => ({ latitude: u.lat, longitude: u.lng })),
  };
  // Teléfono, web e Instagram: en Google son botones bajo la tarjeta.
  const enlaces = enlacesDeContacto(negocio.contacto);
  if (enlaces.length) {
    clase.linksModuleData = { uris: enlaces.map((e) => ({ id: e.id, uri: e.uri, description: `${e.etiqueta}: ${e.texto}` })) };
  }
  return clase;
}

/**
 * @param {object} cliente  getCliente()
 * @param {object} negocio  getNegocio()
 * @param {{issuerId:string, appUrl:string, enlaceDatos?:string|null}} opciones
 *   `enlaceDatos`: "Tu tarjeta y tus datos" con su llave (lib/gestion.js, servidor)
 * @param {{conMensajes?: boolean, sin?: string|null}} [modo]
 */
export function construirObjeto(cliente, negocio, { issuerId, appUrl, enlaceDatos = null }, { conMensajes = true, sin = null } = {}) {
  const e = estadoDe(cliente, negocio);
  const puntos = puntosDe(cliente, negocio);
  const codigo = cliente.codigo || String(cliente.serial).slice(0, 3).toUpperCase();
  // El texto del premio es el mismo campo que sale bajo la banda en Apple.
  // Con dos cartillas son dos campos ("Cookies", "Cafés") y van los dos.
  const { primaryFields, secondaryFields, backFields } = camposDelPase(cliente, negocio);
  const principales = [
    // El cupón: QUÉ descuento es (en Apple, el campo grande de la cara).
    ...primaryFields,
    ...(negocio.cartillas ? secondaryFields : secondaryFields.slice(0, 1)),
  ];
  // Del reverso de Apple, lo que es de ESTE cliente o de esta tarjeta y en
  // Google no estaba: sus premios guardados (cuáles, no solo cuántos) y qué se
  // gana con cada cartilla. "Cómo funciona" y el contacto van en la clase; el
  // código, en accountId.
  const delReverso = backFields.filter((f) => f.key === "guardados" || f.key === "premios" || (f.key === "como" && (cliente.borrado_en || cliente.fusionado_en)));

  const objeto = {
    id: idObjeto(issuerId, cliente.serial),
    classId: idClase(issuerId, negocio.slug),
    // Un cupón usado pasa a "caducados", como el pase anulado de Apple.
    // Y una tarjeta borrada (o pasada a otra): Google la aparta igual.
    state: e.usado || cliente.borrado_en || cliente.fusionado_en ? "INACTIVE" : "ACTIVE",
    accountId: codigo,
    // SIN accountName, como en Apple: el nombre lo sabe él y lo ve la caja. En
    // Google, además, se quedaría en una copia que guarda Google. Como el objeto
    // va entero (PUT), el próximo cambio lo borra de las tarjetas que lo llevaban.
    loyaltyPoints: { label: puntos.label, balance: { string: puntos.balance } },
    // Como la cabecera del pase de Apple: los premios guardados, aunque sean 0.
    // Los canjeados de toda la vida no salen en la tarjeta.
    ...(!e.esCupon && !cliente.borrado_en && !cliente.fusionado_en
      ? { secondaryLoyaltyPoints: { label: "Premios guardados", balance: { int: totalGuardados(cliente) } } }
      : {}),
    barcode: { type: "QR_CODE", value: `${appUrl}/w/${cliente.serial}`, alternateText: codigo },
    heroImage: imagen(
      `${appUrl}${rutaBanda(negocio, cliente)}`,
      e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, negocio),
    ),
    textModulesData: [...principales, ...delReverso].map((f) => ({ id: f.key, header: capitalizar(f.label), body: String(f.value) })),
    linksModuleData: {
      uris: [
        { id: "tarjeta", uri: `${appUrl}/p/${cliente.serial}`, description: "Ver la tarjeta en el navegador" },
        // Dejar las promos, descargar sus datos o borrar la tarjeta (docs/RGPD.md, 3.5).
        { id: "datos", uri: enlaceDatos || `${appUrl}/p/${cliente.serial}/datos`, description: "Tu tarjeta y tus datos" },
        // El aviso de privacidad, como al final del reverso de Apple.
        { id: "privacidad", uri: `${appUrl}/privacidad?b=${negocio.slug}`, description: "Privacidad" },
      ],
    },
  };

  // La promo de la tienda y el mensaje de una campaña (que vive en la tarjeta
  // hasta que el cliente vuelve, ver registrarVisita): como "PROMO" y "PARA TI"
  // en Apple. Solo a quien no dijo que no a las promos.
  const mensajes = conMensajes && !cliente.promos_no && !cliente.borrado_en
    ? [
        ...(negocio.promo ? [{ id: "promo", header: "Promo", body: negocio.promo, messageType: "TEXT" }] : []),
        ...(cliente.mensaje ? [{ id: "para-ti", header: "Para ti", body: cliente.mensaje, messageType: "TEXT" }] : []),
      ].filter((m) => m.id !== sin)
    : [];
  if (mensajes.length) objeto.messages = mensajes;
  return objeto;
}

// "PREMIO LISTO" -> "Premio listo": Google no pone las cabeceras en mayúsculas.
const capitalizar = (s) => {
  const t = String(s || "").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Mensaje que hace sonar el teléfono (addMessage). Máximo 3 avisos por pase y día: lo pone Google. */
export const mensajeConAviso = (id, cabecera, cuerpo) => ({
  message: { id, header: cabecera, body: cuerpo, messageType: "TEXT_AND_NOTIFY" },
});
