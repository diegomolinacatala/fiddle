import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { negocioDePeticion, sesionDePeticion } from "../negocioDePeticion";
import { puedeAcceder } from "@/lib/auth";
import { apuntarEntradaAdmin } from "@/lib/auditoria";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import { negocioDelPersonal } from "@/lib/tarjeta";
import { comoDataUri } from "@/lib/apple/dibujo";
import { appUrl } from "@/lib/url";
import ErrorDatos from "@/app/ErrorDatos";
import { css } from "@/app/home/estilo";
import { cssPiezas, cssPagina } from "@/app/home/tarjeta/estilo";
import { cssExperiencia } from "@/app/home/experiencia/estilo";
import PrimerosPasos from "./PrimerosPasos";
import { cssPrimerosPasos } from "./estilo";
import { cssTarjeta } from "./estiloTarjeta";
import { cssQr } from "./estiloQr";
import { cssHorario } from "./estiloHorario";
import { cssClientes } from "./estiloClientes";
import { cssPromos } from "./estiloPromos";
import { cssCristal } from "./estiloCristal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Primeros pasos" };

// ============================================================================
// LOS PRIMEROS PASOS DEL DUEÑO (lib/primerosPasos.js, PrimerosPasos.js)
// ----------------------------------------------------------------------------
// Del manager, como Tienda. La tienda se lee aquí y llega ya pintada; el QR del
// mostrador también se hace aquí (el mismo enlace que el de Tienda), con sus
// módulos sueltos para que el paso del QR lo pueda dibujar entrando.
// Una tienda sin primeros pasos (las que ya trabajaban) vuelve a su panel.
// ============================================================================

export default async function Page({ params }) {
  const { negocio: slug } = await params;
  const sesion = await sesionDePeticion();
  if (!puedeAcceder(sesion, slug, "manager")) redirect(`/login?b=${slug}&next=/${slug}/primeros-pasos`);
  await apuntarEntradaAdmin(sesion, slug, "Primeros pasos");

  let n;
  try {
    n = await negocioDePeticion(slug);
  } catch (e) {
    console.error(`[primeros pasos ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();
  if (!n.primerosPasos) redirect(`/${slug}/manager`);

  const tapUrl = `${appUrl()}/api/tap?b=${slug}`;
  const opciones = { margin: 0, errorCorrectionLevel: "M" };
  const svg = await QRCode.toString(tapUrl, { ...opciones, type: "svg", color: { dark: "#000000", light: "#ffffff" } });
  const { modules } = QRCode.create(tapUrl, opciones);
  const qr = { src: comoDataUri(svg), lado: modules.size, modulos: Array.from(modules.data, (b) => (b ? "1" : "0")).join("") };

  return (
    <div className="home claro">
      <style>{css + cssPiezas + cssPagina + cssExperiencia + cssPrimerosPasos + cssTarjeta + cssQr + cssHorario + cssClientes + cssPromos + cssCristal}</style>
      <main id="contenido">
        <PrimerosPasos slug={slug} inicial={negocioDelPersonal(n)} tapUrl={tapUrl} qr={qr} />
      </main>
    </div>
  );
}
