// ============================================================================
// DATOS DE PRUEBA PARA LA WEB DE `dev`
// ----------------------------------------------------------------------------
// La web de dev no tiene base de datos: usa el modo ficheros (store.js) en /tmp
// de Vercel. Para que no arranque vacía, la primera vez que se lee `negocios`,
// `clientes` o `eventos` sale esto: La Delicantería con clientes inventados,
// tres semanas de caja dentro de su horario, con lo raro que hay que poder ver
// (un sello con la tienda cerrada, una corrección, siete sellos de golpe) y una
// plantilla inventada que lleva dos semanas apuntando quién da cada sello.
//
// Se genera al vuelo y con una semilla fija: el mismo despliegue da los mismos
// clientes, y las fechas van respecto a HOY para que siempre parezca reciente.
//
// Lo que se cambie en dev vive en /tmp mientras la función siga despierta: tras
// un rato sin uso o un despliegue nuevo, vuelve a esto. Es para mirar y tocar,
// no para guardar nada.
//
// Solo con DATOS_DE_PRUEBA=1 y NUNCA en producción (`activos`).
// ============================================================================

import { SEMILLAS } from "./negocios";
import { tramosDe, fechaLocal, sumarDias, inicioDelDia, relojLocal, diaDeFecha } from "./horario";
import { codigoLibre } from "./codigo";
import { soloVisitas } from "./crm";

export const activos = () =>
  process.env.DATOS_DE_PRUEBA === "1" && process.env.VERCEL_ENV !== "production";

const NOMBRES = [
  "Ana", "Luis", "Marta", "Pablo", "Lucía", "Javi", "Sara", "Diego", "Carmen", "Hugo",
  "Elena", "Raúl", "Nuria", "Iván", "Paula", null, null, "Andrea", "Óscar", "Irene",
  "Toni", null, "Clara", "Marc", "Alba", "Sergio", null, "Laura", "Dani", "Bea",
];

// La plantilla inventada (lib/plantilla.js) y cómo se reparte la caja. Lleva
// DIAS_PLANTILLA días en marcha: lo anterior va sin nombre, como pasará de
// verdad en una tienda que la estrene. Cada uno con su patrón, para que las
// conclusiones tengan algo que decir.
const DIAS_PLANTILLA = 14;
const QUIEN = {
  sebas: "sebas001",   // mañanas entre semana, el más rápido, estrena tarjetas
  andreina: "andre001", // tardes entre semana
  marta: "marta001",   // los sábados y algún cierre (y el sello de después de cerrar)
  jorge: "jorge001",   // suelto, por toda la semana; corrige más que nadie
  lucia: "lucia001",   // nueva: lleva cinco días
};

// Generador con semilla (mulberry32): mismos datos en cada arranque.
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const serialDe = (r) =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(r() * 16).toString(16));

const SLUG = "delicanteria";
let cache = null;

