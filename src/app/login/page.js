import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { sitioDeSesion } from "@/lib/acceso";
import Login from "./Login";

export const dynamic = "force-dynamic";

// /login a secas («Entrar» de la web, «Equipo» al pie de una tienda): quien ya
// está dentro va a su sitio sin volver a escribir la contraseña. Con `next` no:
// ahí lo manda el middleware porque su sesión no vale para esa página (el dueño
// que abre la caja), y tiene que poder entrar con otro usuario. El formulario va
// aparte (Login.js) porque corre en el navegador y no puede leer la sesión.
export default async function PaginaLogin({ searchParams }) {
  if (!(await searchParams)?.next) {
    const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
    if (sesion) redirect(sitioDeSesion(sesion));
  }
  return <Login />;
}
