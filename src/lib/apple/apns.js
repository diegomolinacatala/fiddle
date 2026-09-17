import http2 from "node:http2";

// ============================================================================
// APPLE WALLET — avisos de actualización por APNs
// ----------------------------------------------------------------------------
// Para que un pase se actualice solo, se manda un push VACÍO a cada iPhone que lo
// tiene. El iPhone entonces pregunta a nuestro web service qué cambió y se baja
// el pase nuevo. Requisitos de Apple para pases:
//   - host de PRODUCCIÓN (el sandbox no entrega avisos de pases)
//   - autenticación TLS con el MISMO certificado + clave con que se firma el pase
//   - apns-topic = passTypeIdentifier · apns-push-type: background · prioridad 5
//   - cuerpo: {}
// ============================================================================

export const APNS_HOST = "https://api.push.apple.com";
const CONCURRENCIA = 20;
const TIMEOUT_MS = 10_000;

// Razones por las que Apple dice que el token ya no vale: se borra el dispositivo.
const TOKEN_MUERTO = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

function enviarUno(sesion, token, topic) {
  return new Promise((resolve) => {
    const req = sesion.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
    });
    let estado = 0;
    let cuerpo = "";
    const fin = (resultado) => {
      clearTimeout(reloj);
      resolve(resultado);
    };
    const reloj = setTimeout(() => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      fin({ token, estado: 0, razon: "Timeout" });
    }, TIMEOUT_MS);

    req.setEncoding("utf8");
    req.on("response", (h) => { estado = h[":status"]; });
    req.on("data", (trozo) => { cuerpo += trozo; });
    req.on("end", () => {
      let razon = null;
      try { razon = cuerpo ? JSON.parse(cuerpo).reason ?? null : null; } catch { razon = cuerpo.slice(0, 100); }
      fin({ token, estado, razon });
    });
    req.on("error", (e) => fin({ token, estado: 0, razon: e.message }));
    req.end("{}");
  });
}

/**
 * Envía el aviso de actualización a una lista de push tokens.
 * @param {string[]} tokens
 * @param {{cert:string, key:string, passphrase?:string, passTypeId:string}} config
 * @param {{host?:string, ca?:string}} [opciones]  host/ca inyectables en tests
 * @returns {Promise<{enviados:number, invalidos:string[], errores:{token:string, estado:number, razon:string|null}[]}>}
 */
export async function enviarAvisos(tokens, config, { host = APNS_HOST, ca } = {}) {
  const unicos = [...new Set(tokens)].filter((t) => /^[0-9a-f]+$/i.test(t));
  const resumen = { enviados: 0, invalidos: [], errores: [] };
  if (!unicos.length) return resumen;

  const sesion = http2.connect(host, {
    cert: config.cert,
    key: config.key,
    passphrase: config.passphrase,
    ...(ca ? { ca } : {}),
  });
  // Un fallo de conexión (certificado rechazado, red) no debe tumbar el proceso:
  // cada request lo reporta como error.
  sesion.on("error", () => {});

  try {
    for (let i = 0; i < unicos.length; i += CONCURRENCIA) {
      const lote = unicos.slice(i, i + CONCURRENCIA);
      const resultados = await Promise.all(lote.map((t) => enviarUno(sesion, t, config.passTypeId)));
      for (const r of resultados) {
        if (r.estado === 200) resumen.enviados++;
        else if (r.estado === 410 || TOKEN_MUERTO.has(r.razon)) resumen.invalidos.push(r.token);
        else resumen.errores.push(r);
      }
    }
  } finally {
    sesion.close();
  }
  return resumen;
}
