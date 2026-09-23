import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCliente, getNegocio, listEventos, clientePublico } from "@/lib/store";
import { accionesDe } from "@/lib/acciones";
import { clienteVigente } from "@/lib/unaTarjeta";
import { verificarSesion, puedeAcceder, COOKIE } from "@/lib/auth";
import { estadoDe } from "@/lib/resumen";
import TarjetaCaja from "./TarjetaCaja";
import { negocioDeTarjeta } from "@/lib/tarjeta";
import SetNombre from "./SetNombre";
import MarcaTienda from "@/app/MarcaTienda";
import Icono from "@/app/Icono";
import { C, pagina, chipCodigo, botonSecundario } from "@/app/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente · caja", robots: { index: false, follow: false } };

// Vista del TRABAJADOR (lo que abre el QR del pase). Perfil + acciones.
// El middleware ya exige sesión; aquí se comprueba que sea del negocio del cliente.
// La banda es la misma que ve el cliente en su tarjeta: caja y cliente miran lo mismo.
export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial);
  // El QR de una tarjeta antigua (fusionada en la nueva): a la buena, sin preguntar.
  if (cliente?.fusionado_en) {
    const vigente = await clienteVigente(getCliente, serial);
    if (vigente) redirect(`/w/${vigente.serial}`);
  }
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

        <TarjetaCaja
          serial={serial}
          inicial={clientePublico(cliente)}
          negocio={{ ...negocioDeTarjeta(n), acciones: n.acciones }}
          acciones={acciones}
        />

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
const cap = { fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 };
const siguiente = {
  ...botonSecundario,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  marginTop: 10, textDecoration: "none", minHeight: 46,
};
