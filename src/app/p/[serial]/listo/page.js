import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCliente, getNegocio } from "@/lib/store";
import { clienteVigente } from "@/lib/unaTarjeta";
import { proveedorWallet } from "@/lib/wallet";
import { plataformaDe } from "@/lib/plataforma";
import { rutaListo } from "@/lib/todoListo";
import { coloresDeTienda } from "@/app/ui";
import { colorDelPase } from "@/lib/apple/dibujo";
import MarcaTienda from "@/app/MarcaTienda";
import AbrirPase from "./AbrirPase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La página que abre el .pkpass en iPhone y, cuando ya ha salido la hoja de la
// Cartera, dice «Todo listo» (ver lib/todoListo.js). Llegan aquí el tap y el
// botón de Apple de la página de la tienda. Pública como /p/<serial>.

const cargar = cache(async (serial) => {
  const cliente = await getCliente(serial);
  const negocio = cliente ? await getNegocio(cliente.negocio) : null;
  return { cliente, negocio };
});

export async function generateMetadata({ params }) {
  const { serial } = await params;
  const { negocio } = await cargar(serial).catch(() => ({}));
  return { title: negocio?.nombre || "Tarjeta", robots: { index: false, follow: false } };
}

export async function generateViewport({ params }) {
  const { serial } = await params;
  const { negocio } = await cargar(serial).catch(() => ({}));
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: negocio?.tema?.accent };
}

export default async function Page({ params }) {
  const { serial } = await params;
  const { cliente, negocio } = await cargar(serial);
  if (cliente?.fusionado_en) {
    const vigente = await clienteVigente(getCliente, serial);
    if (vigente) redirect(rutaListo(vigente.serial));
  }
  // Sin pase de Apple que abrir (o en Android, donde el .pkpass no sirve), la
  // tarjeta web, que sabe qué ofrecer y qué decir si la tarjeta no existe o se borró.
  const android = plataformaDe((await headers()).get("user-agent")) === "android";
  if (!cliente || !negocio || cliente.borrado_en || android || proveedorWallet() !== "apple") redirect(`/p/${serial}`);

  return (
    <main className="todolisto" style={{ ...coloresDeTienda(negocio.tema, colorDelPase(negocio.tema)), "--anillo": negocio.tema.cardBg || "#fff" }}>
      <AbrirPase serial={serial} nombre={negocio.nombre} marca={<MarcaTienda tema={negocio.tema} tam={84} icono />} />
    </main>
  );
}
