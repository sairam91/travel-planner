import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // API route and lib tests run in node; component tests opt into jsdom
    // via a `@vitest-environment jsdom` docblock.
    environment: "node",
    // Required for @testing-library/react's automatic DOM cleanup
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    clearMocks: true,
  },
});
