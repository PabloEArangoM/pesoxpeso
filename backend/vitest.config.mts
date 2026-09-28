import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgres://pxp:pxp@localhost:5432/pesoxpeso_test",
      JWT_SECRET: "test-secret-access",
      JWT_REFRESH_SECRET: "test-secret-refresh",
      RATE_LIMIT_AUTH_MAX: "10000",
      NODE_ENV: "test",
    },
  },
});
