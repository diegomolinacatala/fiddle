"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { BotonAppleWallet } from "@/app/BotonesWallet";
import { COOKIE_ABIERTO, rutaListo, pkpassConAviso } from "@/lib/todoListo";

// La cookie llega con las cabeceras del pase; la hoja de la Cartera, con el pase
// entero y su animación. Se espera un poco para no adelantarse a ella.
const TRAS_COOKIE = 1200;
// Sin ninguna señal en este rato algo ha fallado (o este navegador no avisa): el
// botón oficial, que el cliente toca él. Nunca «listo» a ciegas.
const SIN_SENAL = 10000;

const hayCookie = () => document.cookie.split("; ").includes(`${COOKIE_ABIERTO}=1`);
const borrarCookie = (serial) => { document.cookie = `${COOKIE_ABIERTO}=; Path=${rutaListo(serial)}; Max-Age=0`; };

// Recargar la pestaña (o que Safari la recupere días después) no vuelve a sacar
// la Cartera si en esta pestaña ya salió.
const clave = (serial) => `pase-abierto:${serial}`;
const yaSalio = (serial) => { try { return sessionStorage.getItem(clave(serial)) === "1"; } catch { return false; } };
const apuntar = (serial) => { try { sessionStorage.setItem(clave(serial), "1"); } catch { /* modo privado */ } };

// Abre el .pkpass y dice «Todo listo» cuando ya ha salido la Cartera (ver
// lib/todoListo.js). Mientras tanto, la marca de la tienda respirando.
export default function AbrirPase({ serial, nombre, marca }) {
  const [estado, setEstado] = useState("abriendo"); // abriendo | listo | boton
  const pedido = useRef(false); // en desarrollo el efecto corre dos veces: un solo pase

  useEffect(() => {
    const como = performance.getEntriesByType?.("navigation")?.[0]?.type;
    if (como && como !== "navigate" && yaSalio(serial)) {
      setEstado("listo");
      return;
    }

    // Una cookie de un intento anterior diría «listo» antes de tiempo.
    borrarCookie(serial);
    const fuera = new AbortController();
    const relojes = [];
    let abierto = false;
    let hecho = false;
    const parar = () => {
      fuera.abort();
      clearInterval(mirar);
      relojes.forEach(clearTimeout);
    };
    const listo = () => {
      if (hecho) return;
      hecho = true;
      parar();
      apuntar(serial);
      borrarCookie(serial);
      setEstado("listo");
    };

    const mirar = setInterval(() => {
      if (!hayCookie()) return;
      clearInterval(mirar);
      relojes.push(setTimeout(listo, TRAS_COOKIE));
    }, 200);
    // Con el pase ya pedido, perder el foco u ocultarse es la hoja encima.
    const tapada = (e) => { if (abierto && (e.type === "blur" || document.hidden)) listo(); };
    window.addEventListener("blur", tapada, { signal: fuera.signal });
    document.addEventListener("visibilitychange", tapada, { signal: fuera.signal });

    // Después de `load`: Safari corta lo que la página aún esté cargando al
    // empezar otra navegación, y sin el JavaScript entero no habría «listo».
    const abrir = () => {
      abierto = true;
      relojes.push(setTimeout(() => setEstado("boton"), SIN_SENAL));
      if (pedido.current) return;
      pedido.current = true;
      location.replace(pkpassConAviso(serial));
    };
    if (document.readyState === "complete") abrir();
    else window.addEventListener("load", abrir, { once: true, signal: fuera.signal });

    return parar;
  }, [serial]);

  return (
    <div className={`caja ${estado}`}>
      <style>{css}</style>
      <div className="marca">
        {marca}
        {estado === "listo" && (
          <>
            <span className="chispas" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ "--i": i }} />)}
            </span>
            <span className="sello"><Icono nombre="check" tam={20} grosor={3} /></span>
          </>
        )}
      </div>
      <div className="zona" aria-live="polite">
        <div key={estado} className="texto"><Texto estado={estado} serial={serial} nombre={nombre} /></div>
      </div>
    </div>
  );
}

