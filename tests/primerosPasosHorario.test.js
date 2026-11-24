// Tests del horario rápido de los primeros pasos (lógica pura).
import { describe, it, expect } from "vitest";
import { normalizarHorario } from "@/lib/horario";
import {
  TIPOS, DIAS_DE_PARTIDA, MAX_DIA, mover, limites, puedeMover, moverHora, tramosValidos,
  alternarDia, horarioDe, rapidoDe, rapidoDeTipo, barrasDeDia,
} from "@/app/[negocio]/primeros-pasos/horarioRapido";

describe("horarioDe", () => {
  it.each(TIPOS)("normalizarHorario acepta el tipo $id tal cual", (tipo) => {
    const horario = horarioDe(rapidoDeTipo(tipo.id));
    expect(normalizarHorario(horario)).toEqual(horario);
  });

  it("abre solo los días elegidos y deja el resto en null", () => {
    const h = horarioDe(rapidoDeTipo("todo", [0, 6]));
    expect(h.semana.map((d) => d !== null)).toEqual([true, false, false, false, false, false, true]);
    expect(h.cerrados).toEqual([]);
  });

  it("conserva la zona y los festivos de la tienda", () => {
    const h = horarioDe(rapidoDeTipo("todo"), { zona: "Atlantic/Canary", cerrados: ["2026-12-25"] });
    expect(h.zona).toBe("Atlantic/Canary");
    expect(h.cerrados).toEqual(["2026-12-25"]);
  });

  it("cada día lleva su propia copia de los tramos", () => {
    const h = horarioDe(rapidoDeTipo("todo"));
    expect(h.semana[0]).not.toBe(h.semana[1]);
  });
});

describe("rapidoDe", () => {
  it.each(TIPOS)("la vuelta de $id devuelve lo mismo", (tipo) => {
    const x = rapidoDeTipo(tipo.id, [1, 2, 4]);
    expect(rapidoDe(horarioDe(x))).toEqual(x);
  });

  it("es null si los días tienen horas distintas", () => {
    const h = horarioDe(rapidoDeTipo("todo"));
    const distinto = { ...h, semana: h.semana.map((d, i) => (i === 5 && d ? [{ abre: "09:00", cierra: "13:00" }] : d)) };
    expect(rapidoDe(distinto)).toBeNull();
  });

  it("es null sin horario o con todos los días cerrados", () => {
    expect(rapidoDe(null)).toBeNull();
    expect(rapidoDe({ zona: "Europe/Madrid", semana: Array(7).fill(null), cerrados: [] })).toBeNull();
  });

  it("entiende el tramo suelto de antes", () => {
    const viejo = { zona: "Europe/Madrid", semana: [{ abre: "07:00", cierra: "13:00" }, null, null, null, null, null, null], cerrados: [] };
    expect(rapidoDe(viejo)).toEqual({ tipo: "mananas", dias: [0], tramos: [{ abre: "07:00", cierra: "13:00" }] });
  });
});

describe("horas", () => {
  it("mover de 30 en 30 y acotado entre 00:00 y 23:30", () => {
    expect(mover("08:00", 30)).toBe("08:30");
    expect(mover("00:00", -30)).toBe("00:00");
    expect(mover("23:30", 30)).toBe("23:30");
    expect(MAX_DIA).toBe(23 * 60 + 30);
  });

  it("un tramo no cierra antes de abrir", () => {
    const t = [{ abre: "08:00", cierra: "08:30" }];
    expect(puedeMover(t, 0, "cierra", -1)).toBe(false);
    expect(moverHora(t, 0, "cierra", -1)).toEqual(t);
    expect(puedeMover(t, 0, "abre", 1)).toBe(false);
  });

  it("dos tramos no se pisan: queda media hora entre ellos", () => {
    const t = [{ abre: "08:00", cierra: "14:00" }, { abre: "14:30", cierra: "20:00" }];
    expect(limites(t, 0, "cierra").max).toBe(14 * 60);
    expect(puedeMover(t, 1, "abre", -1)).toBe(false);
    expect(moverHora(t, 0, "cierra", 1)).toEqual(t);
    expect(moverHora(t, 1, "abre", 1)[1].abre).toBe("15:00");
  });

  it("moverHora no muta lo recibido", () => {
    const t = [{ abre: "08:00", cierra: "14:00" }];
    const nuevo = moverHora(t, 0, "abre", -1);
    expect(nuevo[0].abre).toBe("07:30");
    expect(t[0].abre).toBe("08:00");
  });

  it("tramosValidos exige orden y descanso", () => {
    expect(tramosValidos(TIPOS[2].tramos)).toBe(true);
    expect(tramosValidos([{ abre: "10:00", cierra: "09:00" }])).toBe(false);
    expect(tramosValidos([{ abre: "08:00", cierra: "14:00" }, { abre: "14:00", cierra: "20:00" }])).toBe(false);
    expect(tramosValidos([])).toBe(false);
  });
});

describe("días y barras", () => {
  it("alternar un día lo abre o lo cierra, pero siempre queda alguno", () => {
    expect(alternarDia([0, 1], 6)).toEqual([0, 1, 6]);
    expect(alternarDia([0, 1, 6], 1)).toEqual([0, 6]);
    expect(alternarDia([3], 3)).toEqual([3]);
    expect(DIAS_DE_PARTIDA).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("las barras van de 0 a 1 sobre el eje de 6:00 a 24:00", () => {
    const [b] = barrasDeDia([{ abre: "06:00", cierra: "23:00" }]);
    expect(b.desde).toBe(0);
    expect(b.largo).toBeCloseTo(17 / 18);
    expect(barrasDeDia([{ abre: "03:00", cierra: "05:00" }])).toEqual([]);
    expect(barrasDeDia(null)).toEqual([]);
  });
});
