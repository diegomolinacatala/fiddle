import { registrar, desregistrar } from "@/lib/apple/servicio";
import { depsServicio } from "@/lib/apple/deps";
import { aResponse, jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple Wallet: un iPhone se registra (POST) o se da de baja (DELETE) de un pase.
// /api/wallet/v1/devices/<dispositivo>/registrations/<passType>/<serial>

export async function POST(request, { params }) {
  const deps = depsServicio();
  if (!deps) return jsonError("Apple Wallet no configurado", 404);
  try {
    const { dispositivo, passType, serial } = await params;
    const cuerpo = await request.json().catch(() => null);
    return aResponse(await registrar(deps, {
      dispositivo, passType, serial, cuerpo, authorization: request.headers.get("authorization"),
    }));
  } catch (e) {
    return errorInterno("wallet registrar", e);
  }
}

export async function DELETE(request, { params }) {
  const deps = depsServicio();
  if (!deps) return jsonError("Apple Wallet no configurado", 404);
  try {
    const { dispositivo, passType, serial } = await params;
    return aResponse(await desregistrar(deps, {
      dispositivo, passType, serial, authorization: request.headers.get("authorization"),
    }));
  } catch (e) {
    return errorInterno("wallet desregistrar", e);
  }
}
