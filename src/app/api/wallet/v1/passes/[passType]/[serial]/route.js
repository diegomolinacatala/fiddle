import { paseActual } from "@/lib/apple/servicio";
import { depsServicio } from "@/lib/apple/deps";
import { aResponse, jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple Wallet: el iPhone se baja la versión actual del pase.
// GET /api/wallet/v1/passes/<passType>/<serial>   (Authorization: ApplePass <token>)
export async function GET(request, { params }) {
  const deps = depsServicio();
  if (!deps) return jsonError("Apple Wallet no configurado", 404);
  try {
    const { passType, serial } = await params;
    return aResponse(await paseActual(deps, {
      passType, serial, authorization: request.headers.get("authorization"),
    }));
  } catch (e) {
    return errorInterno("wallet pase", e);
  }
}
