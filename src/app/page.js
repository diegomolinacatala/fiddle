import { redirect } from "next/navigation";
import { appMode } from "@/lib/appmode";

export const dynamic = "force-dynamic";

// Hub de entrada. Con APP_MODE=worker|manager, "/" va directa a esa app.
export default function Home() {
  const mode = appMode();
  if (mode === "worker") redirect("/worker");
  if (mode === "manager") redirect("/manager");

  return (
    <main style={wrap}>
      <div style={{ width: "min(460px, 92vw)" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: 2 }}>☕ Sellos</h1>
        <p style={{ opacity: 0.6, marginTop: 0 }}>
          Dos apps separadas. El pase del cliente es solo un QR con su identidad.
        </p>

        <a href="/worker" style={card}>
          <strong>📱 Caja (trabajador)</strong>
          <span style={sub}>Escanea el pase y actúa · añádela a tu pantalla de inicio</span>
        </a>
        <a href="/manager" style={card}>
          <strong>🖥️ Manager</strong>
          <span style={sub}>Configura qué hace un escaneo y lanza promos</span>
        </a>
        <a href="/api/tap" style={card}>
          <strong>🏷️ Emitir pase (tap NFC)</strong>
          <span style={sub}>Lo que abre el tag NFC de la tienda: crea un pase</span>
        </a>
      </div>
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
const card = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "1.1rem 1.3rem",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.14)",
  background: "#141416",
  color: "#fff",
  textDecoration: "none",
  marginTop: 14,
};
const sub = { opacity: 0.55, fontSize: 14 };
