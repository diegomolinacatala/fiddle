import { NextResponse } from "next/server";
import * as servicio from "@/lib/dueno/servicio";
import { tiendaDeSerial, tarjetaDe, guardarTarjeta, conDispositivo, sinDispositivo } from "@/lib/dueno/tarjeta";
import { estadoVigente, avisarDueno } from "@/lib/dueno/servidor";
import { generarPkpassDueno } from "@/lib/dueno/firmar";
import { recibirDe, validarRecibir } from "@/lib/dueno/recibir";
import { configApple } from "@/lib/apple/config";
import { listNegocios } from "@/lib/store";
import { exigirTienda, aResponse, jsonError, errorInterno } from "@/lib/http";
import { auditar } from "@/lib/auditoria";
import { usoExcedido, ipDe } from "@/lib/limitador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La tarjeta del dueño. UNA sola ruta a propósito: en dev cada función de Vercel
// tiene su /tmp, y el registro del iPhone, la prueba y la descarga tienen que
// verse entre sí.
//
//   GET    /api/dueno/pase?b=<slug>      el .pkpass (solo el manager)
//   GET    /api/dueno/vista?b=<slug>     lo que enseña la vista previa de Tienda (solo el manager)
//   POST   /api/dueno/prueba?b=<slug>    un aviso de prueba de 15 minutos (solo el manager)
//   PUT    /api/dueno/recibir?b=<slug>   qué quiere recibir el dueño (solo el manager)
//   .../api/dueno/v1/...                 el web service de Apple (lo protege el token del pase)

const MINUTOS_PRUEBA = 15;
const TEXTO_PRUEBA = "Esto es una prueba. Así te avisará fiddle cuando los números digan algo.";

function depsServicio() {
  const config = configApple();
  if (!config) return null;
  return {
    passTypeGeneral: config.passTypeId,
    tiendaDeSerial, tarjetaDe, guardarTarjeta, conDispositivo, sinDispositivo, listNegocios,
    estadoVigente, generarPkpass: (estado, negocio) => generarPkpassDueno(estado, negocio, config),
    log: (mensaje) => console.warn(mensaje),
  };
}

async function descargarPase(request) {
  const { respuesta, sesion, negocio } = await exigirTienda(request, "manager");
  if (respuesta) return respuesta;
  if (!configApple()) return jsonError("Apple Wallet no configurado", 404);
  const tarjeta = tarjetaDe(negocio);
  if (!tarjeta) return jsonError("Esta tienda no tiene la tarjeta del dueño", 404);
  const body = await generarPkpassDueno(await estadoVigente(negocio), negocio);
  await auditar(sesion, negocio.slug, "exportar", "tarjeta del dueño");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/vnd.apple.pkpass",
      "content-disposition": `attachment; filename="fiddle-${negocio.slug}.pkpass"`,
      "cache-control": "no-store",
    },
  });
}

// La vista previa de Tienda se pide al abrirla: calcular el informe lee el historial
// entero y no debe pasar cada vez que alguien entra en Tienda.
async function verVista(request) {
  const { respuesta, negocio } = await exigirTienda(request, "manager");
  if (respuesta) return respuesta;
  if (!tarjetaDe(negocio)) return jsonError("Esta tienda no tiene la tarjeta del dueño", 404);
  const { informe, aviso } = await estadoVigente(negocio);
  return NextResponse.json({ informe, aviso: aviso ?? null }, { headers: { "cache-control": "no-store" } });
}

async function ponerPrueba(request) {
  const { respuesta, sesion, negocio } = await exigirTienda(request, "manager");
  if (respuesta) return respuesta;
  const tarjeta = tarjetaDe(negocio);
  if (!tarjeta) return jsonError("Esta tienda no tiene la tarjeta del dueño", 404);
  const ahora = Date.now();
  // Con una prueba vigente no se vuelve a empujar: así nadie lanza avisos sin tope.
  if (tarjeta.prueba && Date.parse(tarjeta.prueba.hasta) > ahora) {
    return NextResponse.json({ ok: true, avisados: 0, repetida: true });
  }
  const guardada = await guardarTarjeta(negocio.slug, {
    prueba: { texto: TEXTO_PRUEBA, hasta: new Date(ahora + MINUTOS_PRUEBA * 60_000).toISOString() },
    actualizado: new Date(ahora).toISOString(),
  });
  const { enviados, motivo } = await avisarDueno(guardada);
  await auditar(sesion, negocio.slug, "config", "tarjeta del dueño: prueba");
  return NextResponse.json({ ok: true, avisados: enviados, ...(motivo ? { motivo } : {}) });
}

