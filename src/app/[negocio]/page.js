import { getNegocio } from "@/lib/store";
import { appUrl } from "@/lib/url";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Landing de un negocio: instalar pase (tap), caja y manager.
export default async function Page({ params }) {
  const { negocio } = await params;
  const n = await getNegocio(negocio);
  if (!n) notFound();

  const tapUrl = `${appUrl()}/api/tap?b=${negocio}`;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: n.tema.pageBg, padding: "1.5rem" }}>
      <div style={{ width: "min(440px, 94vw)", textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>{n.tema.emoji}</div>
        <h1 style={{ margin: "6px 0 2px", color: "#111" }}>{n.nombre}</h1>
        <p style={{ opacity: 0.65, marginTop: 0, color: "#111" }}>
          {n.tipo === "descuento" ? n.premio : `Cartilla de sellos · ${n.premio}`}
        </p>

        <a href={tapUrl} style={{ ...btn, background: n.tema.accent }}>Conseguir el pase (tap)</a>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <a href={`/${negocio}/caja`} style={sub}>📱 Caja</a>
          <a href={`/${negocio}/manager`} style={sub}>🖥️ Manager</a>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.6, color: "#111", wordBreak: "break-all" }}>
          Tag NFC → graba esta URL:<br /><code>{tapUrl}</code>
        </p>
      </div>
    </main>
  );
}

const btn = {
  display: "block", marginTop: 20, padding: "0.9rem 1.4rem", borderRadius: 999,
  border: 0, color: "#fff", fontWeight: 600, textDecoration: "none", fontSize: "1.05rem",
};
const sub = {
  flex: 1, padding: "0.7rem", borderRadius: 12, background: "rgba(0,0,0,.75)",
  color: "#fff", textDecoration: "none", fontSize: 14,
};
