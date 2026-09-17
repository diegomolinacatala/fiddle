import { describe, it, expect } from "vitest";
import { reglaDeRuta, destinoSeguro, negocioDeRuta } from "@/lib/acceso";

const regla = (ruta, method = "GET") => {
  const url = new URL(ruta, "http://x");
  return reglaDeRuta(url.pathname, url.searchParams, method);
};

describe("reglaDeRuta", () => {
  it("rutas públicas", () => {
    for (const r of ["/", "/login", "/api/login", "/api/logout", "/api/tap?b=nube", "/p/abc", "/api/pase/abc",
      "/api/wallet/v1/log", "/api/wallet/v1/devices/d/registrations/pass.x/s", "/api/manifest?b=nube", "/api/negocios",
      "/api/salud", "/nube"]) {
      expect(regla(r), r).toEqual({ tipo: "publica" });
    }
  });

  it("páginas de caja y manager exigen su negocio y rol", () => {
    expect(regla("/nube/caja")).toEqual({ tipo: "negocio", slug: "nube", rol: "caja" });
    expect(regla("/fade/manager")).toEqual({ tipo: "negocio", slug: "fade", rol: "manager" });
  });

  it("APIs con ?b= exigen el negocio indicado", () => {
    expect(regla("/api/negocio?b=nube")).toEqual({ tipo: "negocio", slug: "nube", rol: "caja" });
    expect(regla("/api/negocio?b=nube", "PUT")).toEqual({ tipo: "negocio", slug: "nube", rol: "manager" });
    expect(regla("/api/clientes?b=fade")).toEqual({ tipo: "negocio", slug: "fade", rol: "caja" });
    expect(regla("/api/crear?b=forno", "POST")).toEqual({ tipo: "negocio", slug: "forno", rol: "manager" });
    expect(regla("/api/clientes")).toEqual({ tipo: "negocio", slug: null, rol: "caja" });
  });

  it("el resto exige sesión (falla cerrado)", () => {
    for (const r of ["/w/abc", "/api/accion", "/api/cliente/abc", "/api/promo", "/api/estado", "/api/loquesea", "/p/a/b"]) {
      expect(regla(r), r).toEqual({ tipo: "sesion" });
    }
  });

  it("no confunde rutas reservadas con negocios", () => {
    expect(regla("/api")).toEqual({ tipo: "sesion" });
    expect(regla("/w")).toEqual({ tipo: "sesion" });
  });
});

describe("destinoSeguro", () => {
  it("solo acepta rutas internas", () => {
    expect(destinoSeguro("/nube/caja")).toBe("/nube/caja");
    expect(destinoSeguro("//evil.com")).toBeNull();
    expect(destinoSeguro("/\\evil.com")).toBeNull();
    expect(destinoSeguro("https://evil.com")).toBeNull();
    expect(destinoSeguro(null)).toBeNull();
  });
});

describe("negocioDeRuta", () => {
  it("extrae el slug del primer segmento", () => {
    expect(negocioDeRuta("/nube/caja")).toBe("nube");
    expect(negocioDeRuta("/fade")).toBe("fade");
    expect(negocioDeRuta("/w/123")).toBeNull();
    expect(negocioDeRuta(null)).toBeNull();
  });
});
