import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getNegocio, getCliente } from "@/lib/store";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import { plataformaDe } from "@/lib/plataforma";
import { cookieDeTarjeta, serialRecordado } from "@/lib/recordar";
import { clienteVigente } from "@/lib/unaTarjeta";
import { proveedorWallet } from "@/lib/wallet";
import { rutaGuardarGoogle } from "@/lib/googlewallet";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import ErrorDatos from "@/app/ErrorDatos";
import MarcaTienda from "@/app/MarcaTienda";
import CaraDelPase from "@/app/CaraDelPase";
import { BotonAppleWallet, BotonGoogleWallet } from "@/app/BotonesWallet";
import PedirNombre from "./PedirNombre";

export const dynamic = "force-dynamic";

// ============================================================================
// LA PÁGINA DE LA TIENDA (lo que se abre al escanear)
// ----------------------------------------------------------------------------
// El QR del mostrador y el tag NFC llevan a /api/tap, que manda aquí a quien no
// tiene tarjeta. Dos pasos y nada más:
//   1. el nombre (PedirNombre): al enviarlo se crea la tarjeta;
//   2. la tarjeta y el botón de SU Wallet: Apple en iPhone, Google en Android si
//      está activa y, si no, la tarjeta web, que en Android ES la tarjeta.
// Quien ya tiene tarjeta (cookie) entra directo al paso 2.
//
// Con los colores de la tienda: aquí manda su marca, no el gris de la app. Y
// pocas palabras: el nombre de la tienda, lo que se gana y un botón.
// ============================================================================

const cargar = cache((slug) => getNegocio(slug));

export async function generateMetadata({ params }) {
  const { negocio } = await params;
  const n = await cargar(negocio).catch(() => null);
  return n ? { title: n.nombre } : {};
}

export default async function Page({ params, searchParams }) {
  const { negocio: slug } = await params;
  let n;
  try {
    n = await cargar(slug);
  } catch (e) {
    console.error(`[landing ${slug}] no se pudo leer la base de datos:`, e);
    return <ErrorDatos detalle={explicarErrorSupabase(e?.message || e, "negocios")} />;
  }
  if (!n) notFound();

  // ?nuevo=1: otra tarjeta aunque este teléfono ya tenga una (pruebas en el mostrador).
  const nuevo = (await searchParams).nuevo === "1";
  const recordado = nuevo ? null : serialRecordado((await cookies()).get(cookieDeTarjeta(slug))?.value);
  const vigente = recordado ? await clienteVigente(getCliente, recordado).catch(() => null) : null;
  const suya = vigente?.negocio === slug ? vigente : null;
  const t = n.tema;
  const colores = {
    background: t.pageBg,
    color: t.pageInk,
    "--acento": t.accent,
    "--sobre-acento": tintaClara(t.accent) ? "rgba(0,0,0,.84)" : "#fff",
  };

  return (
    <main className={`tienda ${tintaClara(t.pageInk) ? "oscura" : "clara"}`} style={colores}>
      <style>{css}</style>
      <div className="centro">
        {suya
          ? <TuTarjeta n={n} cliente={suya} plataforma={plataformaDe((await headers()).get("user-agent"))} />
          : <Bienvenida n={n} slug={slug} nuevo={nuevo} />}
      </div>
      <footer className="pie">
        <a href={`/privacidad?b=${slug}`}>Privacidad</a>
        <a href="/">Equipo</a>
      </footer>
    </main>
  );
}

function Bienvenida({ n, slug, nuevo }) {
  return (
    <>
      <header className="entra">
        <MarcaTienda tema={n.tema} tam={76} icono style={marca} />
        <h1 className="titulo" style={{ marginTop: 26 }}>{n.nombre}</h1>
        <p className="promesa">
          {promesa(n).map((linea, i) => <span key={i}>{linea}</span>)}
        </p>
      </header>
      <PedirNombre slug={slug} nuevo={nuevo} />
    </>
  );
}

// El botón es el de la Wallet de SU teléfono. En "otro" (un iPad en modo
// escritorio, un portátil) la tarjeta web, que ofrece las dos.
function TuTarjeta({ n, cliente, plataforma }) {
  const { serial } = cliente;
  const apple = plataforma === "ios" && proveedorWallet() === "apple" ? `/api/pase/${serial}` : null;
  const google = plataforma === "android" ? rutaGuardarGoogle(serial) : null;

  return (
    <>
      <h1 className="titulo entra">{cliente.nombre ? `Hola, ${cliente.nombre}` : n.nombre}</h1>
      <div className="pase sube">
        <CaraDelPase cliente={clienteDeTarjeta(cliente)} negocio={negocioDeTarjeta(n)} />
      </div>
      <div className="wallet entra" style={{ animationDelay: "260ms" }}>
        {apple && <BotonAppleWallet href={apple} />}
        {google && <BotonGoogleWallet href={google} />}
        {google && <a href={`/p/${serial}`} className="enlace">Abrir en el navegador</a>}
        {!apple && !google && <a href={`/p/${serial}`} className="boton">Abrir mi tarjeta</a>}
      </div>
    </>
  );
}

