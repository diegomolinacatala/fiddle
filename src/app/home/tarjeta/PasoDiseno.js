"use client";

import CaraDelPase from "@/app/CaraDelPase";
import { LogoApple } from "@/app/LogoTienda";
import { ICONOS, FONDOS, NUMEROS, MAX_NOMBRE, NOMBRE_POR_DEFECTO, tarjetaDe } from "./opciones";
import Colores from "./Colores";
import { Modos, Opcion, Segmentos, Grupo } from "./controles";

/**
 * El contenido de cada paso de diseño (cuántos premios, puntos, color, icono y nombre).
 * No lleva estado de la elección: todo entra por props. El paso de guardar es de
 * <Guardar />, no de aquí.
 *
 * @param {object}   props
 * @param {"cuantas"|"puntos"|"color"|"icono"|"nombre"} props.id  qué paso pintar (PASOS_DISENO[i].id)
 * @param {object}   props.e          lo elegido, ya pasado por limpiar()
 * @param {string}   props.nombre     el nombre tal como se escribe (sin limpiar)
 * @param {0|1}      props.hueco      con dos premios, de cuál se elige el icono (0 el primero)
 * @param {object}   props.tema       temaDe(e): de ahí sale el fondo de los iconos
 * @param {boolean}  props.quieto     «reducir movimiento»
 * @param {(cambios: object) => void} props.cambiar          cambia la elección sin pasar de paso
 * @param {(texto: string) => void}   props.escribirNombre   ya recortado a MAX_NOMBRE
 * @param {(cambios: object) => void} props.elegirYSeguir    cambia y quien manda pasa al siguiente
 * @param {(id: string) => void}      props.elegirIcono      quien manda decide el hueco y si sigue
 * @param {() => void} [props.alIntro]  Enter en el nombre
 */
export default function PasoDiseno({ id, e, nombre, hueco, tema, quieto, cambiar, escribirNombre, elegirYSeguir, elegirIcono, alIntro }) {
  const iconoDe = hueco === 0 ? e.icono : e.icono2;

  if (id === "cuantas") {
    return (
      <div className="prob-cuantas" role="radiogroup" aria-label="Cuántos premios">
        {[1, 2].map((n) => {
          const { negocio, cliente } = tarjetaDe({ ...e, cartillas: n, modo: "relleno" });
          return (
            <Opcion key={n} activa={e.cartillas === n} alElegir={() => elegirYSeguir({ cartillas: n })} etiqueta={n === 1 ? "Un premio" : "Dos premios"}>
              <span className="prob-foto" aria-hidden="true"><CaraDelPase cliente={cliente} negocio={negocio} /></span>
            </Opcion>
          );
        })}
      </div>
    );
  }

  if (id === "puntos") return <Modos eleccion={e} alElegir={(modo) => elegirYSeguir({ modo })} />;

  if (id === "color") {
    return (
      <>
        <Colores valor={e.paleta} alCambiar={(paleta) => cambiar({ paleta })} quieto={quieto} />
        <Grupo titulo="Fondo de la banda">
          <Segmentos opciones={FONDOS} valor={e.fondo} alCambiar={(fondo) => cambiar({ fondo })} />
        </Grupo>
        {e.modo !== "casillas" && (
          <Grupo titulo="Números">
            <Segmentos opciones={NUMEROS} valor={e.cifras} alCambiar={(cifras) => cambiar({ cifras })} />
          </Grupo>
        )}
      </>
    );
  }

  if (id === "icono") {
    return (
      <div className="prob-rejilla prob-iconos" role="radiogroup" aria-label="Icono">
        {ICONOS.filter((ic) => hueco === 0 || ic.id !== e.icono).map((ic) => (
          <Opcion key={ic.id} activa={iconoDe === ic.id} alElegir={() => elegirIcono(ic.id)} etiqueta={ic.nombre}>
            <span className="prob-icono" style={{ background: tema.cardBg }}>
              <LogoApple tema={{ ...tema, marca: ic.id }} tam={34} />
            </span>
          </Opcion>
        ))}
      </div>
    );
  }

  if (id === "nombre") {
    return (
      <label className="prob-nombre">
        <span className="prob-oculto">El nombre de tu cafetería</span>
        <input
          value={nombre}
          onChange={(ev) => escribirNombre(ev.target.value.slice(0, MAX_NOMBRE))}
          placeholder={NOMBRE_POR_DEFECTO}
          maxLength={MAX_NOMBRE}
          autoComplete="organization"
          enterKeyHint="next"
          onKeyDown={(ev) => ev.key === "Enter" && alIntro?.()}
        />
        <span className="prob-cuenta">{nombre.length}/{MAX_NOMBRE}</span>
      </label>
    );
  }

  return null;
}
