import { cookies } from "next/headers";
import { getCliente, getNegocio, listEventos } from "@/lib/store";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import WorkerActions from "./WorkerActions";
import SetNombre from "./SetNombre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vista del TRABAJADOR (lo que abre el QR del pase). Perfil + acciones.
// El middleware ya exige sesión; aquí se comprueba que sea del negocio del cliente.
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) return <main style={wrap}><Center>🔍<br /><span style={{ opacity: 0.7, fontSize: 16 }}>Cliente no encontrado</span></Center></main>;

  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, cliente.negocio, "caja")) {
    return (
      <main style={wrap}>
        <Center>
          🚫<br />
          <span style={{ opacity: 0.7, fontSize: 16 }}>Este pase es de otro negocio.</span><br />
          <a href={`/login?b=${cliente.negocio}&next=/w/${serial}`} style={{ color: "#fff", fontSize: 14 }}>Entrar con otra caja</a>
        </Center>
      </main>
    );
  }

  const n = await getNegocio(cliente.negocio);
  const eventos = await listEventos(serial);
  const acciones = LISTA_ACCIONES.filter((a) => n.acciones.includes(a.key));
  const accent = n.tema.accent;
  const esDescuento = n.tipo === "descuento";
  const meta = n.meta;
  const dots = Array.from({ length: meta }, (_, i) => i < Math.min(cliente.sellos, meta));
  const usado = (cliente.premios || 0) > 0;

  return (
    <main style={wrap}>
      <div style={{ width: "min(430px, 94vw)" }}>
        <a href={`/${n.slug}/caja`} style={{ fontSize: 13, opacity: 0.5, color: "#fff", textDecoration: "none" }}>← {n.tema.emoji} {n.nombre}</a>
        {cliente.nombre && <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{cliente.nombre}</div>}
        <div style={{ fontSize: 12, opacity: 0.35, fontFamily: "monospace", marginBottom: 14 }}>{serial}</div>

        <div style={{ ...panel, borderColor: accent }}>
          {esDescuento ? (
            <>
              <div style={cap}>Cupón</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: usado ? "#888" : accent }}>
                {usado ? "Ya usado" : "Válido — un uso"}
              </div>
              <div style={{ marginTop: 10, fontSize: 15, opacity: 0.85 }}>{n.premio}</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={cap}>Sellos</span>
                <span style={{ fontSize: 22, fontWeight: 500 }}>{Math.min(cliente.sellos, meta)}/{meta}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {dots.map((on, i) => <span key={i} style={dot(on, accent)}>{on ? "★" : ""}</span>)}
              </div>
              <div style={{ marginTop: 16, fontSize: 15 }}>
                {cliente.sellos >= meta
                  ? <span style={{ color: accent }}>🎁 Premio disponible: {n.premio}</span>
                  : <span style={{ opacity: 0.7 }}>Faltan {meta - cliente.sellos} para {n.premio}</span>}
              </div>
              {cliente.premios > 0 && <div style={{ marginTop: 6, fontSize: 13, opacity: 0.5 }}>Canjeados: {cliente.premios}</div>}
            </>
          )}
        </div>

        <WorkerActions serial={serial} acciones={acciones} accent={accent} />
        <SetNombre serial={serial} nombre={cliente.nombre} />

        {eventos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ ...cap, marginBottom: 8 }}>Actividad reciente</div>
            {eventos.map((e, i) => (
              <div key={i} style={{ fontSize: 14, opacity: 0.8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>{e.mensaje}</div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Center({ children }) {
  return <div style={{ textAlign: "center", fontSize: 40 }}>{children}</div>;
}

const wrap = { minHeight: "100vh", display: "grid", placeItems: "start center", background: "#0b0b0c", color: "#fff", padding: "2rem 1rem" };
const panel = { background: "#141416", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: "18px" };
const cap = { fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1 };
const dot = (on, accent) => ({ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 15, background: on ? accent : "transparent", color: "#111", border: on ? "0" : "1.5px solid rgba(255,255,255,.3)" });
