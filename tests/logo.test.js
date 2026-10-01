import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { procesarLogo, componerLogo } from "@/lib/logoImagen";
import { logoImagenDe, rutaLogoImagen, validarLogoImagen, tamLogo } from "@/lib/logo";
import { patchNegocio } from "@/lib/validacion";

const png = (w, h, svg) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg}</svg>`)).png().toBuffer();

describe("logo propio", () => {
  it("se recorta, se cuadra a 1024 y dice si tiene transparencias", async () => {
    const r = await procesarLogo(await png(900, 600, `<rect width="900" height="600" fill="#fff"/><circle cx="450" cy="300" r="200" fill="#c00"/>`));
    expect(r.error).toBeUndefined();
    const meta = await sharp(r.png).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 1024]);
    expect(r.id).toMatch(/^[0-9a-f]{24}$/);
    // Sin el borde blanco queda el círculo, cuadrado y opaco: a sangre.
    expect(r.opaco).toBe(true);
  });

  it("una imagen con fondo transparente no va a sangre", async () => {
    const r = await procesarLogo(await png(600, 600, `<circle cx="300" cy="300" r="250" fill="#06c"/>`));
    expect(r.opaco).toBe(false);
  });

  it("rechaza lo que no es imagen y lo que es demasiado pequeño", async () => {
    expect((await procesarLogo(Buffer.from("hola"))).error).toMatch(/imagen/);
    expect((await procesarLogo(await png(120, 120, `<rect width="120" height="120" fill="#0a0"/>`))).error).toMatch(/pequeña/);
  });

  it("se compone para cada sitio con su lado y su fondo", async () => {
    const r = await procesarLogo(await png(600, 600, `<circle cx="300" cy="300" r="250" fill="#06c"/>`));
    const icono = await componerLogo(r.png, 192, { opaco: r.opaco, fondo: "#fff7f2", escala: 0.8, sangre: true, radio: 40 });
    const m = await sharp(icono).metadata();
    expect([m.width, m.height]).toEqual([192, 192]);
    // La esquina queda transparente (redondeada) y el centro, del logo.
    const { data } = await sharp(icono).raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it("el tema solo acepta un logo bien formado; null lo quita", () => {
    const bueno = { id: "a".repeat(24), b: "deli", opaco: true };
    expect(logoImagenDe({ logoImagen: bueno })).toEqual(bueno);
    expect(logoImagenDe({ logoImagen: { id: "../x", b: "deli" } })).toBeNull();
    expect(validarLogoImagen(null)).toBeNull();
    expect(validarLogoImagen({ id: "z" })).toBeUndefined();
    expect(rutaLogoImagen({ logoImagen: bueno }, 90)).toBe(`/api/logo?b=deli&v=${"a".repeat(24)}&t=128`);
    expect(tamLogo(5000)).toBe(1024);
    expect(patchNegocio({ tema: { logoImagen: bueno } }, []).patch.tema).toEqual({ logoImagen: bueno });
    expect(patchNegocio({ tema: { logoImagen: null } }, []).patch.tema).toEqual({ logoImagen: null });
    expect(patchNegocio({ tema: { logoImagen: { id: "<script>" } } }, []).patch).toEqual({});
  });
});
