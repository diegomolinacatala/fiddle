import { NextResponse } from "next/server";
import { listEventosDeNegocio, saveNegocio } from "@/lib/store";
import { zonaDe } from "@/lib/actividad";
import { hashClave } from "@/lib/claves";
import { empleadosActivos, empleadoDe, empleadoPublico, hayQueElegir, resumenDeHoy, pinValido, ponerPin, PIN_MIN, PIN_MAX } from "@/lib/plantilla";
import { quienDeRequest, ultimoDeRequest, ponerCookiesQuien, pinCorrecto } from "@/lib/quien";
import { pinBloqueado, anotarFalloPin, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno, exigirTienda } from "@/lib/http";
import { auditar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quién atiende desde ESTE móvil (lib/plantilla.js, lib/quien.js). La cuenta de
// la caja la comparten; cada empleado se identifica en su móvil con su PIN.
//   GET  ?b=<slug>  -> { elegir, empleado, ultimo, plantilla: [{id, nombre, tienePin}], hoy }
//        elegir:    hay que identificarse antes de sellar (cuenta de caja, gente dada de alta, nadie válido ahora)
//        ultimo:    quién fue la última vez en este móvil, para pedirle solo el PIN
//        hoy:       lo de hoy de quien atiende (sellos, clientes, premios), para su pantalla
//        Si la cookie vale, se renueva: HORAS_PIN más desde este uso.
//   POST ?b=<slug>  { id, pin }       -> comprueba el PIN y deja la cookie firmada
//        ?b=<slug>  { id, nuevoPin }  -> la primera vez (sin PIN aún): lo guarda (hash) y deja la cookie
//        400 PIN mal formado o ya tenía · 401 PIN incorrecto · 429 demasiados fallos (15 min)
// El dueño no se identifica: su cuenta ya dice quién es.

const solo = (e) => (e ? { id: e.id, nombre: e.nombre, tienePin: Boolean(e.pin) } : null);

export async function GET(request) {
  try {
    const { respuesta, slug, sesion, negocio } = await exigirTienda(request, "caja");
    if (respuesta) return respuesta;
    const { plantilla } = negocio;
    const esCaja = sesion.rol === "caja";
    const empleado = esCaja ? await quienDeRequest(request, slug, plantilla) : null;
    const ultimo = esCaja ? ultimoDeRequest(request, slug, plantilla) : null;
    let hoy = null;
    if (empleado) {
      // Dos días por si la medianoche de la tienda no es la del servidor; lo de hoy lo filtra resumenDeHoy.
      const eventos = await listEventosDeNegocio(slug, { dias: 2, limite: 2000 });
      hoy = resumenDeHoy(eventos, { id: empleado.id, zona: zonaDe(negocio) });
    }
    const res = NextResponse.json({
      elegir: hayQueElegir(sesion, plantilla) && !empleado,
      empleado: solo(empleado),
      ultimo: solo(ultimo),
      plantilla: empleadosActivos(plantilla).map(solo),
      hoy,
    });
    // Abrir la caja cuenta como usarla: la cookie se renueva.
    if (empleado) await ponerCookiesQuien(res, slug, empleado);
    return res;
  } catch (e) {
    return errorInterno("quien GET", e);
  }
}

export async function POST(request) {
  try {
    const { respuesta, slug, sesion, negocio } = await exigirTienda(request, "caja");
    if (respuesta) return respuesta;
    const body = (await request.json().catch(() => null)) ?? {};
    const e = typeof body.id === "string" ? empleadoDe(negocio.plantilla, body.id) : null;
    if (!e || e.baja) return jsonError("Esa persona no está en la plantilla", 400);

    // El límite de intentos vive en la base; si falla, se sigue (quedarse sin caja sería peor).
    const ip = ipDe(request);
    try {
      if (await pinBloqueado(slug, e.id, ip)) return jsonError("Demasiados intentos. Espera 15 minutos.", 429);
    } catch (err) {
      console.error("[quien] no se pudo consultar el límite de intentos:", err);
    }

    if (!e.pin) {
      // Primera vez: elige su PIN. Cambiarlo después pasa por que el manager se lo quite.
      const nuevo = pinValido(body.nuevoPin);
      if (!nuevo) return jsonError(`Elige un PIN de ${PIN_MIN} a ${PIN_MAX} cifras, no todas iguales`, 400);
      const r = ponerPin(negocio.plantilla, e.id, await hashClave(nuevo));
      if (r.error) return jsonError(r.error, 400);
      await saveNegocio(slug, { plantilla: r.plantilla });
      await auditar(sesion, slug, "plantilla", `pin ${e.id}`);
      const res = NextResponse.json({ ok: true, creado: true, empleado: empleadoPublico(r.empleado) });
      return ponerCookiesQuien(res, slug, r.empleado);
    }

    if (body.nuevoPin !== undefined) return jsonError("Ya tiene PIN. Si lo ha olvidado, el manager se lo quita desde Plantilla.", 400);
    if (!(await pinCorrecto(body.pin, e))) {
      await anotarFalloPin(slug, e.id, ip).catch((err) => console.error("[quien] no se pudo anotar el fallo:", err));
      return jsonError("PIN incorrecto", 401);
    }
    const res = NextResponse.json({ ok: true, empleado: empleadoPublico(e) });
    return ponerCookiesQuien(res, slug, e);
  } catch (e) {
    return errorInterno("quien POST", e);
  }
}
