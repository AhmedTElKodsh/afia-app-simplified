import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "..",
  test: { include: ["worker/test/**/*.test.ts"] },
});
