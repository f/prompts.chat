import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import { buildContributorField } from "@/lib/prompts-csv";

function escapeCSVField(field: string): string {
  if (!field) return "";
  
  const needsQuoting = /[,"\n\r]/.test(field) || field !== field.trim();
  
  if (needsQuoting) {
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  
  return field;
}

export const revalidate = 3600;

export async function GET() {
  try {
    const prompts = await db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false, // Exclude unlisted prompts from CSV export
        deletedAt: null,
        ...NON_BOT_PROMPTS,
      },
      select: {
        title: true,
        content: true,
        structuredFormat: true,
        category: {
          select: {
            slug: true,
          },
        },
        author: {
          select: {
            username: true,
            githubUsername: true,
          },
        },
        contributors: {
          select: {
            username: true,
            githubUsername: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const headers = ["act", "prompt", "for_devs", "type", "contributor"];
    const rows = prompts.map((prompt) => {
      const act = escapeCSVField(prompt.title);
      const promptContent = escapeCSVField(prompt.content);
      const forDevs = prompt.category?.slug === "coding" ? "TRUE" : "FALSE";
      const type = prompt.structuredFormat === "JSON" || prompt.structuredFormat === "YAML" ? "STRUCTURED" : "TEXT";
      const contributorField = escapeCSVField(buildContributorField(prompt.author, prompt.contributors));

      return [act, promptContent, forDevs, type, contributorField].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("prompts.csv error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
