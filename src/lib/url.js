// URL pública de la app (sin barra final). En local, localhost:3000.
// Va dentro de los pases (QR y webServiceURL), así que en producción debe ser
// la URL HTTPS real del deploy.
export function appUrl() {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

// URL que codifica el QR del pase: abre el perfil del cliente en la caja.
export const urlCaja = (serial) => `${appUrl()}/w/${serial}`;
