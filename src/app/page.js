import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verificarSesion, COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// La raíz no enseña nada: lleva directo al login. Si ya hay sesión, a su sitio.
// Las páginas públicas de cada tienda siguen viviendo en /<negocio> (es lo que
// abre el tag NFC), no hace falta un directorio que las liste.
export default async function Home() {
  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (sesion) redirect(`/${sesion.negocio}/${sesion.rol === "manager" ? "manager" : "caja"}`);
  redirect("/login");
}
