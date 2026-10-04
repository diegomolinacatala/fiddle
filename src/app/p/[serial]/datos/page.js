import { getCliente, getNegocio } from "@/lib/store";
import { C, paginaCentrada } from "@/app/ui";
import TusDatos from "./TusDatos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tu tarjeta y tus datos", robots: { index: false, follow: false } };

// ============================================================================
// "TU TARJETA Y TUS DATOS" (docs/RGPD.md, 3.5)
// ----------------------------------------------------------------------------
// Lo que el cliente puede hacer solo: dejar las promos, descargar lo que
// guardamos de él y borrar la tarjeta. Se llega desde el reverso del pase
// (Apple), los enlaces de Google Wallet, la tarjeta web y el botón de la página
// de la tienda.
//
// Aquí no se decide quién entra: la llave va tras el # y el servidor no la ve al
// cargar la página. La página solo pinta la tienda (público, como /p/<serial>)
// y lo demás lo pide /api/tarjeta/<serial>/datos con la llave o la cookie.
// ============================================================================

export default async function Page({ params }) {
  const { serial } = await params;
  const cliente = await getCliente(serial).catch(() => null);
  const negocio = cliente ? await getNegocio(cliente.negocio, { incluirArchivados: true }).catch(() => null) : null;
  if (!cliente || !negocio || cliente.borrado_en || cliente.fusionado_en) {
    return (
      <main style={paginaCentrada}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>{cliente?.borrado_en ? "Esta tarjeta ya está borrada" : "Esta tarjeta no existe"}</h1>
          <p style={{ color: C.suave, margin: 0 }}>
            {cliente?.borrado_en ? "Sus datos se han borrado. Puedes quitarla del teléfono." : "Puede que el enlace esté incompleto."}
          </p>
        </div>
      </main>
    );
  }
  // Solo lo que hace falta para pintarla con los colores de la tienda.
  const tienda = { slug: negocio.slug, nombre: negocio.nombre, tema: negocio.tema };
  return <TusDatos serial={serial} tienda={tienda} />;
}
