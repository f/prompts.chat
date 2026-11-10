import { PrismaClient } from "@prisma/client";
import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import { getDatabaseDriver, getDatabaseUrl } from "@/lib/db-config";
import { withPerTransactionClient } from "@/lib/db-transactions";

type DriverAdapter = PrismaNeon | PrismaNeonHTTP;

function createPrismaClient(adapter?: DriverAdapter) {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    adapter: adapter ?? null,
    datasourceUrl: adapter ? undefined : getDatabaseUrl(),
    // Prompt embeddings are large vectors that only the AI search code reads,
    // always through an explicit `select`. Omitting them by default keeps them
    // out of server-rendered pages and API responses.
    omit: {
      prompt: { embedding: true },
    },
  });
}

type Client = ReturnType<typeof createPrismaClient>;

function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) throw new Error("Set PCHAT_DATABASE_URL (or DATABASE_URL) to a PostgreSQL connection string");
  return url;
}

const prismaClientSingleton = (): Client => {
  if (getDatabaseDriver() === "neon") {
    const connectionString = requireDatabaseUrl();
    return withPerTransactionClient(
      createPrismaClient(new PrismaNeonHTTP(connectionString, {})),
      () => createPrismaClient(new PrismaNeon({ connectionString }))
    );
  }
  return createPrismaClient();
};

const globalForPrisma = globalThis as unknown as {
  prisma: Client | undefined;
};

export const db = globalForPrisma.prisma ?? prismaClientSingleton();

// Always reuse the same instance to prevent connection pool exhaustion
globalForPrisma.prisma = db;
