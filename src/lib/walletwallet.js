import { randomUUID } from "crypto";

const WW_BASE = "https://api.walletwallet.dev";

// Modo demo: sin API key real, simulamos la firma y el push.
export const isDemoWallet = () => !process.env.WALLETWALLET_API_KEY;

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.WALLETWALLET_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// URL pública de la app. En local por defecto localhost:3000.
export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Reconstruye el pase COMPLETO desde el estado del cliente + la config del programa.
 *
 * El PUT de WalletWallet reemplaza el body entero (no es un patch), así que esta
 * función es la única fuente de verdad del aspecto del pase. La usan emitir(),
 * /api/accion y /api/promo.
 *
 * @param {{serial: string|null, sellos: number, premios?: number, nombre?: string|null}} cliente
 * @param {{titulo, color, meta, premio, promo}} prog
 */
export function buildPassBody(cliente, prog) {
  const meta = prog.meta;
  const sellos = Math.min(cliente.sellos, meta);
  const completa = cliente.sellos >= meta;

  const body = {
    barcodeFormat: "QR",
    // IMPORTANTE: el QR del pase = la identidad. Apunta a la vista del trabajador.
    // Escanearlo abre el perfil de ESE cliente para actuar sobre él.
    barcodeValue: cliente.serial ? `${appUrl()}/w/${cliente.serial}` : "PENDING",
    logoText: prog.titulo,
    description: "Tarjeta de fidelización",
    organizationName: prog.titulo,
    colorPreset: prog.color,
    // Personalización por cliente: si tiene nombre, encabeza el pase con él;
    // si no, cae al contador de sellos (el detalle sigue en primaryFields).
    headerFields: [
      cliente.nombre
        ? { label: "Cliente", value: cliente.nombre }
        : { label: "Sellos", value: `${sellos}/${meta}` },
    ],
    primaryFields: [
      { label: "Sellos", value: `${sellos} / ${meta}`, changeMessage: "Ya tienes %@ sellos" },
    ],
    secondaryFields: [
      { label: "Premio", value: completa ? `¡${prog.premio}! 🎉` : `Faltan ${meta - cliente.sellos}` },
    ],
    backFields: [
      {
        label: "Cómo funciona",
        value: `Enseña el pase en caja en cada visita. Al llegar a ${meta} sellos: ${prog.premio}.`,
      },
    ],
  };

  if (prog.promo) {
    body.backFields.unshift({ label: "Promoción", value: prog.promo, changeMessage: "%@" });
  }

  return body;
}

// POST /api/passes -> crea el pase. El servidor asigna el serialNumber.
export async function createPass(body) {
  if (isDemoWallet()) {
    const serial = randomUUID();
    // En demo el shareUrl apunta a la vista del pase del cliente (visible en navegador).
    return { serialNumber: serial, shareUrl: `${appUrl()}/p/${serial}`, googleSaveUrl: null, _demo: true };
  }
  const res = await fetch(`${WW_BASE}/api/passes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WalletWallet POST ${res.status}: ${await res.text()}`);
  return res.json();
}

// PUT /api/passes/<serial> -> reemplaza el pase y dispara el push automático.
export async function updatePass(serial, body) {
  if (isDemoWallet()) return { ok: true, _demo: true }; // no-op: el estado vive en el store
  const res = await fetch(`${WW_BASE}/api/passes/${serial}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WalletWallet PUT ${res.status}: ${await res.text()}`);
  return res.json();
}
