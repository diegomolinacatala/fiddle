import { getCliente, getNegocio, clientePublico } from "@/lib/store";
import { proveedorWallet } from "@/lib/wallet";
import { googleSaveUrl } from "@/lib/googlewallet";
import { urlCaja } from "@/lib/url";
import ThemedPass from "./ThemedPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Página del PASE del cliente: cómo se ve su tarjeta + botones para guardarla en
// Apple Wallet / Google Wallet. Pública (el serial es un uuid aleatorio).
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0c", color: "#fff" }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 40 }}>🔍</div><p style={{ opacity: 0.7 }}>Pase no encontrado</p></div>
      </main>
    );
  }
  const negocio = await getNegocio(cliente.negocio);
  const proveedor = proveedorWallet();

  return (
    <ThemedPass
      serial={serial}
      cliente={clientePublico(cliente)}
      negocio={negocio}
      qrTexto={urlCaja(serial)}
      appleUrl={proveedor === "apple" ? `/api/pase/${serial}` : null}
      googleUrl={googleSaveUrl(cliente, negocio)}
      demo={proveedor === "demo"}
    />
  );
}
