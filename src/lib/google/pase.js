import { camposDelPase } from "../apple/pase";
import { puntosDe, estadoDe } from "../resumen";
import { describirBanda, totalGuardados } from "../cartillas";
import { rutaLogo, rutaBanda } from "../rutasImagen";

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
// saldrían repetidos. Por eso `conMensajes: false` construye la versión sin
// ellos, que es la que se manda justo antes de un addMessage.
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
 * @param {object} negocio  getNegocio()
 * @param {{issuerId:string, appUrl:string}} opciones
 * @param {{conMensajes?: boolean}} [modo]
 */
export function construirClase(negocio, { issuerId, appUrl }, { conMensajes = true } = {}) {
  const clase = {
    id: idClase(issuerId, negocio.slug),
    issuerName: negocio.nombre,
    programName: negocio.nombre,
    programLogo: imagen(`${appUrl}${rutaLogo(negocio)}`, negocio.nombre),
    hexBackgroundColor: colorHex(negocio.tema?.accent, "#1b1e23"),
    reviewStatus: "UNDER_REVIEW",
    countryCode: "ES",
    // Un cliente, todos sus teléfonos. Pasarse la tarjeta a otro no tiene sentido.
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    accountIdLabel: "Código",
    accountNameLabel: "Nombre",
    textModulesData: negocio.tema?.atras ? [{ id: "como", header: "Cómo funciona", body: negocio.tema.atras }] : [],
    // Tiendas físicas: Google enseña la tarjeta al acercarse (como las ubicaciones de Apple).
    merchantLocations: (negocio.ubicaciones || [])
      .filter((u) => Number.isFinite(u?.lat) && Number.isFinite(u?.lng))
      .slice(0, 10)
      .map((u) => ({ latitude: u.lat, longitude: u.lng })),
  };
  if (conMensajes && negocio.promo) {
    clase.messages = [{ id: "promo", header: "Promo", body: negocio.promo, messageType: "TEXT" }];
  }
  return clase;
}

/**
 * @param {object} cliente  getCliente()
 * @param {object} negocio  getNegocio()
 * @param {{issuerId:string, appUrl:string}} opciones
 * @param {{conMensajes?: boolean}} [modo]
 */
export function construirObjeto(cliente, negocio, { issuerId, appUrl }, { conMensajes = true } = {}) {
  const e = estadoDe(cliente, negocio);
  const puntos = puntosDe(cliente, negocio);
  const codigo = cliente.codigo || String(cliente.serial).slice(0, 3).toUpperCase();
  // El texto del premio es el mismo campo que sale bajo la banda en Apple.
  // Con dos cartillas son dos campos ("Cookies", "Cafés") y van los dos.
  const { secondaryFields } = camposDelPase(cliente, negocio);
  const principales = negocio.cartillas ? secondaryFields : secondaryFields.slice(0, 1);

  const objeto = {
    id: idObjeto(issuerId, cliente.serial),
    classId: idClase(issuerId, negocio.slug),
    // Un cupón usado pasa a "caducados", como el pase anulado de Apple.
    state: e.usado ? "INACTIVE" : "ACTIVE",
    accountId: codigo,
    ...(cliente.nombre ? { accountName: cliente.nombre } : {}),
    loyaltyPoints: { label: puntos.label, balance: { string: puntos.balance } },
    // Como la cabecera del pase de Apple: un premio guardado manda sobre el
    // contador de canjeados.
    ...(!e.esCupon && totalGuardados(cliente) > 0
      ? { secondaryLoyaltyPoints: { label: "Premios guardados", balance: { int: totalGuardados(cliente) } } }
      : !e.esCupon && (cliente.premios || 0) > 0
        ? { secondaryLoyaltyPoints: { label: "Premios", balance: { int: cliente.premios } } }
        : {}),
    barcode: { type: "QR_CODE", value: `${appUrl}/w/${cliente.serial}`, alternateText: codigo },
    heroImage: imagen(
      `${appUrl}${rutaBanda(negocio, cliente)}`,
      e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, negocio),
    ),
    textModulesData: principales.map((f) => ({ id: f.key, header: capitalizar(f.label), body: String(f.value) })),
    linksModuleData: {
      uris: [{ id: "tarjeta", uri: `${appUrl}/p/${cliente.serial}`, description: "Ver la tarjeta en el navegador" }],
    },
  };

  // El mensaje de una campaña vive en la tarjeta hasta que el cliente vuelve (la
  // visita lo borra, ver registrarVisita): igual que la línea "PARA TI" de Apple.
  if (conMensajes && cliente.mensaje) {
    objeto.messages = [{ id: "para-ti", header: "Para ti", body: cliente.mensaje, messageType: "TEXT" }];
  }
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
