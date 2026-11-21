import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * API tests: real HTTP requests against a running app (`npm run dev` or
 * `npm start`) backed by a real local Supabase (`npx supabase start`).
 * Supabase settings come from .env.local, like the app itself.
 */
export default defineConfig(({ mode }) => ({
  test: {
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
}));
