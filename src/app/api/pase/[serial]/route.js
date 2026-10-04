import { getCliente, getNegocio, tiposDePaseInstalados } from "@/lib/store";
import { proveedorWallet } from "@/lib/wallet";
import { generarPkpass, MIME_PKPASS } from "@/lib/apple/firmar";
import { configDeDescarga } from "@/lib/apple/config";
import { clienteVigente } from "@/lib/unaTarjeta";
import { cookieAbierto } from "@/lib/todoListo";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pase/<serial> -> descarga el .pkpass (botón "Añadir a Apple Wallet"
// de /p/<serial>). Público como /p/<serial>: el serial es un uuid aleatorio.
// Con ?listo=1 (lo pide /p/<serial>/listo) deja además la cookie que avisa a esa
// página de que el pase ya ha llegado (ver lib/todoListo.js).
export async function GET(request, { params }) {
  if (proveedorWallet() !== "apple") return jsonError("Apple Wallet no está configurado", 404);
  try {
    const { serial } = await params;
    // El enlace de una tarjeta ya fusionada da la vigente: con ella están los sellos.
    const cliente = await clienteVigente(getCliente, serial);
    if (!cliente) return jsonError("Pase no encontrado", 404);
    const negocio = await getNegocio(cliente.negocio);
    if (!negocio) return jsonError("Negocio no encontrado", 404);

    // Con el Pass Type ID con que ya la tiene: si no, el iPhone la toma por otra
    // y se queda con dos tarjetas iguales (ver configDeDescarga).
    const config = configDeDescarga(negocio.slug, await tiposDePaseInstalados(cliente.serial));
    const cabeceras = new Headers({
      "content-type": MIME_PKPASS,
      "content-disposition": `attachment; filename="${negocio.slug}.pkpass"`,
      "cache-control": "no-store",
    });
    const url = new URL(request.url);
    if (url.searchParams.get("listo") === "1") {
      cabeceras.set("set-cookie", cookieAbierto(cliente.serial, url.protocol === "https:"));
    }
    return new Response(await generarPkpass(cliente, negocio, config), { headers: cabeceras });
  } catch (e) {
    return errorInterno("pase", e);
  }
}
