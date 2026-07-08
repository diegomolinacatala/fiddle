import { getCliente, getPrograma, listEventos } from "@/lib/store";
import { LISTA_ACCIONES } from "@/lib/acciones";
import WorkerActions from "./WorkerActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vista del TRABAJADOR (móvil). Es lo que abre el QR del pase al escanearlo.
// Muestra el perfil del cliente y los botones de acción activos.
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);

  if (!cliente) {
    return (
      <main style={wrap}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ opacity: 0.7 }}>Cliente no encontrado</p>
        </div>
      </main>
    );
  }

  const prog = await getPrograma();
  const eventos = await listEventos(serial);
  const acciones = LISTA_ACCIONES.filter((a) => prog.acciones.includes(a.key));
  const meta = prog.meta;
  const completa = cliente.sellos >= meta;
  const dots = Array.from({ length: meta }, (_, i) => i < Math.min(cliente.sellos, meta));

  return (
    <main style={wrap}>
      <div style={{ width: "min(430px, 94vw)" }}>
        <div style={{ fontSize: 13, opacity: 0.5 }}>Perfil de cliente · {prog.titulo}</div>
        <div style={{ fontSize: 12, opacity: 0.35, fontFamily: "monospace", marginBottom: 14 }}>
          {serial}
        </div>

        {/* Estado */}
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1 }}>
              Sellos
            </span>
            <span style={{ fontSize: 22, fontWeight: 500 }}>
              {Math.min(cliente.sellos, meta)}/{meta}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {dots.map((on, i) => (
              <span key={i} style={dot(on)}>{on ? "★" : ""}</span>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 15 }}>
            {completa ? (
              <span style={{ color: "#ffd60a" }}>🎁 Premio disponible: {prog.premio}</span>
            ) : (
              <span style={{ opacity: 0.7 }}>Faltan {meta - cliente.sellos} para {prog.premio}</span>
            )}
          </div>
          {cliente.premios > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.5 }}>
              Premios canjeados: {cliente.premios}
            </div>
          )}
        </div>

        {/* Botones de acción (los que el manager activó) */}
        <WorkerActions serial={serial} acciones={acciones} />

        {/* Historial */}
        {eventos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, opacity: 0.45, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Actividad reciente
            </div>
            {eventos.map((e, i) => (
              <div key={i} style={{ fontSize: 14, opacity: 0.8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                {e.mensaje}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const wrap = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "start center",
  background: "#0b0b0c",
  color: "#fff",
  padding: "2rem 1rem",
};
const panel = {
  background: "#141416",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 16,
  padding: "18px 18px",
};
const dot = (on) => ({
  width: 28,
  height: 28,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 15,
  background: on ? "#fff" : "transparent",
  color: "#000",
  border: on ? "0" : "1.5px solid rgba(255,255,255,.3)",
});
