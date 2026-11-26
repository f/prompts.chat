import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can restore deleted prompts
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if prompt exists and is deleted
    const prompt = await db.prompt.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, type: true },
    });

    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    if (!prompt.deletedAt) {
      return NextResponse.json({ error: "Prompt is not deleted" }, { status: 400 });
    }

    // Restore the prompt by setting deletedAt to null
    await db.prompt.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Revalidate caches (prompts, categories, tags, flow counts change)
    revalidateTag("prompts", "max");
    revalidateTag("categories", "max");
    revalidateTag("tags", "max");
    revalidateTag("prompt-flow", "max");
    if (prompt.type === "CLASSIFIER") revalidateTag("classifiers", "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Restore prompt error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
