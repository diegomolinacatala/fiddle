import { registrarLogs } from "@/lib/apple/servicio";
import { usoExcedido, ipDe } from "@/lib/limitador";
import { aResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple Wallet: el iPhone informa de errores (pase mal firmado, JSON inválido...).
// Salen en los logs del servidor (Vercel -> Logs), prefijados con [apple-wallet].
// Público por protocolo: se limita por IP y se sanean las líneas.
// POST /api/wallet/v1/log  body: { logs: ["..."] }
export async function POST(request) {
  try {
    // Por encima del límite se responde 200 igualmente (el iPhone no reintenta) pero no se escribe nada.
    if (await usoExcedido("log", ipDe(request))) return new Response(null, { status: 200 });
  } catch (e) {
    console.error("[apple-wallet log] limitador", e);
    return new Response(null, { status: 200 });
  }
  const cuerpo = await request.json().catch(() => null);
  return aResponse(registrarLogs({ log: (m) => console.warn(m) }, { cuerpo }));
}
