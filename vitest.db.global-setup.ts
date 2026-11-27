import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/** Applies every migration to this run's own schema, and drops that schema when the run ends */
export default function setup() {
  const base = process.env.TEST_DATABASE_URL;
  const url = process.env.VITEST_DB_URL;
  const schema = process.env.VITEST_DB_SCHEMA;
  if (!base || !url || !schema) {
    throw new Error("TEST_DATABASE_URL is required for database tests, e.g. postgresql://postgres:postgres@localhost:5432/prompts_chat_test");
  }
  const database = new URL(base).pathname.slice(1);
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to use "${database}": the database tests only run on a database whose name contains "test"`);
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe" });

  return async () => {
    const prisma = new PrismaClient({ datasourceUrl: base });
    try {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await prisma.$disconnect();
    }
  };
}
