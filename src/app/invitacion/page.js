"use client";

import { useEffect, useRef, useState } from "react";
import MarcaTienda from "@/app/MarcaTienda";
import { Clave, Coinciden, Ayuda, revisar, lista } from "@/app/ClaveElegida";
import CampoCodigo from "@/app/CampoCodigo";
import { problemaUsuarioCaja } from "@/lib/usuarioCaja";
import { C, paginaCentrada, panel, campo, etiqueta, aviso, botonSecundario, legible } from "@/app/ui";
import { tokenAlAbrir, tokenDeTexto, CLAVE_GUARDADO, LARGO_TOKEN } from "@/lib/tokenInvitacion";

// ============================================================================
// INVITACIÓN — el dueño pone su correo y elige sus accesos
// ----------------------------------------------------------------------------
// Llega aquí desde el enlace del correo (/invitacion#<token>). Según el alcance
// del enlace (lib/invitaciones.js):
//   "alta"     la tienda nueva, en tres pasos: su correo (se comprueba con un código
//              de 6 cifras que le llega), su contraseña del manager y la caja (usuario
//              y contraseña que elige). Cada contraseña, escrita dos veces: con una
//              sola no sabes si la has tecleado bien, y el enlace no se repite.
//   "manager"  perdió la suya: correo con código y la contraseña nueva. La caja no cambia.
// Mientras no termina, los accesos de antes siguen valiendo (`info.yaEntra`). Al
// terminar entra directo a su manager. El token vive detrás de `#`: se lee
// aquí y viaja en el cuerpo de la petición, nunca en una URL que quede en un log.
//
// El token NO se quita de la barra ni se lee solo al cargar (antes sí, y el
// dueño de La Delicantería se quedó fuera: recargar, volver atrás o cambiar de
// app en el móvil cargaba /invitacion sin token y la página decía «enlace
// incompleto»). Ahora se guarda en la pestaña (sessionStorage) por si el hash
// se pierde, se vuelve a leer cuando cambia (pegar el enlace en una pestaña que
// ya estaba aquí) y, si no hay ninguno, se puede pegar el código del correo. El
// hash no sale de la barra: la Referrer-Policy de next.config.mjs no lo manda a
// nadie y los logs de Vercel no ven fragmentos.
// ============================================================================

// sessionStorage puede no estar (datos bloqueados, navegación privada antigua):
// nunca tumba la página, como mucho se pierde la red de seguridad.
const guardado = {
  leer: () => { try { return window.sessionStorage.getItem(CLAVE_GUARDADO); } catch { return null; } },
  poner: (t) => { try { window.sessionStorage.setItem(CLAVE_GUARDADO, t); } catch { /* sin red de seguridad */ } },
  borrar: () => { try { window.sessionStorage.removeItem(CLAVE_GUARDADO); } catch { /* ya no está */ } },
};

// Qué hacer con cada rechazo del servidor (lib/invitaciones.js, `codigo`), o de la red.
const CONSEJO = {
  incompleto: "Vuelve a abrir el enlace desde el correo, tal cual llegó. Si tu correo lo recorta, pega aquí el código que va debajo del enlace.",
  desconocido: "Si te han mandado más de un correo, vale el último. Si no, pide otro enlace a quien te lo envió: puede crear uno nuevo desde su panel.",
  caducada: "Pide otro enlace a quien te lo envió: puede crear uno nuevo desde su panel.",
  usada: "Tus contraseñas ya están puestas: entra con tu usuario y la que elegiste. Si no la recuerdas, pide otro enlace.",
  sin_tienda: "Habla con quien te lo envió.",
  // Estos tres no dicen nada del enlace: ni se enseña el texto del servidor ni se olvida el token.
  red: "Mira la conexión y prueba otra vez.",
  limite: "Demasiados intentos desde esta conexión. Espera unos minutos y prueba otra vez.",
  servidor: "Prueba otra vez en un momento. Si sigue igual, avisa a quien te lo envió.",
};
const SE_PUEDE_PEGAR = new Set(["incompleto", "desconocido", "caducada"]);

