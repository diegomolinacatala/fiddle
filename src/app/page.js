import { listNegocios } from "@/lib/store";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import ErrorDatos from "./ErrorDatos";

export const dynamic = "force-dynamic";

// Directorio de negocios. Cada uno tiene su propia tarjeta, caja, manager y tag.
export default async function Home() {
  let negocios;
  try {
    negocios = await listNegocios();
  } catch (e) {
    console.error("[home] no se pudo leer la base de datos:", e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  return (
    <main style={wrap}>
      <div style={{ width: "min(720px, 94vw)" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: 2 }}>Sellos · plataforma</h1>
        <p style={{ opacity: 0.6, marginTop: 0 }}>
          Cada negocio: su tarjeta, su caja, su manager y su tag NFC. El pase es solo un QR.
        </p>
        <div style={grid}>
          {negocios.map((n) => (
            <a key={n.slug} href={`/${n.slug}`} style={{ ...card, borderColor: n.tema.accent }}>
              <div style={{ fontSize: 34 }}>{n.tema.emoji}</div>
              <strong style={{ fontSize: "1.1rem" }}>{n.nombre}</strong>
              <span style={{ opacity: 0.55, fontSize: 13 }}>
                {n.tipo === "descuento" ? "cupón de descuento" : `cartilla · ${n.premio}`}
              </span>
              <span style={{ marginTop: 8, fontSize: 12, color: n.tema.accent }}>/{n.slug} →</span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

const wrap = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0c", color: "#fff", padding: "1.5rem" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, marginTop: 20 };
const card = {
  display: "flex", flexDirection: "column", gap: 4, padding: "1.3rem",
  borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#141416",
  color: "#fff", textDecoration: "none",
};
