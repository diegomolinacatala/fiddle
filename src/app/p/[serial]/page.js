import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCliente, getNegocio } from "@/lib/store";
import { clienteVigente } from "@/lib/unaTarjeta";
import { proveedorWallet } from "@/lib/wallet";
import { rutaGuardarGoogle } from "@/lib/googlewallet";
import { clavesPush } from "@/lib/push/vapid";
import { plataformaDe } from "@/lib/plataforma";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { rutaIcono } from "@/lib/rutasImagen";
import { urlCaja } from "@/lib/url";
import Tarjeta from "./Tarjeta";
import { CAPTURAR_INSTALAR, REGISTRAR_SW } from "@/app/temprano";
import { C, paginaCentrada } from "@/app/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Página de la TARJETA del cliente. En iPhone es el paso previo a Apple Wallet;
// en Android ES la tarjeta: se instala en la pantalla de inicio, se actualiza
// sola y avisa de cada sello. Pública: el serial es un uuid aleatorio.

// Metadatos, viewport y página piden lo mismo: una sola lectura por visita.
const cargar = cache(async (serial) => {
  const cliente = await getCliente(serial);
  const negocio = cliente ? await getNegocio(cliente.negocio) : null;
  return { cliente, negocio };
});

export async function generateMetadata({ params }) {
  const { serial } = await params;
  const { negocio } = await cargar(serial).catch(() => ({}));
  if (!negocio) return { title: "Tarjeta" };
  return {
    title: `${negocio.nombre} · tu tarjeta`,
    description: `Tu tarjeta de ${negocio.nombre}`,
    // Cada tarjeta es su propia app instalable: abre directamente en ella.
    manifest: `/api/manifest?p=${serial}`,
    icons: { icon: rutaIcono(negocio, 192), apple: rutaIcono(negocio, 180) },
    appleWebApp: { capable: true, title: negocio.nombre, statusBarStyle: "default" },
    robots: { index: false, follow: false },
  };
}

export async function generateViewport({ params }) {
  const { serial } = await params;
  const { negocio } = await cargar(serial).catch(() => ({}));
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: negocio?.tema?.accent || C.fondo };
}

// El service worker se registra ANTES de que cargue React (hace falta para
// poder instalar la tarjeta y para los avisos), y se recoge el "se puede
// instalar" de Chrome, que llega una sola vez.
const temprano = REGISTRAR_SW + CAPTURAR_INSTALAR;

export default async function Page({ params }) {
  const { serial } = await params;
  const { cliente, negocio } = await cargar(serial);
  // Tarjeta sustituida por otra (mismo iPhone, ver lib/unaTarjeta.js): a la vigente.
  if (cliente?.fusionado_en) {
    const vigente = await clienteVigente(getCliente, serial);
    if (vigente) redirect(`/p/${vigente.serial}`);
  }
  if (!cliente || !negocio) {
    return (
      <main style={paginaCentrada}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Esta tarjeta no existe</h1>
          <p style={{ color: C.suave, margin: 0 }}>Puede que el enlace esté incompleto. Pide en la tienda que te la vuelvan a dar.</p>
        </div>
      </main>
    );
  }

  const proveedor = proveedorWallet();
  const claves = clavesPush();

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: temprano }} />
      <Tarjeta
        serial={serial}
        inicial={{ cliente: clienteDeTarjeta(cliente), negocio: negocioDeTarjeta(negocio) }}
        qrTexto={urlCaja(serial)}
        plataforma={plataformaDe((await headers()).get("user-agent"))}
        appleUrl={proveedor === "apple" ? `/api/pase/${serial}` : null}
        googleUrl={rutaGuardarGoogle(serial)}
        clavePush={claves?.publica || null}
        demo={proveedor === "demo"}
      />
    </>
  );
}
