// Deja que un script de Node importe el código de la app tal cual lo escribe Next:
// `import … from "./negocios"` sin `.js` y `@/lib/…`. Node no los entiende solo.
// Uso: node --import ./scripts/lib/rutas.mjs scripts/lo-que-sea.mjs
import { register } from "node:module";

register("./rutas-hooks.mjs", import.meta.url);
