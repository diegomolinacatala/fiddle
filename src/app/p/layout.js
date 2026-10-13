// La tarjeta web y lo que cuelga de ella (sus datos, «Todo listo») son del
// CLIENTE: siempre en claro, con los colores de su tienda, aunque el teléfono
// sea el de alguien del personal con el modo oscuro puesto (ver ui.js).
export default function LayoutTarjeta({ children }) {
  return <div className="claro">{children}</div>;
}
