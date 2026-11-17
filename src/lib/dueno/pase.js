import { PALETA } from "../../app/home/paleta";
import { fraseDelInforme, lineasDelInforme } from "./informe";

// ============================================================================
// LA TARJETA DEL DUEÑO — pass.json
// ----------------------------------------------------------------------------
// Solo cifras: este módulo no recibe a ningún cliente, así que no puede colar su
// nombre ni su código. Las claves de los campos son fijas y los campos están
// siempre: iOS solo avisa en la pantalla de bloqueo de un campo que CAMBIA de
// valor y lleva `changeMessage` en la versión nueva; uno que aparece de golpe no
// suena.
// ============================================================================

// Igual que `hexARgb` de lib/apple/pase.js, que no se importa: arrastra la
// cartilla, los planes y el contacto, y esto tiene que cargar suelto (el script
// de mirar la tarjeta no pasa por Next).
function rgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`Color no válido: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

// El attributedValue de iOS es HTML mínimo: el texto, escapado, y los <a>.
const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enlace = (url, texto) => `<a href="${escapar(url)}">${escapar(texto)}</a>`;

function campoParaTi(aviso) {
  if (!aviso) {
    return {
      key: "para_ti",
      label: "Para ti",
      value: "Esta semana no hay nada pendiente. Cuando los números digan algo, te lo contamos aquí.",
    };
  }
  if (!aviso.enlace) return { key: "para_ti", label: "Para ti", value: aviso.texto };
  return {
    key: "para_ti",
    label: "Para ti",
    value: `${aviso.texto}\n${aviso.enlace}`,
    attributedValue: `${escapar(aviso.texto)}\n${enlace(aviso.enlace, "Ver el aviso preparado")}`,
  };
}

function campoPanel(negocio, base) {
  const enlaces = [
    ["Clientes", `${base}/${negocio.slug}/crm`],
    ["Avisos", `${base}/${negocio.slug}/avisos`],
    ["Tienda", `${base}/${negocio.slug}/manager`],
  ];
  return {
    key: "panel",
    label: "Tu panel",
    value: enlaces.map(([t, url]) => `${t}: ${url}`).join("\n"),
    attributedValue: enlaces.map(([t, url]) => enlace(url, t)).join("\n"),
  };
}

/**
 * Los campos de la tarjeta. `aviso` es el visible (ya resuelto): { texto, enlace } o null.
 */
export function camposDelDueno({ informe, aviso }, negocio, { base = "" } = {}) {
  // El campo de abajo conserva SIEMPRE su clave: con aviso dice PARA TI y suena
  // (`%@` es el propio texto); al caducar vuelve a PREMIOS DADOS sin changeMessage,
  // en silencio. Con otra clave, el cambio sería un campo nuevo y no avisaría.
  const auxiliar = aviso
    ? { key: "aviso", label: "PARA TI", value: aviso.texto, changeMessage: "%@" }
    : { key: "aviso", label: "PREMIOS DADOS", value: String(informe.premios) };
  return {
    headerFields: [{
      key: "semana",
      label: "SEMANA",
      value: informe.etiqueta,
      changeMessage: `Semana del %@: ${fraseDelInforme(informe)}`,
    }],
    // El número grande va dibujado en la banda: así se ve igual en todos los iPhone.
    primaryFields: [],
    secondaryFields: [{ key: "nuevos", label: "NUEVOS", value: String(informe.nuevos) }],
    auxiliaryFields: [auxiliar],
    backFields: [
      campoParaTi(aviso),
      { key: "informe", label: `Tu semana, del ${informe.etiqueta}`, value: lineasDelInforme(informe).join("\n") },
      campoPanel(negocio, base),
      {
        key: "sobre",
        label: "Esta tarjeta",
        value: "Es tu tarjeta de dueño en fiddle. Cada lunes te trae el resumen de la semana y, cuando los números dicen algo, un aviso ya preparado para tus clientes. Solo lleva cifras: ningún nombre ni dato de tus clientes.",
      },
    ],
  };
}

/** El pass.json. Exige serial y un token de 16 o más caracteres en `negocio.tarjetaDueno`. */
export function construirPassJsonDueno({ informe, aviso }, negocio, { passTypeId, teamId, appUrl }) {
  const t = negocio.tarjetaDueno;
  if (!t?.serial) throw new Error("La tarjeta del dueño no tiene número de serie");
  if (!t.token || t.token.length < 16) {
    throw new Error("La tarjeta del dueño no tiene authenticationToken válido (mín. 16 caracteres)");
  }
  return {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    organizationName: "fiddle",
    description: `Tarjeta de dueño de ${negocio.nombre}`,
    logoText: negocio.nombre,
    serialNumber: t.serial,
    authenticationToken: t.token,
    webServiceURL: `${appUrl}/api/dueno`,
    sharingProhibited: true,
    backgroundColor: rgb(PALETA.verde),
    foregroundColor: rgb(PALETA.papel),
    labelColor: rgb(PALETA.avena),
    storeCard: camposDelDueno({ informe, aviso }, negocio, { base: appUrl }),
  };
}
