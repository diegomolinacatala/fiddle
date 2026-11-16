import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { sitioDeSesion } from "@/lib/acceso";

export const dynamic = "force-dynamic";

// «Entrar» de la web y «Equipo» al pie de la página de una tienda. Con sesión, a
// su sitio sin pedir nada; sin ella, al login. No es /login directamente porque
// quien ya está dentro no tiene que volver a escribir la contraseña. `b` (la
// tienda, desde su página) pasa tal cual: el login ya sabe qué hacer con él.
export default async function Entrar({ searchParams }) {
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  if (sesion) redirect(sitioDeSesion(sesion));
  const b = (await searchParams)?.b;
  redirect(typeof b === "string" && b ? `/login?b=${encodeURIComponent(b)}` : "/login");
}
