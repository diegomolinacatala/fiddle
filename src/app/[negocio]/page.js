import { getNegocio } from "@/lib/store";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import { appUrl } from "@/lib/url";
import { notFound } from "next/navigation";
import ErrorDatos from "@/app/ErrorDatos";

export const dynamic = "force-dynamic";

// Landing PÚBLICA de un negocio: lo que ve el cliente al acercar el móvil al tag.
// Mantiene los colores de la tienda (aquí sí manda la marca, no el gris de la app).
export default async function Page({ params }) {
  const { negocio } = await params;
  let n;
  try {
    n = await getNegocio(negocio);
  } catch (e) {
    console.error(`[landing ${negocio}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();

  const tapUrl = `${appUrl()}/api/tap?b=${negocio}`;
  const tinta = n.tema.pageInk;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: n.tema.pageBg, padding: "1.5rem", color: tinta }}>
      <div style={{ width: "min(420px, 94vw)", textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>{n.tema.emoji}</div>
        <h1 style={{ margin: "6px 0 2px" }}>{n.nombre}</h1>
        <p style={{ opacity: 0.75, marginTop: 0 }}>
          {n.tipo === "descuento" ? n.premio : `Cartilla de sellos · ${n.premio}`}
        </p>

        <a href={tapUrl} style={{ ...btn, background: n.tema.accent }}>Conseguir el pase</a>

        <p style={{ marginTop: 26, fontSize: 12, opacity: 0.7 }}>
          Personal de la tienda:{" "}
          <a href={`/${negocio}/caja`} style={{ color: tinta }}>caja</a>
          {" · "}
          <a href={`/${negocio}/manager`} style={{ color: tinta }}>manager</a>
        </p>
      </div>
    </main>
  );
}

const btn = {
  display: "block", marginTop: 22, padding: "0.9rem 1.4rem", borderRadius: 12,
  border: 0, color: "#fff", fontWeight: 600, textDecoration: "none", fontSize: "1.05rem",
};