// Lo que se gana, en una línea por cartilla.
function promesa(n) {
  if (n.tipo === "descuento") return [n.premio];
  if (n.cartillas) return n.cartillas.map((c) => `${c.meta} ${c.nombre.toLowerCase()} · ${c.premio}`);
  return [`${n.meta} sellos · ${n.premio}`];
}

// ¿Es un color claro? Tinta clara = fondo oscuro: el campo del nombre va en
// blanco translúcido sobre un fondo claro y apenas insinuado sobre uno oscuro. Y
// sobre un acento claro (el dorado de una barbería) el texto del botón va oscuro.
function tintaClara(color) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || "").trim());
  if (!m) return false;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const marca = { margin: "0 auto", borderRadius: 22, boxShadow: "0 18px 36px -16px rgba(0,0,0,.5)" };

// Todo en `currentColor` y `--acento`: la página tiene que verse bien sobre el
// fondo claro de una tienda y sobre el negro de otra sin saber cuál le toca.
const css = `
.tienda{min-height:100dvh;display:flex;flex-direction:column;align-items:center;
  padding:max(20px,env(safe-area-inset-top)) 20px max(16px,env(safe-area-inset-bottom))}
.centro{flex:1;width:100%;max-width:360px;display:flex;flex-direction:column;justify-content:center;
  padding:24px 0 36px;text-align:center}
.titulo{margin:0;font-size:30px;font-weight:650;letter-spacing:-.022em;line-height:1.12;
  text-wrap:balance;overflow-wrap:anywhere}
.promesa{margin:10px 0 0;display:grid;gap:2px;font-size:15px;line-height:1.45;opacity:.68}
.formulario{margin-top:44px;display:grid;gap:10px}
.campo{width:100%;height:58px;padding:0 18px;border-radius:16px;color:inherit;
  font-size:19px;font-weight:500;letter-spacing:-.01em;text-align:center;outline:none;border:1px solid;
  transition:border-color .2s,box-shadow .2s,background-color .2s}
.clara .campo{background:rgba(255,255,255,.6);border-color:rgba(0,0,0,.08)}
.oscura .campo{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.16)}
.clara .campo:focus{background:rgba(255,255,255,.85)}
.campo::placeholder{color:inherit;opacity:.42}
.campo:focus{border-color:var(--acento);box-shadow:0 0 0 4px color-mix(in srgb,var(--acento) 22%,transparent)}
.campo:-webkit-autofill{-webkit-text-fill-color:currentColor;transition:background-color 600000s 0s}
.boton{display:grid;place-items:center;height:56px;border:0;border-radius:16px;
  background:var(--acento);color:var(--sobre-acento);font-size:17px;font-weight:600;text-decoration:none;cursor:pointer;
  box-shadow:0 14px 28px -16px rgba(0,0,0,.55);-webkit-tap-highlight-color:transparent;
  transition:transform .15s ease,filter .2s ease}
.boton:active{transform:scale(.985)}
.boton:disabled{cursor:default}
@media (hover:hover){.boton:not(:disabled):hover{filter:brightness(1.07)}}
.tienda a:focus-visible,.tienda button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.giro{width:20px;height:20px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;
  animation:giro .7s linear infinite}
.error{margin:6px 0 0;font-size:14px;line-height:1.4}
.pase{margin-top:28px;text-align:left}
.wallet{margin-top:30px;display:grid;gap:16px;justify-items:center}
.wallet .boton{width:100%}
.enlace{font-size:14px;opacity:.7;text-decoration-thickness:1px;text-underline-offset:3px}
.pie{display:flex;gap:20px;font-size:12px;opacity:.5}
.pie a{text-decoration:none}
@media (hover:hover){.pie a:hover{text-decoration:underline}}
.solo-lector{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.entra{animation:entra .7s cubic-bezier(.2,.8,.2,1) both}
.sube{animation:sube .9s cubic-bezier(.16,1,.3,1) 90ms both}
@keyframes entra{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes sube{from{opacity:0;transform:translateY(32px) scale(.96)}to{opacity:1;transform:none}}
@keyframes giro{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.entra,.sube{animation:none}.giro{animation-duration:1.6s}}
`;
