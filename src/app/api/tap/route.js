import { NextResponse } from "next/server";
import { emitirPase } from "@/lib/wallet";
import { getCliente, getNegocio, guardarNombre } from "@/lib/store";
import { clienteVigente } from "@/lib/unaTarjeta";
import { hayApple } from "@/lib/apple/config";
import { destinoDelTap } from "@/lib/googlewallet";
import { esSlug } from "@/lib/negocios";
import { plataformaDe } from "@/lib/plataforma";
import { cookieDeTarjeta, serialRecordado, opcionesCookieTarjeta } from "@/lib/recordar";
import { nombreDeCliente } from "@/lib/validacion";
import { jsonError, errorInterno } from "@/lib/http";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// En iPhone, el .pkpass NO va en esta misma respuesta: se redirige a
// /api/pase/<serial>. Así la cookie que recuerda la tarjeta viaja en una
// redirección normal, que Safari guarda siempre, y no en la descarga que se
// queda el Wallet (si esa cookie se pierde, el siguiente escaneo da otra
// tarjeta). Cuesta un salto de red y nada más.
const descargaPkpass = (serial, request) => NextResponse.redirect(new URL(`/api/pase/${serial}`, request.url), 302);

// La tarjeta que este teléfono ya tiene en la tienda, o null. Si la recordada
// se fusionó en otra (ver lib/unaTarjeta.js), la buena es esa.
async function tarjetaRecordada(request, slug) {
  const serial = serialRecordado(request.cookies.get(cookieDeTarjeta(slug))?.value);
  const suya = serial ? await clienteVigente(getCliente, serial) : null;
  return suya?.negocio === slug ? suya : null;
}

const recordar = (respuesta, slug, serial, url) => {
  respuesta.cookies.set(cookieDeTarjeta(slug), serial, opcionesCookieTarjeta(url.protocol === "https:"));
  return respuesta;
};

// El "tap NFC" de un negocio. El tag y el QR del mostrador guardan /api/tap?b=<slug>.
//
// Si este teléfono YA tiene tarjeta de la tienda (cookie), se le devuelve la
// suya: tocar el tag dos veces no parte los sellos en dos cartillas, y en
// Android el tag es la forma natural de volver a abrir la tarjeta.
//   iPhone + pase real -> el .pkpass (iOS lo reconoce por el serial y lo
//   actualiza en vez de duplicarlo). Android + Google Wallet -> a guardarla ahí.
//   Resto -> la tarjeta web (/p/<serial>).
//
// Si no, a la página de la tienda, que le pide el nombre y luego le ofrece la
// Wallet (el POST de abajo). La tarjeta no se crea hasta tener el nombre: quien
// escanea y se va no deja un cliente vacío. `?nuevo=1` pide otra aunque ya
// tenga una (para probar desde el mostrador).
export async function GET(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  const nuevo = url.searchParams.get("nuevo") === "1";

  try {
    const suya = nuevo ? null : await tarjetaRecordada(request, slug);
    if (!suya) return NextResponse.redirect(new URL(`/${slug}${nuevo ? "?nuevo=1" : ""}`, request.url), 302);

    const plataforma = plataformaDe(request.headers.get("user-agent"));
    const respuesta = plataforma === "ios" && hayApple()
      ? descargaPkpass(suya.serial, request)
      // Al destino en el MISMO dominio por el que entró: un deploy de prueba no
      // debe mandar al cliente a producción.
      : NextResponse.redirect(new URL(destinoDelTap(plataforma, suya.serial), request.url), 302);
    return recordar(respuesta, slug, suya.serial, url);
  } catch (e) {
    return errorInterno("tap", e);
  }
}

// POST /api/tap?b=<slug>[&nuevo=1]  { nombre } -> crea la tarjeta con ese nombre.
//
// Lo manda el formulario de la página de la tienda: con JavaScript va en JSON y
// responde `{ ir }`; sin él (el cliente escribió antes de que cargara) es un
// formulario normal y responde con una redirección a `ir`. En los dos casos
// `ir` es la página de la tienda, que ya ve la cookie y ofrece la Wallet.
export async function POST(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("b");
  if (!esSlug(slug)) return jsonError("Falta o no existe ?b=<negocio>", 400);
  // Solo desde nuestra propia página: otra web no puede sacar tarjetas en el
  // navegador de quien la visita (con ?nuevo=1 le cambiaría la suya por otra).
  if (request.headers.get("sec-fetch-site") === "cross-site") return jsonError("No permitido", 403);

  const nuevo = url.searchParams.get("nuevo") === "1";
  const pagina = `/${slug}${nuevo ? "?nuevo=1" : ""}`;
  const esJson = (request.headers.get("content-type") || "").includes("application/json");
  const datos = esJson ? await request.json().catch(() => null) : await request.formData().then(Object.fromEntries, () => null);
  const nombre = nombreDeCliente(datos?.nombre);
  if (!nombre) return esJson ? jsonError("Escribe tu nombre", 400) : NextResponse.redirect(new URL(pagina, request.url), 303);

  try {
    let cliente = nuevo ? null : await tarjetaRecordada(request, slug);
    let ir = `/${slug}`;
    if (cliente) {
      // Ya tenía (otra pestaña, o volvió atrás y lo envió de nuevo): la misma, no otra.
      if (!cliente.nombre) await guardarNombre(cliente.serial, nombre);
    } else {
      if (!(await getNegocio(slug))) return jsonError("Esta tienda no existe", 404);
      if (await usoExcedido("tap", ipDe(request))) {
        return jsonError("Demasiadas tarjetas desde esta conexión. Prueba en unos minutos.", 429);
      }
      const r = await emitirPase(slug, { origen: "tap", nombre });
      cliente = r.cliente;
      // Plan B sin cuenta de Apple: su página es la que sabe meterla en la Wallet.
      if (r.proveedor === "walletwallet") ir = r.shareUrl;
    }

    const respuesta = esJson ? NextResponse.json({ ok: true, ir }) : NextResponse.redirect(new URL(ir, request.url), 303);
    return recordar(respuesta, slug, cliente.serial, url);
  } catch (e) {
    return errorInterno("tap POST", e);
  }
}
