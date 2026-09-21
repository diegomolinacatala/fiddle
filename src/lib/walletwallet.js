import { urlCaja } from "./url";

// ============================================================================
// WALLETWALLET (alternativa sin cuenta de Apple Developer)
// ----------------------------------------------------------------------------
// Servicio externo que firma el pase y hace el push por nosotros. Ahora que hay
// cuenta de Apple Developer, el proveedor preferido es el propio (lib/apple).
// Se mantiene como plan B: solo se usa si NO hay variables APPLE_* y SÍ hay
// WALLETWALLET_API_KEY. Ver lib/wallet.js.
// ============================================================================

const WW_BASE = "https://api.walletwallet.dev";

export const hayWalletWallet = () => Boolean(process.env.WALLETWALLET_API_KEY);

function authHeaders() {
  return { Authorization: `Bearer ${process.env.WALLETWALLET_API_KEY}`, "Content-Type": "application/json" };
}

/**
 * Reconstruye el pase completo desde el estado del cliente + la config del negocio.
 * El PUT de WalletWallet reemplaza el body entero, así que esta función es la
 * única fuente de verdad del pase en este proveedor.
 */
export function buildPassBody(cliente, negocio) {
  const t = negocio.tema;
  const body = {
    barcodeFormat: "QR",
    barcodeValue: urlCaja(cliente.serial),
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
    body.headerFields = [
      cliente.nombre ? { label: "Cliente", value: cliente.nombre } : { label: "Sellos", value: `${sellos}/${meta}` },
    ];
    body.primaryFields = [{ label: "Sellos", value: `${sellos} / ${meta}`, changeMessage: "Ya tienes %@ sellos" }];
    body.secondaryFields = [{ label: "Premio", value: completa ? `¡${negocio.premio}!` : `Faltan ${meta - cliente.sellos}` }];
    if ((cliente.premios || 0) > 0) body.backFields.push({ label: "Canjeados", value: String(cliente.premios) });
  }

  if (negocio.promo) body.backFields.unshift({ label: "Promoción", value: negocio.promo, changeMessage: "%@" });
  return body;
}

// POST /api/passes -> crea el pase. Devuelve wwSerial + applePass (bytes .pkpass ya firmados, base64).
export async function createPass(body) {
  const res = await fetch(`${WW_BASE}/api/passes`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`WalletWallet POST ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { wwSerial: d.serialNumber, shareUrl: d.shareUrl, applePass: d.applePass };
}

// PUT /api/passes/<wwSerial> -> reemplaza el pase y (según su doc) dispara el push.
export async function updatePass(wwSerial, body) {
  if (!wwSerial) return { ok: false, motivo: "cliente sin ww_serial" };
  const res = await fetch(`${WW_BASE}/api/passes/${wwSerial}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`WalletWallet PUT ${res.status}: ${await res.text()}`);
  return res.json();
}
