import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";
import { sitioDeSesion } from "@/lib/acceso";

export const dynamic = "force-dynamic";

// La raíz no enseña nada propio. Con sesión, a su sitio (el móvil de la caja o
// del dueño abre fiddle.es y llega a lo suyo). Sin ella, a la web (/home): quien
// escribe fiddle.es es casi siempre una cafetería que aún no nos conoce, y un
// login no le dice nada (24-11-2026). «Entrar» de la web va a /login.
// Las páginas públicas de cada tienda siguen viviendo en /<negocio> (es lo que
// abre el tag NFC), no hace falta un directorio que las liste.
export default async function Home() {
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  redirect(sesion ? sitioDeSesion(sesion) : "/home");
}
