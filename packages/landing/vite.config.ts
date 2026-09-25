import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/**/*.worker.test.ts", "tests/**/*-worker.test.ts"],
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