/** { negocios, clientes, eventos } de partida para el modo ficheros de dev. */
export function generar(ahora = Date.now()) {
  const tienda = SEMILLAS[SLUG];
  const { horario } = tienda;
  const zona = horario.zona;
  const metas = tienda.cartillas.map((c) => c.meta);
  const r = azar(20261008);
  const hoy = fechaLocal(ahora, zona);
  const clientes = {};
  const eventos = [];
  const usados = new Set();
  const en = (fecha, minutos) => new Date(inicioDelDia(fecha, zona) + minutos * 60_000);
  const desdePlantilla = sumarDias(hoy, -DIAS_PLANTILLA);
  const desdeLucia = sumarDias(hoy, -5);

  // Quién estaba en la caja en ese momento (null: antes de la plantilla, sin nombre).
  const quienAtiende = (ts) => {
    const { fecha, minutos } = relojLocal(ts.getTime(), zona);
    if (fecha < desdePlantilla) return null;
    if (fecha >= desdeLucia && r() < 0.3) return QUIEN.lucia;
    if (r() < 0.15) return QUIEN.jorge;
    if (diaDeFecha(fecha) === 5) return QUIEN.marta;
    if (minutos < 14 * 60) return r() < 0.85 ? QUIEN.sebas : QUIEN.marta;
    return r() < 0.85 ? QUIEN.andreina : QUIEN.marta;
  };

  const ev = (c, tipo, mensaje, ts, { actor = "caja", empleado = null } = {}) => {
    if (ts.getTime() > ahora) return;
    eventos.push({ serial: c.serial, tipo, mensaje, negocio: SLUG, actor, empleado, ts: ts.toISOString() });
  };
  const sellar = (c, i, ts, quien = quienAtiende(ts)) => {
    const clave = i ? "sellos2" : "sellos";
    const nombre = tienda.cartillas[i].nombre;
    c[clave] += 1;
    ev(c, i ? "sellar2" : "sellar", `Sello ${nombre} ${c[clave]}/${metas[i]}`, ts, { empleado: quien });
    if (c[clave] >= metas[i]) {
      const t = new Date(ts.getTime() + 20_000);
      if (r() < 0.7) {
        c[clave] = 0;
        c.premios += 1;
        ev(c, i ? "canjear2" : "canjear", `Canjeó: ${tienda.cartillas[i].premio}`, t, { empleado: quien });
      } else {
        c[clave] = 0;
        c[i ? "guardados2" : "guardados"] += 1;
        ev(c, i ? "guardar2" : "guardar", `Guardó: ${tienda.cartillas[i].premio}`, t, { empleado: quien });
      }
    }
  };
  // Uno de más, y quien está en la caja lo quita.
  const corregir = (c, i, ts, quien) => {
    const clave = i ? "sellos2" : "sellos";
    c[clave] = Math.max(0, c[clave] - 1);
    ev(c, i ? "restar2" : "restar", `Corrección → ${tienda.cartillas[i].nombre} ${c[clave]}/${metas[i]}`, ts, { empleado: quien });
  };

  NOMBRES.forEach((nombre, n) => {
    const serial = serialDe(r);
    const altaHace = 1 + Math.floor(r() * 21);
    const fechaAlta = sumarDias(hoy, -altaHace);
    const c = {
      serial, negocio: SLUG, auth_token: serialDe(r).replace(/-/g, ""), nombre,
      sellos: 0, sellos2: 0, premios: 0, guardados: 0, guardados2: 0,
      codigo: codigoLibre(usados, serial), origen: r() < 0.8 ? "tap" : "manager",
      visitas: 0, ultima_visita: null, instalado: null, desinstalado: null, mensaje: null, nota: null,
    };
    usados.add(c.codigo);
    clientes[serial] = c;
    // Cada uno con su ritmo: de casi a diario a una vez por semana.
    const cada = [1, 2, 3, 5, 7][n % 5];
    for (let d = altaHace; d >= 0; d -= cada) {
      const fecha = sumarDias(hoy, -d);
      const tramos = tramosDe(horario, fecha);
      if (!tramos.length) continue;
      const tramo = tramos[Math.floor(r() * tramos.length)];
      const min = tramo.abre + Math.floor(r() * (tramo.cierra - tramo.abre - 5));
      const ts = en(fecha, min);
      if (d === altaHace) {
        c.creado = new Date(ts.getTime() - 60_000).toISOString();
        ev(c, "alta", c.origen === "manager" ? "Pase emitido en el mostrador" : "Pase emitido", new Date(c.creado), { actor: c.origen });
      }
      if (r() < 0.75) sellar(c, 1, ts);
      if (r() < 0.55) sellar(c, 0, new Date(ts.getTime() + 15_000));
    }
    if (!c.creado) c.creado = en(fechaAlta, 9 * 60).toISOString();
    if (r() < 0.6) c.instalado = c.creado;
  });

  // Lo raro, para que Actividad y Plantilla tengan algo que enseñar.
  const lista = Object.values(clientes);
  const ayer = sumarDias(hoy, -1);
  const ultimoAbierto = [0, 1, 2, 3].map((i) => sumarDias(hoy, -i)).find((f) => tramosDe(horario, f).length && f !== hoy) || ayer;
  const cierre = tramosDe(horario, ultimoAbierto).at(-1)?.cierra ?? 18 * 60;
  // Un sello a los 40 minutos de cerrar: Marta, que cerraba.
  sellar(lista[3], 1, en(ultimoAbierto, cierre + 40), QUIEN.marta);
  // Uno de más, y Jorge lo quita.
  sellar(lista[5], 1, en(ultimoAbierto, 10 * 60 + 12), QUIEN.jorge);
  corregir(lista[5], 1, en(ultimoAbierto, 10 * 60 + 13), QUIEN.jorge);
  // Traía la cartilla de papel: siete cafés de golpe (UNA visita), con Sebas.
  for (let i = 0; i < 7; i += 1) sellar(lista[8], 1, en(ultimoAbierto, 11 * 60 + 2 + i / 6), QUIEN.sebas);
  // Jorge, de lunes a jueves por la tarde, da un sello de más y lo corrige: tres veces en dos semanas.
  let vecesJorge = 0;
  for (let d = 2; d <= DIAS_PLANTILLA && vecesJorge < 3; d += 1) {
    const fecha = sumarDias(hoy, -d);
    if (diaDeFecha(fecha) > 3 || !tramosDe(horario, fecha).length) continue;
    const c = lista[10 + vecesJorge];
    sellar(c, 0, en(fecha, 16 * 60 + 5), QUIEN.jorge);
    corregir(c, 0, en(fecha, 16 * 60 + 6), QUIEN.jorge);
    vecesJorge += 1;
  }

  // El resumen de visitas, como lo habría ido llevando registrarVisita.
  for (const v of soloVisitas(eventos)) clientes[v.serial].visitas += 1;
  for (const e of eventos) {
    const c = clientes[e.serial];
    if (e.tipo !== "alta" && !e.tipo.startsWith("restar") && (!c.ultima_visita || e.ts > c.ultima_visita)) c.ultima_visita = e.ts;
  }
  for (const c of lista) c.actualizado = c.ultima_visita || c.creado;

  eventos.sort((a, b) => a.ts.localeCompare(b.ts));

  // La fila de la tienda: lo que no esté aquí lo pone la semilla (componerNegocio).
  const alta = (dias) => new Date(inicioDelDia(sumarDias(hoy, -dias), zona)).toISOString();
  const negocios = {
    [SLUG]: {
      slug: SLUG, nombre: tienda.nombre, tipo: tienda.tipo, creado: alta(60),
      config: {
        cartillas: tienda.cartillas,
        plantilla: [
          { id: QUIEN.sebas, nombre: "Sebas", alta: alta(DIAS_PLANTILLA), baja: null },
          { id: QUIEN.andreina, nombre: "Andreina", alta: alta(DIAS_PLANTILLA), baja: null },
          { id: QUIEN.marta, nombre: "Marta", alta: alta(DIAS_PLANTILLA), baja: null },
          { id: QUIEN.jorge, nombre: "Jorge", alta: alta(DIAS_PLANTILLA), baja: null },
          { id: QUIEN.lucia, nombre: "Lucía", alta: alta(5), baja: null },
        ],
      },
    },
  };
  return { negocios, clientes, eventos };
}

/** Lo de partida para un fichero del modo demo, o undefined si no hay. */
export function semillaDe(nombre) {
  if (!activos() || !["negocios", "clientes", "eventos"].includes(nombre)) return undefined;
  cache ||= generar();
  return structuredClone(cache[nombre]);
}
