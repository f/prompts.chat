import type { Prisma } from "@prisma/client";
import {
  buildClassifierSeedStatements,
  CLASSIFIER_SEED_SUMMARY_SQL,
  prepareClassifierCatalog,
  type ClassifierSeedAuthor,
  type ClassifierSeedCounts,
} from "./seed-sql";

/** Any Prisma client, whatever its constructor options (the app's client omits embeddings) */
interface RawTransactionClient {
  $transaction<R>(fn: (tx: Prisma.TransactionClient) => Promise<R>, options?: { timeout?: number; maxWait?: number }): Promise<R>;
}

export interface ClassifierImportResult {
  authorId: string;
  classifiersInserted: number;
  chainsInserted: number;
  fixture: ClassifierSeedCounts;
}

/**
 * Inserts the curated classifier catalog in a single transaction, using the exact statements of
 * the production seed SQL. Safe to re-run: existing rows, edited curated rows and user classifiers
 * are never touched, and any conflict or failed integrity check rolls the whole import back.
 */
export async function importClassifierCatalog(
  prisma: RawTransactionClient,
  author: ClassifierSeedAuthor = { firstAdmin: true }
): Promise<ClassifierImportResult> {
  const { counts } = prepareClassifierCatalog();
  const statements = buildClassifierSeedStatements(author);

  const summary = await prisma.$transaction(
    async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }
      const rows = await tx.$queryRawUnsafe<{ classifiersInserted: number; chainsInserted: number; authorId: string }[]>(
        CLASSIFIER_SEED_SUMMARY_SQL
      );
      return rows[0];
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return { ...summary, fixture: counts };
}