function Texto({ estado, serial, nombre }) {
  if (estado === "abriendo") return <p className="cargando"><span className="giro" />Abriendo tu tarjeta…</p>;
  if (estado === "listo") {
    return (
      <>
        <h1 className="titulo">¡Todo listo!</h1>
        <p className="sub">Ya puedes cerrar esta página.</p>
        <a className="otra" href={`/api/pase/${serial}`}>¿No la has añadido? Ábrela otra vez</a>
      </>
    );
  }
  return (
    <>
      <h1 className="titulo">{nombre}</h1>
      <p className="sub">Guarda tu tarjeta en la Cartera.</p>
      <div className="wallet"><BotonAppleWallet href={pkpassConAviso(serial)} /></div>
    </>
  );
}

// En `currentColor` y `--acento`, como la página de la tienda: sobre el fondo
// claro de una y el negro de otra sin saber cuál le toca. La zona del texto tiene
// alto fijo: al cambiar de estado, la marca no salta.
const css = `
.todolisto{min-height:100dvh;display:grid;place-items:center;text-align:center;
  padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom))}
.todolisto .caja{width:min(320px,100%);display:grid;justify-items:center;padding-bottom:6vh}
.todolisto .marca{position:relative;width:84px;height:84px;border-radius:20px;
  box-shadow:0 18px 36px -16px rgba(0,0,0,.5)}
.todolisto .abriendo .marca{animation:respira 1.8s ease-in-out infinite}
.todolisto .sello{position:absolute;right:-11px;bottom:-11px;width:38px;height:38px;border-radius:50%;
  display:grid;place-items:center;background:var(--acento);color:var(--sobre-acento);
  box-shadow:0 0 0 4px var(--anillo),0 10px 18px -8px rgba(0,0,0,.45);
  animation:pop .55s cubic-bezier(.34,1.56,.64,1) .1s both}
.todolisto .sello path{stroke-dasharray:20;stroke-dashoffset:20;animation:traza .35s ease-out .45s forwards}
.todolisto .chispas{position:absolute;left:76px;top:76px}
.todolisto .chispas i{position:absolute;left:-3.5px;top:-3.5px;width:7px;height:7px;border-radius:50%;
  background:var(--acento);opacity:0;animation:chispa .7s cubic-bezier(.2,.8,.2,1) .3s both}
.todolisto .chispas i:nth-child(even){width:5px;height:5px;left:-2.5px;top:-2.5px}
.todolisto .zona{min-height:190px}
.todolisto .texto{display:grid;justify-items:center;animation:entra .6s cubic-bezier(.2,.8,.2,1) both}
.todolisto .listo .texto{animation-delay:.2s}
.todolisto .titulo{margin:30px 0 0;font-size:30px;font-weight:650;letter-spacing:-.022em;line-height:1.12;
  text-wrap:balance;overflow-wrap:anywhere}
.todolisto .sub{margin:10px 0 0;font-size:16px;line-height:1.45;opacity:.68}
.todolisto .cargando{margin:34px 0 0;display:flex;align-items:center;gap:10px;font-size:16px;opacity:.68}
.todolisto .giro{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;
  animation:giro .7s linear infinite}
.todolisto .otra{margin-top:44px;font-size:13px;opacity:.55;text-decoration-thickness:1px;text-underline-offset:3px}
.todolisto .wallet{margin-top:26px;display:grid}
@keyframes respira{50%{transform:scale(.95);opacity:.8}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes traza{to{stroke-dashoffset:0}}
@keyframes chispa{
  from{opacity:1;transform:rotate(calc(var(--i) * 40deg - 15deg)) translateY(0) scale(1)}
  to{opacity:0;transform:rotate(calc(var(--i) * 40deg - 15deg)) translateY(-38px) scale(.3)}}
@keyframes entra{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes giro{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){
  .todolisto .abriendo .marca{animation:none}
  .todolisto .chispas{display:none}
  .todolisto .sello,.todolisto .sello path,.todolisto .texto{animation-duration:1ms;animation-delay:0s}
  .todolisto .giro{animation-duration:1.6s}}
`;
