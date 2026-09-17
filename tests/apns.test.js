import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http2 from "node:http2";
import { enviarAvisos } from "@/lib/apple/apns";
import { cadenaDePrueba } from "../scripts/lib/certs.mjs";

// Servidor HTTP/2 local que imita a APNs. Su certificado de servidor sale de la
// misma CA de prueba, así el cliente puede validarlo con `ca`.
let servidor;
let host;
let cadena;
const peticiones = [];

const TOKEN_OK = "aa".repeat(32);
const TOKEN_MUERTO = "bb".repeat(32);
const TOKEN_410 = "cc".repeat(32);
const TOKEN_500 = "dd".repeat(32);

beforeAll(async () => {
  cadena = cadenaDePrueba({ passTypeId: "pass.dev.sellos" });
  servidor = http2.createSecureServer({ key: cadena.keyPem, cert: cadena.certPem, allowHTTP1: false });
  servidor.on("stream", (stream, headers) => {
    let cuerpo = "";
    stream.on("data", (d) => { cuerpo += d; });
    stream.on("end", () => {
      peticiones.push({ headers, cuerpo });
      const token = headers[":path"].split("/").pop();
      const responder = (status, json) => {
        stream.respond({ ":status": status, "content-type": "application/json" });
        stream.end(json ? JSON.stringify(json) : "");
      };
      if (token === TOKEN_OK) return responder(200);
      if (token === TOKEN_MUERTO) return responder(400, { reason: "BadDeviceToken" });
      if (token === TOKEN_410) return responder(410, { reason: "Unregistered" });
      return responder(500, { reason: "InternalServerError" });
    });
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  host = `https://localhost:${servidor.address().port}`;
});

afterAll(() => new Promise((r) => servidor.close(r)));

describe("enviarAvisos", () => {
  it("manda el push vacío con las cabeceras de Wallet y clasifica respuestas", async () => {
    // El certificado de prueba no lleva SAN "localhost": se confía en él vía `ca`
    // y se omite la comprobación de nombre solo en este test.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    try {
      const r = await enviarAvisos(
        [TOKEN_OK, TOKEN_OK, TOKEN_MUERTO, TOKEN_410, TOKEN_500, "no-hex"],
        { cert: cadena.certPem, key: cadena.keyPem, passTypeId: "pass.dev.sellos" },
        { host, ca: cadena.wwdrPem },
      );
      expect(r.enviados).toBe(1);
      expect(r.invalidos.sort()).toEqual([TOKEN_MUERTO, TOKEN_410].sort());
      expect(r.errores).toEqual([{ token: TOKEN_500, estado: 500, razon: "InternalServerError" }]);
    } finally {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }

    expect(peticiones).toHaveLength(4); // duplicados y tokens no hex se descartan
    const p = peticiones.find((x) => x.headers[":path"] === `/3/device/${TOKEN_OK}`);
    expect(p.headers[":method"]).toBe("POST");
    expect(p.headers["apns-topic"]).toBe("pass.dev.sellos");
    expect(p.headers["apns-push-type"]).toBe("background");
    expect(p.headers["apns-priority"]).toBe("5");
    expect(p.cuerpo).toBe("{}");
  });

  it("sin tokens no abre conexión", async () => {
    const r = await enviarAvisos([], { cert: "", key: "", passTypeId: "x" }, { host: "https://127.0.0.1:1" });
    expect(r).toEqual({ enviados: 0, invalidos: [], errores: [] });
  });

  it("si no puede conectar, reporta errores sin lanzar", async () => {
    const r = await enviarAvisos([TOKEN_OK], { cert: cadena.certPem, key: cadena.keyPem, passTypeId: "x" }, { host: "https://127.0.0.1:1" });
    expect(r.enviados).toBe(0);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0].estado).toBe(0);
  });
});
