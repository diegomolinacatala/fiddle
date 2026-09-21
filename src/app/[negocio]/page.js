import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getNegocio, getCliente } from "@/lib/store";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import { plataformaDe } from "@/lib/plataforma";
import { cookieDeTarjeta, serialRecordado } from "@/lib/recordar";
import { hayApple } from "@/lib/apple/config";
import { hayGoogle } from "@/lib/googlewallet";
import ErrorDatos from "@/app/ErrorDatos";
import MarcaTienda from "@/app/MarcaTienda";

export const dynamic = "force-dynamic";

// Landing PÚBLICA de un negocio: lo que ve el cliente si llega por el QR del
// mostrador o un enlace. Mantiene los colores de la tienda (aquí manda la marca,
// no el gris de la app) y le dice qué se va a llevar según su teléfono. Si ya
// tiene tarjeta (cookie del tap), se la ofrece en vez de darle otra.
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

  const plataforma = plataformaDe((await headers()).get("user-agent"));
  const recordado = serialRecordado((await cookies()).get(cookieDeTarjeta(negocio))?.value);
  const suya = recordado ? await getCliente(recordado).catch(() => null) : null;
  const tieneTarjeta = suya?.negocio === negocio;

  const tinta = n.tema.pageInk;
  const esCupon = n.tipo === "descuento";

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: n.tema.pageBg, padding: "1.5rem", color: tinta }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <MarcaTienda tema={n.tema} tam={84} icono style={{ margin: "0 auto", borderRadius: 22, boxShadow: "0 14px 30px -12px rgba(0,0,0,.45)" }} />
        <h1 style={{ margin: "18px 0 4px", fontSize: 28, letterSpacing: "-0.01em" }}>{n.nombre}</h1>
        <p style={{ margin: 0, fontSize: 17, opacity: 0.85 }}>
          {esCupon ? n.premio : `${n.meta} sellos y te llevas ${n.premio}`}
        </p>

        {tieneTarjeta ? (
          <>
            <a href={`/p/${suya.serial}`} style={{ ...btn, background: n.tema.accent }}>Abrir mi tarjeta</a>
            <p style={nota}>
              {esCupon ? "Tu cupón está guardado en este móvil." : `Llevas ${Math.min(suya.sellos, n.meta)} de ${n.meta}.`}
            </p>
          </>
        ) : (
          <>
            <a href={`/api/tap?b=${negocio}`} style={{ ...btn, background: n.tema.accent }}>
              {esCupon ? "Quiero el cupón" : "Quiero mi tarjeta"}
            </a>
            <p style={nota}>{queTeLlevas(plataforma, esCupon)}</p>
          </>
        )}

        <p style={{ marginTop: 34, fontSize: 12, opacity: 0.6 }}>
          ¿Trabajas aquí?{" "}
          <a href={`/${negocio}/caja`} style={{ color: tinta }}>Caja</a>
          {" · "}
          <a href={`/${negocio}/manager`} style={{ color: tinta }}>Manager</a>
        </p>
      </div>
    </main>
  );
}

// Lo que va a pasar al tocar el botón, dicho antes: nada de sorpresas.
function queTeLlevas(plataforma, esCupon) {
  const avisa = esCupon ? "Enséñalo en caja cuando lo vayas a usar." : "Te avisa de cada sello.";
  if (plataforma === "ios") {
    return hayApple()
      ? `Se guarda en Apple Wallet. ${avisa} Sin apps ni registros.`
      : "Sin apps ni registros: la tarjeta se abre en el navegador.";
  }
  if (plataforma === "android") {
    return `Se guarda en ${hayGoogle() ? "Google Wallet o en " : ""}tu móvil. ${avisa} Sin apps ni registros.`;
  }
  return "Ábrelo en el móvil: la tarjeta se guarda ahí.";
}

const btn = {
  display: "block", marginTop: 26, padding: "1rem 1.4rem", borderRadius: 14,
  border: 0, color: "#fff", fontWeight: 650, textDecoration: "none", fontSize: "1.1rem",
  boxShadow: "0 12px 26px -12px rgba(0,0,0,.5)",
};
const nota = { margin: "12px 8px 0", fontSize: 14, opacity: 0.8, lineHeight: 1.45 };
