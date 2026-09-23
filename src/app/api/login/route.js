import { NextResponse } from "next/server";
import {
  resolverUsuario, usuariosDemo, usuarioDe, firmarSesion, secretoSesion, COOKIE, TTL_SEGUNDOS, ADMINS,
} from "@/lib/auth";
import { listNegocios, getNegocio, getCliente } from "@/lib/store";
import { destinoSeguro, negocioDeRuta } from "@/lib/acceso";
import { comprobarAcceso } from "@/lib/accesos";
import { loginBloqueado, anotarFalloLogin, ipDe } from "@/lib/limitador";
import { jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/login -> ¿hay accesos de prueba? Los pinta el login para no tener que
// mirar las variables de entorno. Vacío si no está activo el modo pruebas.
export async function GET() {
  if (!usuariosDemo()) return NextResponse.json({ demo: false, accesos: [] });
  const negocios = await listNegocios().catch(() => []);
  const accesos = [
    // Admin de la plataforma: entra en /admin, no en una tienda concreta.
    ...ADMINS.map((usuario) => ({ negocio: "Plataforma", rol: "admin", usuario, clave: usuario })),
    ...negocios.flatMap((n) =>
      ["manager", "caja"].map((rol) => ({
        negocio: n.nombre,
        rol,
        usuario: usuarioDe(n.slug, rol),
        clave: usuarioDe(n.slug, rol),
      })),
    ),
  ];
  return NextResponse.json({ demo: true, accesos });
}

// POST /api/login  body: { usuario, clave } -> valida, firma la sesión y la deja
// en una cookie httpOnly. Devuelve negocio y rol para redirigir.
export async function POST(request) {
  try {
    const { usuario, clave, next } = await request.json().catch(() => ({}));
    const quien = resolverUsuario(usuario);
    if (!quien) return jsonError("Usuario o contraseña incorrectos", 401);
    // Un usuario de tienda solo vale si la tienda existe (y no está archivada):
    // en modo pruebas la contraseña es el propio usuario, así que sin esto
    // cualquier slug inventado entraría.
    if (quien.rol !== "admin" && !(await getNegocio(quien.negocio))) {
      return jsonError("Usuario o contraseña incorrectos", 401);
    }
    if (!secretoSesion()) return jsonError("Login desactivado: falta AUTH_SECRET en el servidor", 503);

    // El límite de intentos vive en la base de datos. Si falla, se deja entrar
    // igualmente (con la contraseña correcta): quedarse sin caja sería peor.
    const ip = ipDe(request);
    try {
      if (await loginBloqueado(quien.negocio, ip)) {
        return jsonError("Demasiados intentos. Espera 15 minutos.", 429);
      }
    } catch (e) {
      console.error("[login] no se pudo consultar el límite de intentos:", e);
    }

    // Contraseña de la base; si la tienda no tiene, la variable de entorno (lib/accesos.js).
    const acceso = await comprobarAcceso(usuario, clave);
    if (!acceso) {
      await anotarFalloLogin(quien.negocio, ip).catch((e) => console.error("[login] no se pudo anotar el fallo:", e));
      return jsonError("Usuario o contraseña incorrectos", 401);
    }

    const destino = await destinoTrasLogin(acceso, next);
    const res = NextResponse.json({ ok: true, negocio: acceso.negocio, rol: acceso.rol, destino });
    res.cookies.set(COOKIE, await firmarSesion(acceso.negocio, acceso.rol), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_SEGUNDOS[acceso.rol],
    });
    return res;
  } catch (e) {
    return errorInterno("login", e);
  }
}

const FICHA = /^\/w\/([0-9a-f-]{36})$/i;

/**
 * A dónde ir tras entrar. `next` solo se respeta si es de ESTA tienda: una
 * ficha de caja (/w/<serial>) no dice de qué tienda es, así que se mira la
 * tarjeta. Sin esto, quien escaneó su propio pase con el móvil acababa, al
 * entrar en cualquier tienda, en la ficha de su tarjeta ("esta tarjeta es de
 * otra tienda", o sellándose a sí mismo).
 */
async function destinoTrasLogin(acceso, next) {
  const suSitio = acceso.rol === "admin" ? "/admin" : `/${acceso.negocio}/${acceso.rol === "manager" ? "manager" : "caja"}`;
  const pedido = destinoSeguro(next);
  if (!pedido) return suSitio;
  if (acceso.rol === "admin") return pedido;
  if (negocioDeRuta(pedido) === acceso.negocio) return pedido;
  const ficha = FICHA.exec(pedido);
  if (ficha) {
    const cliente = await getCliente(ficha[1]).catch(() => null);
    if (cliente?.negocio === acceso.negocio) return pedido;
  }
  return suSitio;
}
