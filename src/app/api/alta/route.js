import { NextResponse } from "next/server";
import { crearNegocio, archivarNegocio } from "@/lib/store";
import { esSlug, ESTILOS, temaPorDefecto } from "@/lib/negocios";
import { datosNegocioNuevo } from "@/lib/validacion";
import { leerAlta, slugDeNombre } from "@/lib/alta";
import { PLAN_DEL_ALTA } from "@/lib/planes";
import { nuevaInvitacion } from "@/lib/invitaciones";
import { slugChocaConLogin } from "@/lib/accesos";
import { auditar } from "@/lib/auditoria";
import { limpiar, temaDe, ICONOS } from "@/app/home/tarjeta/opciones";
import { jsonError, errorInterno } from "@/lib/http";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// ALTA SOLA (público): una cafetería se crea su tienda desde /alta
// ----------------------------------------------------------------------------
// Crea la tienda en el plan Gratis y una invitación de alcance "alta": el dueño
// verifica ahí su correo con un código, que pasa a ser su usuario, y elige su
// contraseña y el usuario y la contraseña de la caja (lib/invitaciones.js). Frenan
// los abusos el límite por IP, el campo trampa, el correo verificado para entrar y
// que el admin ve cada alta con su local en el mapa (lib/alta.js).
// ============================================================================

const META = 8;
const PREMIO_DE_PARTIDA = "premio";
// Hasta cuántos «-2», «-3»… se prueban antes de rendirse.
const INTENTOS_DE_SLUG = 30;

// Lo elegido en «Diseña tu tarjeta», con UNA cartilla (la segunda la añade luego en
// su editor), o nada si no eligió: el tema de partida.
function disenoDe(eleccion) {
  if (!eleccion || typeof eleccion !== "object") return { premio: PREMIO_DE_PARTIDA, tema: {} };
  const e = limpiar({ ...eleccion, cartillas: 1 });
  const premio = ICONOS.find((i) => i.id === e.icono)?.premio || PREMIO_DE_PARTIDA;
  return { premio, tema: temaDe(e) };
}

// Crea la tienda con el primer slug libre: «cafe», «cafe-2», «cafe-3»… `extra`
// va en la misma escritura (crearNegocio): plan Gratis desde el primer momento.
async function crearConSlugLibre(tienda, diseno, extra) {
  const base = slugDeNombre(tienda);
  for (let i = 1; i <= INTENTOS_DE_SLUG; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const r = datosNegocioNuevo(
      { slug, nombre: tienda, tipo: "sellos", meta: META, premio: diseno.premio },
      { esSlug, ESTILOS, temaPorDefecto },
    );
    // Un slug que no vale (se confunde con un usuario de acceso, o es el que eligió la
    // caja de otra tienda) se salta como uno ocupado.
    if (r.error || (await slugChocaConLogin(slug))) continue;
    // Dos altas con el mismo nombre a la vez: la segunda choca al insertar (en
    // Supabase lanza) y prueba el siguiente.
    const creado = await crearNegocio({ ...r.datos, tema: { ...r.datos.tema, ...diseno.tema } }, extra).catch(() => ({ error: "ocupado" }));
    if (!creado.error) return creado.negocio;
  }
  return null;
}

export async function POST(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return jsonError("No permitido", 403);
  try {
    if (await usoExcedido("alta", ipDe(request))) {
      return jsonError("Demasiados intentos desde esta conexión. Prueba en un rato.", 429);
    }
    const body = await request.json().catch(() => ({}));
    // Campo trampa: una persona no ve «web», un robot que rellena todo sí. Se le dice
    // que fue bien para que no pruebe otra cosa.
    if (typeof body?.web === "string" && body.web.trim()) return NextResponse.json({ ok: true });

    const { datos, errores } = leerAlta(body);
    if (errores) return NextResponse.json({ error: Object.values(errores)[0], errores }, { status: 400 });

    const negocio = await crearConSlugLibre(datos.tienda, disenoDe(body.eleccion), {
      plan: PLAN_DEL_ALTA,
      // Lo que la web promete en Gratis: automáticos y programados, y el equipo con
      // su PIN. Encendido para la tienda NO es mandar nada: cada regla nace apagada
      // y necesita horario (lib/automatizaciones.js), y sin nadie en la plantilla la
      // caja funciona como siempre (lib/plantilla.js).
      avisosAvanzados: true,
      plantillaActiva: true,
      ubicaciones: [{ lat: datos.lugar.lat, lng: datos.lugar.lng }],
      alta: { fecha: new Date().toISOString(), nombre: datos.nombre, email: datos.email, telefono: datos.telefono, lugar: datos.lugar },
    });
    if (!negocio) return jsonError("No se pudo encontrar un nombre libre para la tienda. Prueba con otro.", 409);
    const slug = negocio.slug;

    // Desde aquí la tienda existe (ya en Gratis): si algo falla, queda dicho en el
    // registro con su slug.
    try {
      await auditar(null, slug, "alta", "alta sola");
      const { token } = await nuevaInvitacion(slug, { alcance: "alta" });
      return NextResponse.json({ ok: true, slug, ir: `/invitacion#${token}` }, { status: 201 });
    } catch (e) {
      // Sin invitación nadie puede entrar en ella: se archiva (no se borra: se ve en
      // /admin → Archivadas) y que repita.
      console.error(`[alta] tienda ${slug} creada sin invitación; se archiva:`, e);
      await archivarNegocio(slug).catch((e2) => console.error(`[alta] tampoco se pudo archivar ${slug}:`, e2));
      return errorInterno("alta", e);
    }
  } catch (e) {
    return errorInterno("alta", e);
  }
}
