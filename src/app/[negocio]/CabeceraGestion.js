import Link from "next/link";
import LogoutButton from "@/app/LogoutButton";
import MarcaTienda from "@/app/MarcaTienda";
import Icono from "@/app/Icono";
import { titulo, solapa } from "@/app/ui";

// Tres pestañas, una por pregunta, y cada cosa en UNA de ellas:
//   Tienda    cómo es la tarjeta, qué hace la caja, cuándo abre, el QR
//   Clientes  quién viene (y la exportación, junto a la lista que exporta)
//   Avisos    qué se les dice: a mano (a todos o a un grupo) y automático
const SECCIONES = [
  ["manager", "Tienda", "puerta"],
  ["crm", "Clientes", "clientes"],
  ["avisos", "Avisos", "megafono"],
];

// Cabecera de las pantallas del dueño: marca, nombre y las mismas pestañas en
// todas, para que se muevan entre ellas sin buscar.
// Con <Link>: el cambio no recarga la página y el esqueleto sale al momento.
export default function CabeceraGestion({ negocio, slug, activa }) {
  const accent = negocio.tema.accent;
  return (
    <header style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <MarcaTienda tema={negocio.tema} tam={42} icono />
          <h1 style={{ ...titulo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{negocio.nombre}</h1>
        </div>
        <LogoutButton negocio={slug} />
      </div>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SECCIONES.map(([ruta, texto, icono]) => (
          <Link key={ruta} href={`/${slug}/${ruta}`} aria-current={ruta === activa ? "page" : undefined} style={solapa(ruta === activa, accent)}>
            <Icono nombre={icono} tam={16} /> {texto}
          </Link>
        ))}
      </nav>
    </header>
  );
}
