import { PrismaClient } from "@prisma/client";
import { importClassifierCatalog } from "./classifiers/import";

/**
 * Inserts the curated classifier catalog (insert-only, see prisma/classifiers/seed-sql.ts).
 * The catalog is owned by --author=<username>, or by the first admin.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const username = process.argv.find((arg) => arg.startsWith("--author="))?.slice("--author=".length);
    const result = await importClassifierCatalog(prisma, username ? { username } : { firstAdmin: true });
    const owner = await prisma.user.findUnique({ where: { id: result.authorId }, select: { username: true } });
    console.log(
      `✅ Classifier catalog: inserted ${result.classifiersInserted} of ${result.fixture.classifiers} classifiers and ` +
        `${result.chainsInserted} of ${result.fixture.chains} chains (owner: @${owner?.username})`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
