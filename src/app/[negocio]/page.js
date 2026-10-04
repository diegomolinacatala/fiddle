import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCliente } from "@/lib/store";
import { negocioDePeticion } from "./negocioDePeticion";
import { conFotoBanda } from "@/lib/propiosServidor";
import { explicarErrorSupabase } from "@/lib/diagnostico";
import { plataformaDe } from "@/lib/plataforma";
import { cookieDeTarjeta, serialRecordado } from "@/lib/recordar";
import { clienteVigente } from "@/lib/unaTarjeta";
import { proveedorWallet } from "@/lib/wallet";
import { rutaGuardarGoogle } from "@/lib/googlewallet";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { rutaListo } from "@/lib/todoListo";
import { coloresDeTienda, tintaClara } from "@/app/ui";
import ErrorDatos from "@/app/ErrorDatos";
import MarcaTienda from "@/app/MarcaTienda";
import CaraDelPase from "@/app/CaraDelPase";
import { colorDelPase } from "@/lib/apple/dibujo";
import { BotonAppleWallet, BotonGoogleWallet } from "@/app/BotonesWallet";
import PedirNombre from "./PedirNombre";

export const dynamic = "force-dynamic";

// ============================================================================
// LA PÁGINA DE LA TIENDA (lo que se abre al escanear)
// ----------------------------------------------------------------------------
// El QR del mostrador y el tag NFC llevan a /api/tap, que manda aquí a quien no
// tiene tarjeta. Dos pasos y nada más:
//   1. el nombre (PedirNombre): al enviarlo se crea la tarjeta. Si la tienda no
//      lo pide, el tap ya la crea y aquí solo se llega con ?nuevo=1 o a mano:
//      entonces es un botón sin campo;
//   2. la tarjeta y el botón de SU Wallet: Apple en iPhone, Google en Android si
//      está activa y, si no, la tarjeta web, que en Android ES la tarjeta.
// Quien ya tiene tarjeta (cookie) entra directo al paso 2.
//
// Con los colores de la tienda: aquí manda su marca, no el gris de la app. Y
// pocas palabras: el nombre de la tienda, lo que se gana y un botón.
// ============================================================================

const cargar = negocioDePeticion;

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

  // Tinta clara = fondo oscuro: el campo del nombre va en blanco translúcido
  // sobre un fondo claro y apenas insinuado sobre uno oscuro.
  return (
    <main className={`tienda ${tintaClara(t.pageInk) ? "oscura" : "clara"}`} style={coloresDeTienda(t, colorDelPase(t))}>
      <style>{css}</style>
      <div className="centro">
        {suya
          ? <TuTarjeta n={await conFotoBanda(n)} cliente={suya} plataforma={plataformaDe((await headers()).get("user-agent"))} />
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
      <PedirNombre slug={slug} nuevo={nuevo} conNombre={n.pedirNombre} />
      {/* Lo mínimo del aviso de privacidad donde se recogen los datos (por capas):
          una línea y el enlace al resto. */}
      <p className="letra entra" style={{ animationDelay: "200ms" }}>
        Guardamos tus sellos{n.pedirNombre ? " y tu nombre" : ""} y te avisamos de sus promos.{" "}
        <a href={`/privacidad?b=${slug}`}>Privacidad</a>
      </p>
    </>
  );
}

// El botón es el de la Wallet de SU teléfono. En "otro" (un iPad en modo
// escritorio, un portátil) la tarjeta web, que ofrece las dos.
function TuTarjeta({ n, cliente, plataforma }) {
  const { serial } = cliente;
  // A la página que abre el pase y, cuando sale la Cartera, dice «Todo listo».
  const apple = plataforma === "ios" && proveedorWallet() === "apple" ? rutaListo(serial) : null;
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
      {/* Las promos vienen de partida (soft opt-in, LSSI 21.2): decir que no, borrar
          o descargar sus datos está a un toque, en su página. Sin casilla aquí: ni
          un paso más para todos, ni un "no" escondido. */}
      <a href={`/p/${serial}/datos`} className="gestionar entra" style={{ animationDelay: "340ms" }}>
        Gestionar mi tarjeta
      </a>
      <p className="letra">Te avisaremos de las promos de {n.nombre}. Puedes dejarlas cuando quieras.</p>
      {/* El teléfono recuerda la tarjeta un año. Si la tienda saca tarjetas desde el
          suyo, o el móvil es de dos, quien viene detrás no tiene por qué quedarse
          con la de otro: saca la suya. */}
      <a href={`/${n.slug}?nuevo=1`} className="enlace otra">
        {cliente.nombre ? `¿No eres ${cliente.nombre}?` : "¿No es tu tarjeta?"}
      </a>
    </>
  );
}

// Lo que se gana, en una línea por cartilla.
function promesa(n) {
  if (n.tipo === "descuento") return [n.premio];
  if (n.cartillas) return n.cartillas.map((c) => `${c.meta} ${c.nombre.toLowerCase()} · ${c.premio}`);
  return [`${n.meta} sellos · ${n.premio}`];
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
.otra{display:block;margin-top:26px;color:inherit;opacity:.62;overflow-wrap:anywhere}
.gestionar{display:inline-grid;place-items:center;margin:26px auto 0;min-height:44px;padding:0 18px;border-radius:14px;
  border:1px solid currentColor;color:inherit;font-size:15px;font-weight:550;text-decoration:none;opacity:.85}
@media (hover:hover){.gestionar:hover{opacity:1}}
.letra{margin:12px auto 0;max-width:300px;font-size:12.5px;line-height:1.45;color:color-mix(in srgb,currentColor 62%,transparent);text-wrap:balance}
.letra a{color:inherit}
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
