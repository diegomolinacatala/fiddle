import { getCliente, getNegocio } from "@/lib/store";
import ThemedPass from "./ThemedPass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vista del PASE del cliente (cómo se ve la tarjeta). Diseño según el negocio.
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
  return <ThemedPass serial={serial} cliente={cliente} negocio={negocio} />;
}
