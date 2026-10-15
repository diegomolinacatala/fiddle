"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { destinoSeguro, usuarioSugerido } from "@/lib/acceso";
import { resolverUsuario, usuarioDe } from "@/lib/auth";
import { CORREO, TELEFONO_VISIBLE, enlaceWhatsApp, enlaceCorreo } from "@/app/home/datos";
import { C, paginaCentrada, panel, campo, etiqueta, aviso, botonSecundario, solapa } from "@/app/ui";
import LogoFiddle from "@/app/LogoFiddle";

// PRIMERA PANTALLA de la app: usuario + contraseña, para todos los negocios.
//   delicanteria (manager) · delicanteria-caja (caja)
// El rol lo decide el usuario. Si el servidor tiene activo el modo pruebas,
// debajo se listan los accesos de ejemplo y se rellenan al tocarlos.
// Se llega desde «Entrar» de la web (/home), y abajo hay un enlace de vuelta.
//
// Con `?b=<tienda>&next=<ruta>` (el middleware o «Salir») el usuario sale ya
// puesto: el de la caja si se venía de la caja, el del dueño si no
// (usuarioSugerido en lib/acceso.js), y dos botones para cambiarlo sin teclear.
// Hoy no hay forma de recuperar una contraseña sin fiddle: por eso «¿No puedes
// entrar?» dice a quién escribir, con el contacto de app/home/datos.js.
const MENSAJE_AYUDA = "Hola, no puedo entrar en fiddle.";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = destinoSeguro(params.get("next"));
  const tienda = resolverUsuario(params.get("b"));
  const slug = tienda && tienda.rol !== "admin" ? tienda.negocio : null;

  const [usuario, setUsuario] = useState(() => usuarioSugerido(params.get("b"), params.get("next")));
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null); // { texto, status }
  const [busy, setBusy] = useState(false);
  const [accesos, setAccesos] = useState([]);
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    fetch("/api/login")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAccesos(d?.accesos ?? []))
      .catch(() => {});
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ texto: data.error || "No se pudo entrar", status: res.status });
        // Bloqueado: la contraseña no se ha mirado, que no la vuelva a teclear a ciegas.
        if (res.status === 429) setAyuda(true);
        else setClave("");
        return;
      }
      // El servidor decide a dónde: `next` solo si es de esta tienda (ver /api/login).
      router.push(data.destino);
      router.refresh();
    } catch (err) {
      setError({ texto: String(err?.message || err), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  function usar(acceso) {
    setUsuario(acceso.usuario);
    setClave(acceso.clave);
    setError(null);
  }

  const listo = usuario && clave && !busy;
  const soy = (rol) => { setUsuario(usuarioDe(slug, rol)); setError(null); };

  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(400px, 100%)" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 10px", fontSize: "inherit" }}>
            <LogoFiddle tam={36} />
          </h1>
          <p style={{ color: C.suave, fontSize: 14, margin: 0 }}>
            Entra con el usuario de tu tienda o el de la caja.
          </p>
        </div>

        <form onSubmit={entrar} style={{ ...panel, display: "flex", flexDirection: "column" }}>
          {slug && (
            <div role="group" aria-label="Quién entra" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["caja", "Soy la caja"], ["manager", "Soy el dueño"]].map(([rol, texto]) => (
                <button key={rol} type="button" onClick={() => soy(rol)} style={solapa(usuario === usuarioDe(slug, rol))}>
                  {texto}
                </button>
              ))}
            </div>
          )}

          <label style={{ ...etiqueta, marginTop: slug ? 14 : 0 }} htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="delicanteria"
            autoFocus={!usuario}
            style={campo}
          />

          <label style={etiqueta} htmlFor="clave">Contraseña</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="clave"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              type={ver ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="••••••"
              autoFocus={Boolean(usuario)}
              style={{ ...campo, minWidth: 0 }}
            />
            {/* Doce caracteres con guiones en un teclado de móvil: mejor poder mirarlos. */}
            <button type="button" onClick={() => setVer((v) => !v)} style={{ ...botonSecundario, flexShrink: 0 }} aria-pressed={ver}>
              {ver ? "Ocultar" : "Ver"}
            </button>
          </div>

          <button type="submit" disabled={!listo} style={{ ...entrarBtn, opacity: listo ? 1 : 0.45, cursor: listo ? "pointer" : "default" }}>
            {busy ? "Entrando…" : "Entrar"}
          </button>

          {error && <div role="alert" style={{ ...aviso(false), marginTop: 14 }}>{error.texto}</div>}

          <button type="button" onClick={() => setAyuda((v) => !v)} aria-expanded={ayuda} style={enlaceAyuda}>
            ¿No puedes entrar?
          </button>
          {ayuda && (
            <div style={{ ...panel, padding: 14, background: C.panelSuave, marginTop: 8 }}>
              <p style={{ fontSize: 13, color: C.suave, margin: "0 0 8px", lineHeight: 1.5 }}>
                {error?.status === 429
                  ? "Hasta que pasen los 15 minutos no se comprueba ninguna contraseña, aunque sea la buena. "
                  : null}
                Si no recuerdas la contraseña o el enlace que te mandamos no funciona, escríbenos y te damos
                una nueva. Dinos el nombre de la tienda y si es la del dueño o la de la caja.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={enlaceWhatsApp(MENSAJE_AYUDA)} target="_blank" rel="noopener noreferrer" style={{ ...botonSecundario, textDecoration: "none", fontSize: 13 }}>
                  WhatsApp {TELEFONO_VISIBLE}
                </a>
                <a href={enlaceCorreo("No puedo entrar en fiddle", MENSAJE_AYUDA)} style={{ ...botonSecundario, textDecoration: "none", fontSize: 13 }}>
                  {CORREO}
                </a>
              </div>
            </div>
          )}
        </form>

        {accesos.length > 0 && (
          <div style={{ ...panel, marginTop: 14, padding: 16, background: C.panelSuave }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Accesos de ejemplo</div>
            <p style={{ fontSize: 12, color: C.suave, margin: "0 0 10px" }}>
              Toca uno para rellenar el formulario. La contraseña es igual que el usuario.
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {accesos.map((a) => (
                <button key={a.usuario} type="button" onClick={() => usar(a)} style={fila}>
                  <span>{a.negocio}</span>
                  <span style={{ color: C.suave, fontSize: 12 }}>{a.rol}</span>
                  <code style={{ fontSize: 12, color: C.suave }}>{a.usuario} / {a.clave}</code>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.tenue, margin: "10px 0 0" }}>
              Solo en local: en producción no existen.
            </p>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: C.suave, margin: "18px 0 0" }}>
          ¿Aún no trabajas con nosotros? <a href="/home" style={{ color: C.texto, fontWeight: 600 }}>Conoce fiddle</a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const entrarBtn = {
  marginTop: 20,
  padding: "0.7rem 1.2rem",
  borderRadius: 10,
  border: 0,
  background: C.toastFondo,
  color: C.toastTexto,
  fontWeight: 600,
  fontSize: 15,
};

// Un enlace con alto de dedo, alineado a la izquierda como el texto del formulario.
const enlaceAyuda = {
  marginTop: 14,
  padding: "6px 0",
  border: 0,
  background: "none",
  color: C.suave,
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const fila = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 10,
  alignItems: "center",
  textAlign: "left",
  padding: "9px 11px",
  borderRadius: 10,
  border: `1px solid ${C.borde}`,
  background: C.panel,
  color: C.texto,
  fontSize: 13,
  cursor: "pointer",
};
