import Link from "next/link";
import LogoutButton from "@/app/LogoutButton";
import MarcaTienda from "@/app/MarcaTienda";
import Icono from "@/app/Icono";
import { BotonAyuda } from "@/app/Recorrido";
import { titulo, solapa } from "@/app/ui";

const SECCIONES = [
  ["manager", "Tarjeta y promos", "cartera"],
  ["crm", "Clientes", "clientes"],
];

// Cabecera de las pantallas del dueño (manager y clientes): marca, nombre y
// las mismas pestañas en las dos, para que se muevan entre ellas sin buscar.
// Con <Link>: el cambio no recarga la página y el esqueleto sale al momento.
// `ayuda`: la pantalla tiene recorrido de bienvenida y sale el (?) para repetirlo.
export default function CabeceraGestion({ negocio, slug, activa, ayuda = false }) {
  const accent = negocio.tema.accent;
  return (
    <header style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <MarcaTienda tema={negocio.tema} tam={42} icono />
          <h1 style={{ ...titulo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{negocio.nombre}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {ayuda && <BotonAyuda />}
          <LogoutButton negocio={slug} />
        </div>
      </div>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SECCIONES.map(([ruta, texto, icono]) => (
          <Link key={ruta} href={`/${slug}/${ruta}`} aria-current={ruta === activa ? "page" : undefined} style={solapa(ruta === activa, accent)}
            data-recorrido={`pestana-${ruta === "crm" ? "clientes" : ruta}`}>
            <Icono nombre={icono} tam={16} /> {texto}
          </Link>
        ))}
      </nav>
    </header>
  );
}
