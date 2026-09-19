import { cookies } from "next/headers";
import { getCliente, getNegocio, listEventos } from "@/lib/store";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import WorkerActions from "./WorkerActions";
import SetNombre from "./SetNombre";
import { C, pagina, panel, chipCodigo } from "@/app/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vista del TRABAJADOR (lo que abre el QR del pase). Perfil + acciones.
// El middleware ya exige sesión; aquí se comprueba que sea del negocio del cliente.
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) return <main style={pagina}><Centro>🔍<br /><span style={aclaracion}>Cliente no encontrado</span></Centro></main>;

  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, cliente.negocio, "caja")) {
    return (
      <main style={pagina}>
        <Centro>
          🚫<br />
          <span style={aclaracion}>Este pase es de otro negocio.</span><br />
          <a href={`/login?b=${cliente.negocio}&next=/w/${serial}`} style={{ fontSize: 14 }}>Entrar con otra caja</a>
        </Centro>
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
    <main style={pagina}>
      <div style={{ width: "min(430px, 94vw)" }}>
        <a href={`/${n.slug}/caja`} style={{ fontSize: 13, color: C.suave, textDecoration: "none" }}>← {n.tema.emoji} {n.nombre}</a>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 16px" }}>
          <span style={{ ...chipCodigo(accent), fontSize: 18, padding: "4px 10px" }}>{cliente.codigo}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{cliente.nombre || "Sin nombre"}</div>
            <div style={{ fontSize: 11, color: C.tenue, fontFamily: "ui-monospace, Menlo, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{serial}</div>
          </div>
        </div>

        <div style={{ ...panel, borderColor: `${accent}66` }}>
          {esDescuento ? (
            <>
              <div style={cap}>Cupón</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: usado ? C.tenue : accent }}>
                {usado ? "Ya usado" : "Válido — un uso"}
              </div>
              <div style={{ marginTop: 10, fontSize: 15, color: C.suave }}>{n.premio}</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={cap}>Sellos</span>
                <span style={{ fontSize: 22, fontWeight: 600 }}>{Math.min(cliente.sellos, meta)}/{meta}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {dots.map((on, i) => <span key={i} style={punto(on, accent)}>{on ? "★" : ""}</span>)}
              </div>
              <div style={{ marginTop: 16, fontSize: 15 }}>
                {cliente.sellos >= meta
                  ? <span style={{ color: accent, fontWeight: 600 }}>🎁 Premio disponible: {n.premio}</span>
                  : <span style={{ color: C.suave }}>Faltan {meta - cliente.sellos} para {n.premio}</span>}
              </div>
              {cliente.premios > 0 && <div style={{ marginTop: 6, fontSize: 13, color: C.tenue }}>Canjeados: {cliente.premios}</div>}
            </>
          )}
        </div>

        <WorkerActions serial={serial} acciones={acciones} accent={accent} />
        <SetNombre serial={serial} nombre={cliente.nombre} />

        {eventos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ ...cap, marginBottom: 8 }}>Actividad reciente</div>
            {eventos.map((e, i) => (
              <div key={i} style={{ fontSize: 14, color: C.suave, padding: "7px 0", borderBottom: `1px solid ${C.borde}` }}>{e.mensaje}</div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Centro({ children }) {
  return <div style={{ textAlign: "center", fontSize: 40, width: "min(430px, 94vw)" }}>{children}</div>;
}

const aclaracion = { color: C.suave, fontSize: 16 };
const cap = { fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 };
const punto = (on, accent) => ({
  width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 15,
  background: on ? accent : "transparent", color: "#fff", border: on ? 0 : `1.5px solid ${C.bordeFuerte}`,
});
