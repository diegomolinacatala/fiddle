import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs}"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.js"],
      reporter: ["text-summary", "text"],
    },
  },
});
