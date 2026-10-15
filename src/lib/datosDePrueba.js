// ============================================================================
// DATOS DE PRUEBA PARA LA WEB DE `dev`
// ----------------------------------------------------------------------------
// La web de dev no tiene base de datos: usa el modo ficheros (store.js) en /tmp
// de Vercel. Para que no arranque vacía, la primera vez que se lee `negocios`,
// `clientes` o `eventos` sale esto: La Delicantería con clientes inventados,
// tres semanas de caja dentro de su horario, con lo raro que hay que poder ver
// (un sello con la tienda cerrada, una corrección, siete sellos de golpe) y una
// plantilla inventada que lleva dos semanas apuntando quién da cada sello.
// Detrás, otros tantos de hace uno o dos meses (ANTES), con lo que el Resumen
// necesita para no salir vacío: quien sigue, quien se enfría, quien vuelve tras
// una pausa, quien vino una vez y quien la sacó y la estrena tarde o nunca.
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

// Los de hace uno o dos meses (alta de hace ANTES_DIAS[0] a ANTES_DIAS[1] días).
// Sin pasar de diez semanas: así el Resumen enseña las cohortes por semana, que es
// lo que ve una tienda en sus primeros meses (lib/crm.js, `cohorteSemanas`).
const NOMBRES_ANTES = [
  "Rosa", "Manu", "Teresa", "Álvaro", "Inés", null, "Jaime", "Patricia", "Rubén", "Noelia",
  "Adrián", null, "Lorena", "Gonzalo", "Silvia", "Miguel", null, "Eva", "Fernando", "Cristina",
  "Samuel", "Julia", null, "Héctor", "Marina", "Alberto", "Rocío", "Pedro", "Celia", "Nacho",
];
const ANTES_DIAS = [32, 66];

// La plantilla inventada (lib/plantilla.js) y cómo se reparte la caja. Lleva
// DIAS_PLANTILLA días en marcha: lo anterior va sin nombre, como pasará de
// verdad en una tienda que la estrene. Cada uno con su patrón, para que las
// conclusiones tengan algo que decir.
const DIAS_PLANTILLA = 14;
// El PIN de TODOS en dev. Con hash FIJO (sal fija, solo aquí): cada función de
// Vercel arranca con su propia copia de la semilla en /tmp, y un PIN elegido en
// una no existe en las demás (ni la cookie, que lleva la huella del hash): la caja
// pedía el PIN una y otra vez. Con el mismo hash en todas, entra en cualquiera.
// Para ver el «elige tu PIN», el manager se lo quita a alguien desde Plantilla.
export const PIN_DEV = "1234";
const HASH_PIN_DEV = "scrypt$666964646c652d6465762d70696e2d31$873d56773dd6db6c471f7768a5f9e1e71ee22b8078301b872a090844999ec367";
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

  // El alta se sortea justo tras el serial: en ese orden, los de siempre salen igual.
  const nuevoCliente = (nombre, sortearAlta) => {
    const serial = serialDe(r);
    const altaHace = sortearAlta();
    const c = {
      serial, negocio: SLUG, auth_token: serialDe(r).replace(/-/g, ""), nombre,
      sellos: 0, sellos2: 0, premios: 0, guardados: 0, guardados2: 0,
      codigo: codigoLibre(usados, serial), origen: r() < 0.8 ? "tap" : "manager",
      visitas: 0, ultima_visita: null, instalado: null, desinstalado: null, mensaje: null, nota: null,
    };
    usados.add(c.codigo);
    clientes[serial] = c;
    return [c, altaHace];
  };
  // Viene cada `cada` días, de hace `desde` a hace `hasta`, dentro del horario. El
  // pase sale en su primera visita si es la del día del alta (`altaHace`).
  const venir = (c, { desde, hasta = 0, cada, altaHace }) => {
    for (let d = desde; d >= hasta; d -= cada) {
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
  };
  // Sin visita el día del alta, el pase salió por la mañana (y sin evento, como siempre).
  const cerrarAlta = (c, altaHace) => {
    if (!c.creado) c.creado = en(sumarDias(hoy, -altaHace), 9 * 60).toISOString();
    if (r() < 0.6) c.instalado = c.creado;
  };

  NOMBRES.forEach((nombre, n) => {
    const [c, altaHace] = nuevoCliente(nombre, () => 1 + Math.floor(r() * 21));
    // Cada uno con su ritmo: de casi a diario a una vez por semana.
    venir(c, { desde: altaHace, cada: [1, 2, 3, 5, 7][n % 5], altaHace });
    cerrarAlta(c, altaHace);
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

  // Los de hace uno o dos meses, cada uno con su historia. Van al final para que lo
  // de arriba (los recientes, lo raro) salga igual que antes de que existieran.
  NOMBRES_ANTES.forEach((nombre, n) => {
    const [c, altaHace] = nuevoCliente(nombre, () => ANTES_DIAS[0] + Math.floor(r() * (ANTES_DIAS[1] - ANTES_DIAS[0] + 1)));
    const cada = [2, 3, 5, 7][n % 4];
    switch (n % 6) {
      case 0: // sigue a su ritmo
      case 5:
        venir(c, { desde: altaHace, cada, altaHace });
        break;
      case 1: // venía y lleva unas semanas sin aparecer: se enfría
        venir(c, { desde: altaHace, hasta: 15 + (n % 14), cada, altaHace });
        break;
      case 2: // dos o tres visitas, un mes largo fuera y ha vuelto estos días
        venir(c, { desde: altaHace, hasta: altaHace - 14, cada: 7, altaHace });
        venir(c, { desde: 9, cada: 5, altaHace });
        break;
      case 3: // vino el día del alta y no volvió
        venir(c, { desde: altaHace, hasta: altaHace, cada: 1, altaHace });
        break;
      default: // la sacó y no la usó; la mitad la estrena estos días
        if (n % 2) venir(c, { desde: 6, cada: 4, altaHace });
    }
    cerrarAlta(c, altaHace);
  });

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
      slug: SLUG, nombre: tienda.nombre, tipo: tienda.tipo, creado: alta(ANTES_DIAS[1] + 2),
      config: {
        cartillas: tienda.cartillas,
        // Encendida aquí, aunque de partida venga apagada: la plantilla inventada es
        // para ver la pestaña. Apagarla desde el admin de dev no dura (cada función
        // de Vercel tiene su /tmp): para verla apagada, en local.
        plantillaActiva: true,
        plantilla: [
          { id: QUIEN.sebas, nombre: "Sebas", alta: alta(DIAS_PLANTILLA), baja: null, pin: HASH_PIN_DEV, largoPin: PIN_DEV.length },
          { id: QUIEN.andreina, nombre: "Andreina", alta: alta(DIAS_PLANTILLA), baja: null, pin: HASH_PIN_DEV, largoPin: PIN_DEV.length },
          { id: QUIEN.marta, nombre: "Marta", alta: alta(DIAS_PLANTILLA), baja: null, pin: HASH_PIN_DEV, largoPin: PIN_DEV.length },
          { id: QUIEN.jorge, nombre: "Jorge", alta: alta(DIAS_PLANTILLA), baja: null, pin: HASH_PIN_DEV, largoPin: PIN_DEV.length },
          { id: QUIEN.lucia, nombre: "Lucía", alta: alta(5), baja: null, pin: HASH_PIN_DEV, largoPin: PIN_DEV.length },
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
