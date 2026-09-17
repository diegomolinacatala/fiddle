import { randomUUID } from "crypto";

const WW_BASE = "https://api.walletwallet.dev";

export const isDemoWallet = () => !process.env.WALLETWALLET_API_KEY;

function authHeaders() {
  return { Authorization: `Bearer ${process.env.WALLETWALLET_API_KEY}`, "Content-Type": "application/json" };
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function nuevoSerial() {
  return randomUUID();
}

/**
 * Reconstruye el pase completo desde el estado del cliente + la config del negocio.
 * El barcode apunta a /w/<serial> (identidad). Se usa el serial NUESTRO (no el de
 * WalletWallet), así el barcode ya va correcto en el primer POST.
 */
export function buildPassBody(cliente, negocio) {
  const t = negocio.tema;
  const body = {
    barcodeFormat: "QR",
    barcodeValue: cliente.serial ? `${appUrl()}/w/${cliente.serial}` : "PENDING",
    logoText: `${t.emoji} ${negocio.nombre}`,
    description: negocio.nombre,
    organizationName: negocio.nombre,
    colorPreset: t.preset,
    backFields: [{ label: "Cómo funciona", value: t.atras }],
  };

  if (negocio.tipo === "descuento") {
    const usado = (cliente.premios || 0) > 0;
    body.headerFields = [{ label: "Cupón", value: usado ? "usado" : "activo" }];
    body.primaryFields = [{ label: "Descuento", value: negocio.premio, changeMessage: "%@" }];
    body.secondaryFields = [{ label: "Estado", value: usado ? "Ya usado" : "Válido — un uso" }];
  } else {
    const meta = negocio.meta;
    const sellos = Math.min(cliente.sellos, meta);
    const completa = cliente.sellos >= meta;
    body.headerFields = [{ label: "Sellos", value: `${sellos}/${meta}` }];
    body.primaryFields = [{ label: "Sellos", value: `${sellos} / ${meta}`, changeMessage: "Ya tienes %@ sellos" }];
    body.secondaryFields = [{ label: "Premio", value: completa ? `¡${negocio.premio}! 🎉` : `Faltan ${meta - cliente.sellos}` }];
    if ((cliente.premios || 0) > 0) body.backFields.push({ label: "Canjeados", value: String(cliente.premios) });
  }

  if (negocio.promo) body.backFields.unshift({ label: "Promoción", value: negocio.promo, changeMessage: "%@" });
  return body;
}

// POST /api/passes -> crea el pase. Devuelve wwSerial + applePass (bytes .pkpass ya firmados).
export async function createPass(body) {
  if (isDemoWallet()) {
    return { wwSerial: null, shareUrl: null, applePass: null, _demo: true };
  }
  const res = await fetch(`${WW_BASE}/api/passes`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`WalletWallet POST ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { wwSerial: d.serialNumber, shareUrl: d.shareUrl, googleSaveUrl: d.googleSaveUrl, applePass: d.applePass, _demo: false };
}

// PUT /api/passes/<wwSerial> -> reemplaza el pase y dispara el push automático.
export async function updatePass(wwSerial, body) {
  if (isDemoWallet() || !wwSerial) return { ok: true, _demo: true };
  const res = await fetch(`${WW_BASE}/api/passes/${wwSerial}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`WalletWallet PUT ${res.status}: ${await res.text()}`);
  return res.json();
}
