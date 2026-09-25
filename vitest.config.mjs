import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs}"],
    // Nube, Fade y Forno: los casos de prueba que la app ya no trae (ver el fichero).
    setupFiles: ["tests/tiendasDePrueba.js"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.js"],
      reporter: ["text-summary", "text"],
    },
  },
});
