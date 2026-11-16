import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../src");

export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith("@/")) {
    especificador = pathToFileURL(path.join(SRC, especificador.slice(2))).href;
  }
  try {
    return await siguiente(especificador, contexto);
  } catch (e) {
    const relativo = /^(\.{1,2}\/|file:)/.test(especificador);
    if (e?.code !== "ERR_MODULE_NOT_FOUND" || !relativo || path.extname(especificador)) throw e;
    try {
      return await siguiente(`${especificador}.js`, contexto);
    } catch {
      return siguiente(`${especificador}/index.js`, contexto);
    }
  }
}
