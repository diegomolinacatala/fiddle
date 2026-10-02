import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "@/lib/auth";
import { sesionDeCookie } from "@/lib/sesionVigente";

export const dynamic = "force-dynamic";

// La raíz no enseña nada: lleva directo al login. Si ya hay sesión, a su sitio.
// Las páginas públicas de cada tienda siguen viviendo en /<negocio> (es lo que
// abre el tag NFC), no hace falta un directorio que las liste.
export default async function Home() {
  const sesion = await sesionDeCookie((await cookies()).get(COOKIE)?.value);
  if (sesion?.rol === "admin") redirect("/admin");
  if (sesion) redirect(`/${sesion.negocio}/${sesion.rol === "manager" ? "manager" : "caja"}`);
  redirect("/login");
}