export default function Invitacion() {
  const [token, setToken] = useState(undefined); // undefined: aún no se ha mirado; null: no hay
  const [intento, setIntento] = useState(0); // para volver a comprobar el mismo token
  const [info, setInfo] = useState(null); // { nombre, tema, alcance, email, cajaUsuario, yaEntra }
  const [error, setError] = useState(null); // { texto, codigo, rechazado }
  const terminado = useRef(false); // ya se guardaron las contraseñas y se fue al manager
  const [pegando, setPegando] = useState(false);
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState("");
  const [reto, setReto] = useState(null); // el código ya se mandó al correo
  const [codigo, setCodigo] = useState("");
  const [pedirOtro, setPedirOtro] = useState(false); // el código caducó o se agotó
  const [cajaUsuario, setCajaUsuario] = useState("");
  const [manager, setManager] = useState("");
  const [manager2, setManager2] = useState("");
  const [caja, setCaja] = useState("");
  const [caja2, setCaja2] = useState("");
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);

  // Con qué token se abre: el de la barra o el guardado en la pestaña. Y otra vez
  // cada vez que cambie el hash.
  useEffect(() => {
    const mirar = () => {
      setToken(tokenAlAbrir(window.location.hash, guardado.leer()));
      setPegando(false);
    };
    mirar();
    // «Atrás» desde el manager en iOS devuelve esta página congelada (bfcache) con
    // «Guardando…» y las contraseñas en los campos: a su sitio, que ya está dentro.
    const volver = (e) => { if (e.persisted && terminado.current) window.location.replace("/"); };
    window.addEventListener("hashchange", mirar);
    window.addEventListener("pageshow", volver);
    return () => {
      window.removeEventListener("hashchange", mirar);
      window.removeEventListener("pageshow", volver);
    };
  }, []);

  // Cada token se comprueba con el servidor (y otra vez si se pide con «Probar otra
  // vez»). En la pestaña solo se guarda el que el servidor dio por bueno: uno
  // rechazado se quita, para que al volver sin hash salga «pega el código» y no
  // el mismo error.
  useEffect(() => {
    if (!token) return;
    let vigente = true;
    setInfo(null);
    setError(null);
    setPaso(1);
    fetch("/api/invitacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) return d;
        // `rechazado`: el servidor miró el enlace y dijo que no (410, con su código y
        // su texto). Un 429 o un 500 no dicen nada del enlace: texto propio y el
        // token guardado se queda.
        const rechazado = r.status === 410 && Boolean(d.codigo);
        throw Object.assign(new Error(rechazado ? d.error : ""), { codigo: rechazado ? d.codigo : r.status === 429 ? "limite" : "servidor", rechazado });
      })
      .then((d) => {
        if (!vigente) return;
        guardado.poner(token);
        setEmail(d.email || "");
        setCajaUsuario(d.cajaUsuario || "");
        setReto(null);
        setCodigo("");
        setInfo(d);
      })
      .catch((e) => {
        if (!vigente) return;
        if (e.rechazado && guardado.leer() === token) guardado.borrar();
        setError({ texto: e.rechazado ? e.message : null, codigo: e.codigo || "red", rechazado: Boolean(e.rechazado) });
      });
    return () => { vigente = false; };
  }, [token, intento]);

  function comprobar(t) {
    setPegando(false);
    // El mismo token otra vez (la red falló): el contador fuerza la comprobación.
    if (t === token) setIntento((n) => n + 1);
    else if (window.location.hash.slice(1) !== t) window.location.hash = t; // dispara hashchange
    else setToken(t);
  }

  const soloManager = info?.alcance === "manager";

  // Al volver a escribir se quita el aviso: si no, «No son iguales» sigue ahí
  // debajo de un «Son iguales.» recién arreglado.
  const escribir = (set) => (v) => { set(v); setError(null); };

  // Una sola llamada al servidor para todo: el cuerpo dice qué paso es (contrato
  // en app/api/invitacion/route.js). Devuelve los datos si fue bien, o null con el
  // error ya puesto (y, si el servidor señala un campo, en el paso de ese campo).
  async function llamar(cuerpo) {
    setBusy(true);
    try {
      const r = await fetch("/api/invitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...cuerpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        irAlCampo(d.campo);
        setPedirOtro(d.codigoCorreo === "caducado" || d.codigoCorreo === "agotado");
        // Un 500 (la base, un momento) no es cosa del dueño: que repita, el enlace sigue vivo.
        const texto = r.status >= 500 && !d.campo ? "No se pudo guardar. Prueba otra vez en un momento." : d.error || "No se pudo guardar";
        setError({ texto, codigo: d.codigo });
        setBusy(false);
        return null;
      }
      return d;
    } catch {
      setError({ texto: "Sin conexión. Prueba otra vez." });
      setBusy(false);
      return null;
    }
  }

  function irAlCampo(nombreCampo) {
    if (nombreCampo === "email" || nombreCampo === "codigo") setPaso(1);
    else if (nombreCampo === "manager") setPaso(2);
    else if (nombreCampo === "cajaUsuario" || nombreCampo === "caja") setPaso(3);
  }

  // Paso 1a: se manda el código al correo. Sirve también para «Mandar otro código».
  async function mandarCodigo(e) {
    e?.preventDefault();
    setError(null);
    if (!email.trim()) return setError({ texto: "Escribe tu correo." });
    const d = await llamar({ email: email.trim() });
    if (!d) return;
    setReto(d.reto);
    setEmail(d.email || email.trim());
    setCodigo("");
    setPedirOtro(false);
    setBusy(false);
  }

  // Paso 1b: se comprueba el código y se pasa a la contraseña.
  async function comprobarCodigo(e) {
    e.preventDefault();
    setError(null);
    const d = await llamar({ reto, codigo: codigo.trim() });
    if (!d) return;
    if (d.email) setEmail(d.email);
    setBusy(false);
    setPaso(2);
  }

  function cambiarCorreo() {
    setReto(null);
    setCodigo("");
    setPedirOtro(false);
    setError(null);
  }

  // Guarda lo que toque y entra.
  async function terminarTodo(extra) {
    const d = await llamar({ reto, codigo: codigo.trim(), manager, ...extra });
    if (!d) return;
    // Gastado: fuera de la pestaña y de la barra, que «atrás» no vuelva a enseñarlo.
    terminado.current = true;
    guardado.borrar();
    window.history.replaceState(null, "", "/invitacion");
    window.location.assign(d.destino);
  }

  // Paso 2: la contraseña suya. Con alcance "manager" es también el último: se guarda ya.
  function siguiente(e) {
    e.preventDefault();
    setError(null);
    const problema = revisar(manager, manager2, email);
    if (problema) return setError({ texto: problema });
    if (soloManager) return terminarTodo({});
    setPaso(3);
  }

  function terminar(e) {
    e.preventDefault();
    setError(null);
    const problemaUsuario = problemaUsuarioCaja(cajaUsuario);
    if (problemaUsuario) return setError({ texto: problemaUsuario });
    const problema = revisar(caja, caja2, cajaUsuario) || (caja.trim() === manager.trim() ? "Tiene que ser distinta de la tuya: la sabrá quien use la caja." : null);
    if (problema) return setError({ texto: problema });
    terminarTodo({ cajaUsuario: cajaUsuario.trim().toLowerCase(), caja });
  }

  if (!info) {
    return (
      <main style={paginaCentrada}>
        <div style={{ width: "min(420px, 100%)" }}>
          {token === undefined
            ? null
            : token === null
              ? <PegarCodigo onComprobar={comprobar} titulo="Falta el código del enlace" consejo={CONSEJO.incompleto} />
              : error
                ? <Rechazo error={error} pegando={pegando} onPegar={() => setPegando(true)} onComprobar={comprobar} onOtraVez={() => comprobar(token)} />
                : <p style={{ color: C.suave, textAlign: "center" }}>Comprobando el enlace…</p>}
        </div>
      </main>
    );
  }

  const accent = info.tema?.accent || C.texto;
  const listaManager = lista(manager, manager2) && !busy;
  const subtitulo = soloManager
    ? "Pon tu correo y elige tu nueva contraseña. Sigues donde estabas."
    : info.yaEntra
      ? "Pon tu correo y elige tus accesos nuevos. Hasta que acabes, los de ahora siguen valiendo."
      : "Te damos la bienvenida. Tu correo, tu contraseña y la caja.";

  return (
    <main style={paginaCentrada}>
      <div style={{ width: "min(420px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {info.tema && <MarcaTienda tema={info.tema} tam={44} icono />}
          <div>
            <h1 style={{ ...titulo, margin: 0 }}>{info.nombre}</h1>
            <p style={{ ...texto, margin: 0 }}>{subtitulo}</p>
          </div>
        </div>

        <ol style={pasos} aria-label="Pasos">
          <li style={pasoEstilo(paso === 1, paso > 1, accent)}>1 Tu correo</li>
          <li style={pasoEstilo(paso === 2, paso > 2, accent)}>2 Tu contraseña</li>
          {!soloManager && <li style={pasoEstilo(paso === 3, false, accent)}>3 La caja</li>}
        </ol>

        {paso === 1 && !reto && (
          <form onSubmit={mandarCodigo} style={panel}>
            <p style={texto}>Te mandamos un código para comprobar que el correo es tuyo. Con él entrarás al <strong style={{ color: C.texto }}>manager</strong>: la tarjeta, las promos y tus clientes.</p>
            <label style={etiqueta} htmlFor="correo-dueno">Tu correo</label>
            <input
              id="correo-dueno" type="email" name="email" value={email} onChange={(e) => escribir(setEmail)(e.target.value)}
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus style={campo}
            />
            {error && <Aviso error={error} />}
            <button type="submit" disabled={busy} aria-busy={busy || undefined} style={principal(accent, Boolean(email.trim()) && !busy)}>
              {busy ? "Mandando…" : "Mandarme el código"}
            </button>
          </form>
        )}

        {paso === 1 && reto && (
          <form onSubmit={comprobarCodigo} style={panel}>
            <p style={texto}>Te lo hemos mandado a <strong style={{ color: C.texto, wordBreak: "break-all" }}>{email}</strong>. Mira también en spam.</p>
            <label style={etiqueta} htmlFor="codigo-correo">Código</label>
            <CampoCodigo id="codigo-correo" valor={codigo} onChange={escribir(setCodigo)} autoFocus />
            {error && <Aviso error={error} />}
            {pedirOtro
              ? <button type="button" onClick={mandarCodigo} disabled={busy} style={principal(accent, !busy)}>Pedir otro código</button>
              : <button type="submit" disabled={busy} aria-busy={busy || undefined} style={principal(accent, codigo.trim().length >= 6 && !busy)}>
                  {busy ? "Comprobando…" : "Comprobar"}
                </button>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
              <button type="button" onClick={cambiarCorreo} style={enlacePequeno}>Cambiar el correo</button>
              {!pedirOtro && <button type="button" onClick={mandarCodigo} disabled={busy} style={enlacePequeno}>Mandar otro código</button>}
            </div>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={siguiente} style={panel}>
            <p style={texto}>
              Entrarás con <strong style={{ color: C.texto, wordBreak: "break-all" }}>{email}</strong>.
              {soloManager && <> La de antes deja de valer en cuanto guardes. La del <strong style={{ color: C.texto }}>móvil de la caja</strong> no cambia.</>}
            </p>
            {/* Para que el gestor de contraseñas la guarde con su usuario. */}
            <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
            <label style={etiqueta} htmlFor="clave-manager">{soloManager ? "Elige tu nueva contraseña" : "Elige tu contraseña"}</label>
            <Clave id="clave-manager" valor={manager} onChange={escribir(setManager)} ver={ver} setVer={setVer} autoFocus />
            <Ayuda valor={manager} />
            <label style={etiqueta} htmlFor="clave-manager-2">Repítela</label>
            <Clave id="clave-manager-2" valor={manager2} onChange={escribir(setManager2)} ver={ver} />
            <Coinciden clave={manager} repetida={manager2} />
            {error && <Aviso error={error} />}
            <button type="submit" disabled={busy} aria-busy={(busy && soloManager) || undefined} style={principal(accent, listaManager)}>
              {soloManager ? (busy ? "Guardando…" : "Guardar y entrar") : "Siguiente"}
            </button>
          </form>
        )}

        {paso === 3 && (
          <form onSubmit={terminar} style={panel}>
            <p style={texto}>
              La usará el <strong style={{ color: C.texto }}>móvil de la caja</strong> para sumar puntos. Solo sirve para eso:
              quien la sepa no ve tus clientes ni cambia la tarjeta. Apúntala: la vas a escribir allí.
            </p>
            <label style={etiqueta} htmlFor="usuario-caja">Usuario de la caja</label>
            <input
              id="usuario-caja" type="text" name="username" value={cajaUsuario} onChange={(e) => escribir(setCajaUsuario)(e.target.value)}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
              style={{ ...campo, fontFamily: "ui-monospace, Menlo, monospace" }}
            />
            <label style={etiqueta} htmlFor="clave-caja">Contraseña de la caja</label>
            <Clave id="clave-caja" valor={caja} onChange={escribir(setCaja)} ver={ver} setVer={setVer} />
            <Ayuda valor={caja} />
            <label style={etiqueta} htmlFor="clave-caja-2">Repítela</label>
            <Clave id="clave-caja-2" valor={caja2} onChange={escribir(setCaja2)} ver={ver} />
            <Coinciden clave={caja} repetida={caja2} />
            {error && <Aviso error={error} />}
            <button type="submit" disabled={busy} aria-busy={busy || undefined} style={principal(accent, lista(caja, caja2) && !problemaUsuarioCaja(cajaUsuario) && !busy)}>
              {busy ? "Guardando…" : "Guardar y entrar"}
            </button>
            <button type="button" onClick={() => { setPaso(2); setError(null); }} style={{ ...botonSecundario, width: "100%", marginTop: 8 }}>
              Volver
            </button>
          </form>
        )}

        <p style={{ fontSize: 12, color: C.tenue, textAlign: "center", marginTop: 14 }}>
          {soloManager
            ? "Este enlace solo sirve una vez. Tu contraseña de antes dejará de valer; la de la caja sigue igual."
            : "Este enlace solo sirve una vez. Al terminar, los accesos de antes dejan de valer y el móvil de la caja tendrá que entrar con el usuario nuevo."}
          {" "}Puedes recargar o volver más tarde a esta pestaña: el enlace se queda.
        </p>
      </div>
    </main>
  );
}

// El servidor dijo que no (o no se le pudo preguntar): qué pasa y qué hacer. Solo
// cuando lo rechazó de verdad se dice que el enlace no sirve: con la red caída o un
// 500, decirlo haría que el dueño pidiera otro, y eso anula el bueno.
function Rechazo({ error, pegando, onPegar, onComprobar, onOtraVez }) {
  const codigo = error.codigo || "servidor";
  const consejo = CONSEJO[codigo] || CONSEJO.servidor;
  if (pegando) return <PegarCodigo onComprobar={onComprobar} titulo="Pega el código del correo" consejo={consejo} />;
  return (
    <div style={panel}>
      <h1 style={titulo}>{error.rechazado ? "Este enlace no sirve" : "No se pudo comprobar el enlace"}</h1>
      {error.texto && <p style={{ ...texto, marginBottom: 6 }}>{error.texto}</p>}
      <p style={{ ...texto, marginBottom: 16 }}>{consejo}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!error.rechazado && (
          <button type="button" onClick={onOtraVez} style={botonSecundario}>Probar otra vez</button>
        )}
        {SE_PUEDE_PEGAR.has(codigo) && (
          <button type="button" onClick={onPegar} style={botonSecundario}>Pegar el código</button>
        )}
        <a href="/login" style={{ ...botonSecundario, textDecoration: "none", display: "inline-block" }}>Ir a entrar</a>
      </div>
    </div>
  );
}

// Sin token en la barra ni en la pestaña: el código que va en el correo, debajo
// del enlace. Vale pegar el enlace entero o el correo entero: se busca dentro.
function PegarCodigo({ onComprobar, titulo: cabecera, consejo }) {
  const [pegado, setPegado] = useState("");
  const [aviso_, setAviso] = useState(null);
  function enviar(e) {
    e.preventDefault();
    const t = tokenDeTexto(pegado);
    if (!t) return setAviso(`Eso no parece el código: son ${LARGO_TOKEN} letras, números, guiones o barras bajas, sin espacios. También vale pegar el enlace o el correo entero.`);
    setAviso(null);
    onComprobar(t);
  }
  return (
    <form onSubmit={enviar} style={panel}>
      <h1 style={titulo}>{cabecera}</h1>
      <p style={{ ...texto, marginBottom: 4 }}>{consejo}</p>
      <label style={etiqueta} htmlFor="codigo-invitacion">Código del correo</label>
      <input
        id="codigo-invitacion"
        value={pegado}
        onChange={(e) => { setPegado(e.target.value); setAviso(null); }}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        style={{ ...campo, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14 }}
      />
      {aviso_ && <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{aviso_}</div>}
      <button type="submit" style={principal(C.texto, Boolean(pegado.trim()))}>Comprobar</button>
      <p style={{ ...texto, fontSize: 12, color: C.tenue, marginTop: 12 }}>
        Si no tienes el correo, pide otro enlace a quien te lo mandó. Si ya elegiste tus contraseñas,
        {" "}<a href="/login" style={{ color: C.texto }}>entra con ellas</a>.
      </p>
    </form>
  );
}

const enlacePequeno = { border: 0, background: "none", padding: "6px 0", color: C.suave, fontSize: 13, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" };

function Aviso({ error }) {
  return <div role="alert" style={{ ...aviso(false), marginTop: 12 }}>{error.texto}</div>;
}

const titulo = { fontSize: "1.35rem", fontWeight: 650, margin: "0 0 6px", letterSpacing: "-0.01em" };
const texto = { color: C.suave, fontSize: 14, lineHeight: 1.5, margin: "0 0 4px" };
const pasos = { display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "0 0 12px" };
const pasoEstilo = (activo, hecho, accent) => ({
  flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600, padding: "8px 6px", borderRadius: 10,
  border: `1px solid ${activo ? accent : C.borde}`, background: activo ? `${accent}14` : C.panel,
  color: activo ? legible(accent) : hecho ? C.ok : C.tenue,
});
const principal = (accent, listo) => ({
  marginTop: 18, width: "100%", padding: "0.75rem 1.2rem", borderRadius: 10, border: 0,
  background: accent, color: "#fff", fontWeight: 600, fontSize: 15,
  opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "default",
});
