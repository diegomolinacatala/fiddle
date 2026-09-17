// Pantalla de "la base de datos no responde" para páginas públicas. Evita que un
// fallo de configuración tumbe el sitio con el error genérico de Next, y dice
// dónde mirar. El detalle viene de lib/diagnostico (nunca trae secretos).
export default function ErrorDatos({ detalle }) {
  return (
    <main style={wrap}>
      <div style={{ width: "min(560px, 92vw)", textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🔌</div>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 6 }}>No se puede conectar con la base de datos</h1>
        <p style={{ opacity: 0.7, fontSize: 15 }}>
          La tienda no puede cargar ahora mismo. Si administras esta app, revisa las variables de
          entorno y vuelve a desplegar.
        </p>
        {detalle && <p style={caja}>{detalle}</p>}
        <p style={{ opacity: 0.5, fontSize: 13 }}>
          Más detalle en <code>/api/salud</code>
        </p>
      </div>
    </main>
  );
}

const wrap = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0c", color: "#fff", padding: "1.5rem" };
const caja = {
  margin: "14px 0", padding: "12px 14px", borderRadius: 12, fontSize: 14, textAlign: "left",
  background: "rgba(255,69,58,.12)", border: "1px solid rgba(255,69,58,.35)",
};
