import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export class LastAdminError extends Error {
  constructor(message = "Cannot delete the sole administrator account") {
    super(message);
    this.name = "LastAdminError";
  }
}

export class ClassifierInChainError extends Error {
  constructor(message = "One or more of your classifier prompts are currently referenced in an active decision chain") {
    super(message);
    this.name = "ClassifierInChainError";
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Verify user exists and retrieve actual database role
    const existingUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "not_found", message: "User not found" },
        { status: 404 }
      );
    }

    // Execute deletion within an atomic Prisma transaction
    await db.$transaction(async (tx) => {
      // 1. Concurrency-safe last administrator protection using row-level locking
      if (existingUser.role === "ADMIN") {
        await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN'::"UserRole" FOR UPDATE`;
        const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) {
          throw new LastAdminError();
        }
      }

      // 2. ClassifierChainStep dependency check within the transaction
      const chainedClassifier = await tx.classifierChainStep.findFirst({
        where: { classifier: { authorId: userId } },
        select: { chainId: true, stepId: true },
      });

      if (chainedClassifier) {
        throw new ClassifierInChainError();
      }

      // 3. Explicitly revoke the user's API key
      await tx.user.update({
        where: { id: userId },
        data: { apiKey: null },
      });

      // 4. Explicitly delete user-created private and unlisted prompts
      await tx.prompt.deleteMany({
        where: {
          authorId: userId,
          OR: [{ isPrivate: true }, { isUnlisted: true }],
        },
      });

      // 5. Delete primary User entity (cascades remaining authored prompts per approved Approach A)
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Revalidate caches only after successful transaction completion
    try {
      revalidateTag("prompts", "max");
      revalidateTag("categories", "max");
      revalidateTag("tags", "max");
      revalidateTag("prompt-flow", "max");
      revalidateTag("classifiers", "max");
    } catch (e) {
      // Cache revalidation failure should not invalidate successful deletion
      console.error("Cache revalidation error:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Account and associated data deleted successfully",
    });
  } catch (error) {
    if (error instanceof LastAdminError) {
      return NextResponse.json(
        {
          error: "last_admin",
          message: "Cannot delete the sole administrator account. Promote another user to admin before deleting this account.",
        },
        { status: 403 }
      );
    }

    if (error instanceof ClassifierInChainError) {
      return NextResponse.json(
        {
          error: "classifier_in_chain",
          message: "Cannot delete account: One or more of your classifier prompts are currently referenced in an active decision chain. Please contact an administrator.",
        },
        { status: 409 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      const field = (error.meta?.field_name as string) || (error.meta?.target as string) || "";
      const isClassifier = field.includes("classifier") || field.includes("classifierId");

      return NextResponse.json(
        {
          error: isClassifier ? "classifier_in_chain" : "foreign_key_constraint",
          message: isClassifier
            ? "Cannot delete account: A prompt is referenced in an active classifier chain."
            : "Cannot delete account due to a relational dependency constraint.",
        },
        { status: 409 }
      );
    }

    console.error("Delete user account error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to delete account" },
      { status: 500 }
    );
  }
}
