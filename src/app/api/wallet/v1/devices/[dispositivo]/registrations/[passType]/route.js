import { pasesActualizados } from "@/lib/apple/servicio";
import { depsServicio } from "@/lib/apple/deps";
import { aResponse, jsonError, errorInterno } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple Wallet: ¿qué pases de este iPhone cambiaron desde `passesUpdatedSince`?
// GET /api/wallet/v1/devices/<dispositivo>/registrations/<passType>?passesUpdatedSince=<tag>
export async function GET(request, { params }) {
  const deps = depsServicio();
  if (!deps) return jsonError("Apple Wallet no configurado", 404);
  try {
    const { dispositivo, passType } = await params;
    const desde = new URL(request.url).searchParams.get("passesUpdatedSince");
    return aResponse(await pasesActualizados(deps, { dispositivo, passType, desde }));
  } catch (e) {
    return errorInterno("wallet seriales", e);
  }
}
