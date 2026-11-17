import { describe, it, expect } from "vitest";
import {
  trasSumar, cartillaLlena, PUNTOS_DE_PARTIDA, PROMOS, promoTras, pasoPorId,
  PASOS, PASOS_DEL_PANEL, pasoDeHash, siguienteDe, anteriorDe, avanceDe, hashDe,
} from "@/app/home/experiencia/logica";
import { INICIAL, META_WEB, SECCIONES, tarjetaDe } from "@/app/home/tarjeta/opciones";
import { avisoDePromo } from "@/app/home/demo";
import { camposDelPase } from "@/lib/apple/pase";

describe("la prueba de la web: sumar puntos", () => {
  it("un toque suma un punto y no da premio", () => {
    expect(trasSumar(3)).toEqual({ puntos: 4, premio: false });
  });

  it("el toque que llena la cartilla sigue sin dar premio", () => {
    expect(trasSumar(META_WEB - 1)).toEqual({ puntos: META_WEB, premio: false });
  });

  it("con la cartilla llena, el toque siguiente da el premio y la vacía", () => {
    expect(trasSumar(META_WEB)).toEqual({ puntos: 0, premio: true });
  });

  it("la cartilla está llena al llegar a la meta y no antes", () => {
    expect(cartillaLlena(META_WEB - 1)).toBe(false);
    expect(cartillaLlena(META_WEB)).toBe(true);
  });

  it("empieza con algunos puntos pero sin la cartilla llena", () => {
    expect(PUNTOS_DE_PARTIDA).toBeGreaterThan(0);
    expect(cartillaLlena(PUNTOS_DE_PARTIDA)).toBe(false);
  });
});

describe("el recorrido: los pasos y la URL", () => {
  it("los pasos van en este orden y no repiten id", () => {
    expect(PASOS.map((p) => p.id)).toEqual(["hola", "premios", "puntos", "color", "icono", "prueba", "guarda", "precios"]);
    expect(new Set(PASOS.map((p) => p.id)).size).toBe(PASOS.length);
  });

  it("el panel cuenta siete pasos: los precios son otra pantalla", () => {
    expect(PASOS_DEL_PANEL).toHaveLength(7);
    expect(PASOS_DEL_PANEL.some((p) => p.id === "precios")).toBe(false);
  });

  it("cada paso de diseño apunta a un paso de tarjeta/opciones y a su misma parte", () => {
    for (const p of PASOS.filter((x) => x.seccion)) {
      const s = SECCIONES.find((x) => x.id === p.seccion);
      expect(s, p.id).toBeTruthy();
      expect(p.parte).toBe(s.parte);
    }
  });

  it("un hash conocido lleva a su paso, con o sin la almohadilla", () => {
    expect(pasoDeHash("#color")).toBe("color");
    expect(pasoDeHash("prueba")).toBe("prueba");
  });

  it("sin hash, o con uno desconocido, se empieza por hola", () => {
    expect(pasoDeHash("")).toBe("hola");
    expect(pasoDeHash(undefined)).toBe("hola");
    expect(pasoDeHash("#nada")).toBe("hola");
  });

  it("a los precios no se llega por URL sin haber pasado por guardar", () => {
    expect(pasoDeHash("#precios")).toBe("guarda");
    expect(pasoDeHash("#precios", { puedePrecios: true })).toBe("precios");
  });

  it("hola va sin hash y el resto con el suyo", () => {
    expect(hashDe("hola")).toBe("");
    expect(hashDe("icono")).toBe("#icono");
  });

  it("siguiente y anterior recorren la lista y se acaban en sus extremos", () => {
    expect(siguienteDe("hola")).toBe("premios");
    expect(siguienteDe("guarda")).toBe("precios");
    expect(siguienteDe("precios")).toBeNull();
    expect(anteriorDe("premios")).toBe("hola");
    expect(anteriorDe("precios")).toBe("guarda");
    expect(anteriorDe("hola")).toBeNull();
  });

  it("el avance crece paso a paso, nunca sale de 0 a 1 y los precios lo llenan", () => {
    const avances = PASOS.map((p) => avanceDe(p.id));
    for (let i = 1; i < avances.length; i++) expect(avances[i]).toBeGreaterThanOrEqual(avances[i - 1]);
    expect(Math.min(...avances)).toBeGreaterThan(0);
    expect(Math.max(...avances)).toBe(1);
    expect(avanceDe("guarda")).toBe(1);
    expect(avanceDe("desconocido")).toBe(0);
  });
});

describe("la tarjeta del visitante lleva los puntos de la prueba", () => {
  it("refleja los puntos en los sellos del cliente", () => {
    expect(tarjetaDe(INICIAL, { puntos: 3 }).cliente.sellos).toBe(3);
  });

  it("acota los puntos entre 0 y la meta", () => {
    expect(tarjetaDe(INICIAL, { puntos: -4 }).cliente.sellos).toBe(0);
    expect(tarjetaDe(INICIAL, { puntos: 999 }).cliente.sellos).toBe(META_WEB);
  });
});

describe("la prueba: la promoción que se manda a todos", () => {
  it('hay varias, cortas y sin repetir', () => {
    expect(PROMOS.length).toBeGreaterThan(1);
    expect(new Set(PROMOS).size).toBe(PROMOS.length);
    for (const p of PROMOS) expect(p.length).toBeLessThanOrEqual(30);
  });

  it('cada envío da la siguiente y, al acabar, da la vuelta', () => {
    expect(promoTras(0)).toBe(PROMOS[0]);
    expect(promoTras(1)).toBe(PROMOS[1]);
    expect(promoTras(PROMOS.length)).toBe(PROMOS[0]);
    expect(promoTras(PROMOS.length + 1)).toBe(PROMOS[1]);
  });

  it('la promo entra en el pase como el campo PROMO que avisa al cambiar', () => {
    const { negocio, cliente } = tarjetaDe(INICIAL, { promo: PROMOS[0] });
    const campo = camposDelPase(cliente, negocio).auxiliaryFields.find((f) => f.key === 'promo');
    expect(campo).toMatchObject({ value: PROMOS[0], changeMessage: '%@' });
  });

  it('sin promo, el pase no lleva ese campo ni hay aviso de promoción', () => {
    const tarjeta = tarjetaDe(INICIAL);
    expect(camposDelPase(tarjeta.cliente, tarjeta.negocio).auxiliaryFields.some((f) => f.key === 'promo')).toBe(false);
    expect(avisoDePromo(tarjeta)).toBe('');
  });

  it('el aviso de promoción es el texto del campo', () => {
    expect(avisoDePromo(tarjetaDe(INICIAL, { promo: PROMOS[1] }))).toBe(PROMOS[1]);
  });

  it('la prueba enseña la tarjeta entera: la cámara no se acerca a la banda', () => {
    expect(pasoPorId('prueba').parte).toBe('todo');
  });
});
