import { C, paginaCentrada, aviso } from "./ui";

// Pantalla de "la base de datos no responde" para páginas públicas. Evita que un
// fallo de configuración tumbe el sitio con el error genérico de Next, y dice
// dónde mirar. El detalle viene de lib/diagnostico (nunca trae secretos).
export default function ErrorDatos({ detalle }) {
  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(560px, 92vw)", textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🔌</div>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 6 }}>No se puede conectar con la base de datos</h1>
        <p style={{ color: C.suave, fontSize: 15 }}>
          La tienda no puede cargar ahora mismo. Si administras esta app, revisa las variables de
          entorno y vuelve a desplegar.
        </p>
        {detalle && <p style={{ ...aviso(false), margin: "14px 0", textAlign: "left" }}>{detalle}</p>}
        <p style={{ color: C.tenue, fontSize: 13 }}>
          Más detalle en <code>/api/salud</code>
        </p>
      </div>
    </main>
  );
}
