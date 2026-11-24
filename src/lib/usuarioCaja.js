// El usuario de la caja, comprobado por su forma. Sin imports: lo usan la página
// de la invitación (en el navegador) y lib/accesos.js (en el servidor), y esta
// última arrastra cosas que no pueden ir al navegador.
export const USUARIO_CAJA = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Lo que falla en un usuario de caja por su forma, o null. */
export function problemaUsuarioCaja(texto) {
  const u = String(texto ?? "").trim().toLowerCase();
  if (u.length < 3) return "El usuario de la caja tiene que tener al menos 3 letras o números";
  if (u.length > 30) return "El usuario de la caja puede tener hasta 30 caracteres";
  if (u.includes("@")) return "El de la caja es un usuario, no un correo";
  if (!USUARIO_CAJA.test(u)) return "Solo letras sin acentos, números, puntos y guiones, sin espacios";
  return null;
}
