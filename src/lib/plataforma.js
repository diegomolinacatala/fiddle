// ============================================================================
// PLATAFORMA DEL CLIENTE
// ----------------------------------------------------------------------------
// De qué teléfono viene alguien decide qué se le ofrece: al iPhone, su pase de
// Apple Wallet; al Android, Google Wallet (si está activo), instalar la tarjeta
// en la pantalla de inicio y los avisos del navegador.
//
// Solo mira el User-Agent. Un iPad en modo escritorio se presenta como un Mac y
// cae en "otro": ahí se ofrecen las dos Wallet, así que no se queda sin nada.
// ============================================================================

/** @returns {"ios"|"android"|"otro"} */
export function plataformaDe(userAgent) {
  const ua = String(userAgent || "");
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "otro";
}