// Solo las tres claves de `recibir` (lib/dueno/recibir.js): nada más de la tarjeta se
// escribe desde aquí. Con `actualizado` nuevo el iPhone se baja la versión que toca; y
// si cambian las ideas se le empuja, para que el aviso del día aparezca o se quite ya
// (al quitarse vuelve a PREMIOS DADOS sin changeMessage: no suena).
async function cambiarRecibir(request) {
  const { respuesta, sesion, negocio } = await exigirTienda(request, "manager");
  if (respuesta) return respuesta;
  const tarjeta = tarjetaDe(negocio);
  if (!tarjeta) return jsonError("Esta tienda no tiene la tarjeta del dueño", 404);
  const validado = validarRecibir(await request.json().catch(() => null));
  if (!validado.ok) return jsonError(validado.error, 400);
  const antes = recibirDe(tarjeta);
  const recibir = { ...antes, ...validado.cambios };
  const guardada = await guardarTarjeta(negocio.slug, { recibir, actualizado: new Date().toISOString() });
  if (recibir.ideas !== antes.ideas) await avisarDueno(guardada);
  await auditar(sesion, negocio.slug, "config", "tarjeta del dueño: qué recibe");
  return NextResponse.json({ ok: true, recibir });
}

/** true si esta IP se pasó de uso en un recurso público. Si el limitador falla, se deja pasar. */
async function excedido(request, recurso) {
  try {
    return await usoExcedido(recurso, ipDe(request));
  } catch (e) {
    console.error(`[tarjeta-dueno ${recurso}] limitador`, e);
    return false;
  }
}

async function registrarLog(request) {
  if (await excedido(request, "log")) return new Response(null, { status: 200 });
  const cuerpo = await request.json().catch(() => null);
  return aResponse(servicio.registrarLogs({ log: (m) => console.warn(m) }, { cuerpo }));
}

/** El web service de Apple: v1/devices/<d>/registrations/<passType>[/<serial>], v1/passes/<passType>/<serial>. */
async function webService(request, metodo, [, ...s]) {
  const authorization = request.headers.get("authorization");
  const deps = depsServicio();
  if (!deps) return jsonError("Apple Wallet no configurado", 404);

  if (s[0] === "devices" && s[2] === "registrations" && s[3]) {
    const base = { dispositivo: s[1], passType: s[3], serial: s[4], authorization };
    if (s.length === 5 && metodo === "POST") {
      return aResponse(await servicio.registrar(deps, { ...base, cuerpo: await request.json().catch(() => null) }));
    }
    if (s.length === 5 && metodo === "DELETE") return aResponse(await servicio.desregistrar(deps, base));
    if (s.length === 4 && metodo === "GET") {
      // Público y recorre todas las tiendas: con tope por IP (un iPhone pregunta pocas veces).
      if (await excedido(request, "dueno")) return new Response(null, { status: 429 });
      const desde = new URL(request.url).searchParams.get("passesUpdatedSince");
      return aResponse(await servicio.pasesActualizados(deps, { ...base, desde }));
    }
  }
  if (s[0] === "passes" && s.length === 3 && metodo === "GET") {
    return aResponse(await servicio.paseActual(deps, { passType: s[1], serial: s[2], authorization }));
  }
  return null;
}

async function despachar(request, metodo, { params }) {
  const ruta = (await params).ruta ?? [];
  try {
    if (ruta.length === 1 && ruta[0] === "pase" && metodo === "GET") return await descargarPase(request);
    if (ruta.length === 1 && ruta[0] === "vista" && metodo === "GET") return await verVista(request);
    if (ruta.length === 1 && ruta[0] === "prueba" && metodo === "POST") return await ponerPrueba(request);
    if (ruta.length === 1 && ruta[0] === "recibir" && metodo === "PUT") return await cambiarRecibir(request);
    if (ruta[0] === "v1") {
      if (ruta.length === 2 && ruta[1] === "log" && metodo === "POST") return await registrarLog(request);
      const r = await webService(request, metodo, ruta);
      if (r) return r;
    }
    return jsonError("No encontrado", 404);
  } catch (e) {
    return errorInterno(`tarjeta dueño ${metodo} ${ruta.join("/")}`, e);
  }
}

export const GET = (request, contexto) => despachar(request, "GET", contexto);
export const POST = (request, contexto) => despachar(request, "POST", contexto);
export const PUT = (request, contexto) => despachar(request, "PUT", contexto);
export const DELETE = (request, contexto) => despachar(request, "DELETE", contexto);
