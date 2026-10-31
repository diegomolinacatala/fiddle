import { confirmar } from "@/app/Dialogo";

// Guardar algo que se ve en la tarjeta (el diseño, «Abierto hasta…», la ubicación)
// pone al día la de TODOS los clientes: cada teléfono se la vuelve a bajar. No les
// suena nada, pero tarda y gasta, y quien lo toca debe saberlo antes de darle.
// Lo usan los tres sitios que lo hacen (PanelManager y EditorTarjeta): un solo texto.
export const AVISO_TARJETAS = {
  titulo: "¿Poner al día la tarjeta de todos tus clientes?",
  texto: "Se actualiza en silencio: no les sonará nada ni les llegará ningún aviso. Puede tardar un poco.",
  si: "Guardar",
};

/** ¿Sigue adelante? En la ventana de fiddle (app/Dialogo.js), con el color de la tienda. */
export const confirmarTarjetas = (accent) => confirmar({ ...AVISO_TARJETAS, accent });
