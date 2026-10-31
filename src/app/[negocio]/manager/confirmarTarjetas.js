// Guardar algo que se ve en la tarjeta (el diseño, «Abierto hasta…», la ubicación)
// pone al día la de TODOS los clientes: cada teléfono se la vuelve a bajar. No les
// suena nada, pero tarda y gasta, y quien lo toca debe saberlo antes de darle.
// Lo usan los tres sitios que lo hacen (PanelManager y EditorTarjeta): un solo texto.
export const AVISO_TARJETAS =
  "Esto pone al día la tarjeta de todos tus clientes, en silencio: no les sonará nada ni les llegará ningún aviso.\n\nPuede tardar un poco. ¿Guardar?";

/** ¿Sigue adelante? En un navegador sin ventana de confirmar, sí. */
export const confirmarTarjetas = () => (typeof window === "undefined" || typeof window.confirm !== "function" ? true : window.confirm(AVISO_TARJETAS));
