// URL pública de la app (sin barra final). En local, localhost:3000.
// Va dentro de los pases (QR y webServiceURL), así que en producción debe ser
// la URL HTTPS real del deploy.
export function appUrl() {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

// URL que codifica el QR del pase: abre el perfil del cliente en la caja.
export const urlCaja = (serial) => `${appUrl()}/w/${serial}`;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Lo contrario de urlCaja: el serial que lleva el QR de una tarjeta, o null si
 * ese QR no es de una tarjeta (el de la carta, el del wifi). Acepta también el
 * serial suelto, que es lo que se pega a mano.
 */
export function serialDeQr(texto) {
  const t = String(texto || "");
  const deUrl = t.match(/\/w\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  if (deUrl && UUID.test(deUrl[1])) return deUrl[1].toLowerCase();
  const suelto = t.match(UUID);
  return suelto ? suelto[0].toLowerCase() : null;
}
