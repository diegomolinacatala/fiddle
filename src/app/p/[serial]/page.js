import { getCliente, getPrograma } from "@/lib/store";
import PassCard from "./PassCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vista del PASE del cliente (lo que vería en su Wallet). Es de solo lectura:
// el cliente no actúa aquí. Su QR es lo que escanea la tienda.
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);

  if (!cliente) {
    return (
      <main style={wrap}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ opacity: 0.7 }}>Pase no encontrado</p>
        </div>
      </main>
    );
  }

  const prog = await getPrograma();

  return (
    <main style={wrap}>
      <PassCard
        serial={serial}
        sellos={cliente.sellos}
        premios={cliente.premios}
        meta={prog.meta}
        titulo={prog.titulo}
        premio={prog.premio}
        promo={prog.promo}
      />
    </main>
  );
}

const wrap = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0b0b0c",
  color: "#fff",
  padding: "1.5rem",
};
