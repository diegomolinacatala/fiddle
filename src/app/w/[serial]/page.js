import { cookies } from "next/headers";
import { getCliente, getNegocio, listEventos } from "@/lib/store";
import { accionesDe } from "@/lib/acciones";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import { stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { estadoDe } from "@/lib/resumen";
import { cartillasDe, describirBanda } from "@/lib/cartillas";
import WorkerActions from "./WorkerActions";
import SetNombre from "./SetNombre";
import MarcaTienda from "@/app/MarcaTienda";
import Icono from "@/app/Icono";
import { C, pagina, panel, chipCodigo, botonSecundario } from "@/app/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente · caja", robots: { index: false, follow: false } };

// Vista del TRABAJADOR (lo que abre el QR del pase). Perfil + acciones.
// El middleware ya exige sesión; aquí se comprueba que sea del negocio del cliente.
// La banda es la misma que ve el cliente en su tarjeta: caja y cliente miran lo mismo.
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  if (!cliente) {
    return (
      <main style={pagina}>
        <Aviso titulo="No hay ninguna tarjeta con ese código" texto="Puede que el QR esté dañado. Prueba a escribir el código de 3 letras." />
      </main>
    );
  }

  const sesion = await verificarSesion((await cookies()).get(COOKIE)?.value);
  if (!puedeAcceder(sesion, cliente.negocio, "caja")) {
    return (
      <main style={pagina}>
        <Aviso titulo="Esta tarjeta es de otra tienda" texto="Solo la caja de su tienda puede sumarle sellos.">
          <a href={`/login?b=${cliente.negocio}&next=/w/${serial}`} style={{ fontSize: 14 }}>Entrar con la caja de esa tienda</a>
        </Aviso>
      </main>
    );
  }

  const n = await getNegocio(cliente.negocio);
  const eventos = await listEventos(serial);
  const acciones = accionesDe(n);
  const accent = n.tema.accent;
  const e = estadoDe(cliente, n);
  const banda = stripDelPase(n, cliente);

  return (
    <main style={pagina}>
      <div style={{ width: "min(430px, 94vw)" }}>
        <a href={`/${n.slug}/caja`} style={volver}>
          <Icono nombre="volver" tam={16} />
          <MarcaTienda tema={n.tema} tam={20} />
          {n.nombre}
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 16px" }}>
          <span style={{ ...chipCodigo(accent), fontSize: 18, padding: "4px 10px" }}>{cliente.codigo}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{cliente.nombre || "Sin nombre"}</div>
            <div style={{ fontSize: 13, color: C.suave }}>
              {cliente.visitas ? `${cliente.visitas} ${cliente.visitas === 1 ? "visita" : "visitas"}` : "Primera visita"}
              {cliente.premios > 0 && !e.esCupon ? ` · ${cliente.premios} ${cliente.premios === 1 ? "premio canjeado" : "premios canjeados"}` : ""}
            </div>
          </div>
        </div>

        <div style={{ ...panel, padding: 0, overflow: "hidden", borderColor: `${accent}66` }}>
          <img
            src={comoDataUri(banda.svg)}
            alt={e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, n)}
            style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${banda.ancho} / ${banda.alto}` }}
          />
          {!e.esCupon && n.cartillas ? cartillasDe(cliente, n).map((c) => (
            <div key={c.clave} style={{ ...cuentaFila, borderTop: c.indice ? `1px solid ${C.borde}` : 0 }}>
              <span style={{ fontSize: 15, color: c.completa ? accent : C.suave, fontWeight: c.completa ? 650 : 400 }}>
                <strong style={{ color: C.texto, fontWeight: 600 }}>{c.nombre}</strong>
                {" · "}{c.completa ? `premio listo: ${c.premio}` : `faltan ${c.faltan} para ${c.premio}`}
              </span>
              <span style={{ fontSize: 20, fontWeight: 650 }}>{c.sellos}/{c.meta}</span>
            </div>
          )) : (
          <div style={cuentaFila}>
            {e.esCupon ? (
              <>
                <span style={{ fontSize: 16, fontWeight: 600, color: e.usado ? C.tenue : accent }}>{e.usado ? "Ya usado" : "Válido, un solo uso"}</span>
                <span style={{ fontSize: 14, color: C.suave, textAlign: "right" }}>{n.premio}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, color: e.completa ? accent : C.suave, fontWeight: e.completa ? 650 : 400 }}>
                  {e.completa ? `Premio listo: ${n.premio}` : `Faltan ${e.faltan} para ${n.premio}`}
                </span>
                <span style={{ fontSize: 22, fontWeight: 650 }}>{e.sellos}/{e.meta}</span>
              </>
            )}
          </div>
          )}
        </div>

        <WorkerActions serial={serial} acciones={acciones} accent={accent} />

        <a href={`/${n.slug}/caja?escanear=1`} style={siguiente}>
          <Icono nombre="camara" tam={18} /> Escanear al siguiente
        </a>

        <SetNombre serial={serial} nombre={cliente.nombre} />

        {eventos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ ...cap, marginBottom: 8 }}>Actividad reciente</div>
            {eventos.map((ev, i) => (
              <div key={i} style={{ fontSize: 14, color: C.suave, padding: "7px 0", borderBottom: `1px solid ${C.borde}` }}>{ev.mensaje}</div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Aviso({ titulo, texto, children }) {
  return (
    <div style={{ textAlign: "center", width: "min(430px, 94vw)", marginTop: "18vh" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>{titulo}</h1>
      <p style={{ color: C.suave, fontSize: 15, margin: "0 0 12px" }}>{texto}</p>
      {children}
    </div>
  );
}

const volver = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: C.suave, textDecoration: "none", fontWeight: 500 };
const cuentaFila = { padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 };
const cap = { fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 };
const siguiente = {
  ...botonSecundario,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  marginTop: 10, textDecoration: "none", minHeight: 46,
};
