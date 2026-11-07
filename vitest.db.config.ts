import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration tests that run against a real Postgres database: `npm run test:db`.
 * TEST_DATABASE_URL must name a database whose name contains "test". Each run migrates a new,
 * empty schema in it and drops only that schema afterwards; nothing else in the database is touched.
 */
const base = process.env.TEST_DATABASE_URL;
const schema = `vitest_${Date.now().toString(36)}_${process.pid}`;
let schemaUrl = "";
if (base) {
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  schemaUrl = url.toString();
}
process.env.VITEST_DB_SCHEMA = schema;
process.env.VITEST_DB_URL = schemaUrl;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./vitest.db.global-setup.ts"],
    env: { DATABASE_URL: schemaUrl, DIRECT_URL: schemaUrl },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
