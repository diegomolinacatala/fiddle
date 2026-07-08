// Controla qué app sirve la raíz "/".
//   APP_MODE=worker   -> "/" redirige a /worker   (deploy "solo caja")
//   APP_MODE=manager  -> "/" redirige a /manager  (deploy "solo manager")
//   APP_MODE=both     -> "/" muestra un hub con las dos (por defecto, útil en local)
//
// Truco: puedes desplegar ESTE MISMO repo dos veces en Vercel (dos dominios),
// uno con APP_MODE=worker y otro con APP_MODE=manager. Webs separadas, un repo.
export function appMode() {
  const m = (process.env.APP_MODE || "both").toLowerCase();
  return ["worker", "manager", "both"].includes(m) ? m : "both";
}
