import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { parsePromptsCsv, type CsvRow } from "@/lib/csv/parse-prompts";

// Backwards-compatible local alias for the shared parser.
const parseCSV = (content: string): CsvRow[] => parsePromptsCsv(content);

function mapCsvTypeToPromptType(csvType: string): { type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED"; structuredFormat: "JSON" | "YAML" | null } {
  const type = csvType.toUpperCase();
  if (type === "JSON") return { type: "STRUCTURED", structuredFormat: "JSON" };
  if (type === "YAML") return { type: "STRUCTURED", structuredFormat: "YAML" };
  if (type === "IMAGE") return { type: "IMAGE", structuredFormat: null };
  if (type === "VIDEO") return { type: "VIDEO", structuredFormat: null };
  if (type === "AUDIO") return { type: "AUDIO", structuredFormat: null };
  if (type === "STRUCTURED") return { type: "STRUCTURED", structuredFormat: "JSON" };
  return { type: "TEXT", structuredFormat: null };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read the prompts.csv file from the project root
    const csvPath = path.join(process.cwd(), "prompts.csv");
    const csvContent = await fs.readFile(csvPath, "utf-8");
    
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    // Get the admin user ID for fallback author assignment
    const adminUserId = session.user.id;

    // Upsert "Coding" category for for_devs prompts
    const codingCategory = await db.category.upsert({
      where: { slug: "coding" },
      update: {},
      create: {
        name: "Coding",
        slug: "coding",
        description: "Programming and development prompts",
        icon: "💻",
      },
    });

    // Cache for contributor users (username -> userId)
    const contributorCache = new Map<string, string>();

    // Helper to get or create contributor user
    async function getOrCreateContributorUser(username: string): Promise<string> {
      const normalizedUsername = username.toLowerCase().trim();
      
      // Check cache first
      if (contributorCache.has(normalizedUsername)) {
        return contributorCache.get(normalizedUsername)!;
      }

      // Check if user exists by username or pseudo email
      const pseudoEmail = `${normalizedUsername}@unclaimed.prompts.chat`;
      
      let user = await db.user.findFirst({
        where: {
          OR: [
            { username: normalizedUsername },
            { email: pseudoEmail },
          ],
        },
      });

      if (!user) {
        // Create pseudo user - they can claim this account later by logging in with GitHub
        user = await db.user.create({
          data: {
            username: normalizedUsername,
            email: pseudoEmail,
            name: normalizedUsername,
            role: "USER",
          },
        });
      }

      contributorCache.set(normalizedUsername, user.id);
      return user.id;
    }

    // Handle multiple contributors (comma-separated), return first as primary author
    async function getOrCreateContributor(contributorField: string): Promise<string> {
      if (!contributorField) return adminUserId;
      
      // Split by comma for multiple contributors
      const contributors = contributorField.split(',').map(c => c.trim()).filter(Boolean);
      
      if (contributors.length === 0) return adminUserId;
      
      // Create users for all contributors, return first as primary author
      for (const username of contributors) {
        await getOrCreateContributorUser(username);
      }
      
      return contributorCache.get(contributors[0].toLowerCase())!;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Check if prompt with same title already exists
        const existing = await db.prompt.findFirst({
          where: { title: row.act },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Get or create contributor user
        const authorId = await getOrCreateContributor(row.contributor);

        // Determine type and structured format
        const { type, structuredFormat } = mapCsvTypeToPromptType(row.type);
        
        // Determine category based on for_devs field
        const isForDevs = row.for_devs.toUpperCase() === "TRUE";
        const categoryId = isForDevs ? codingCategory.id : null;

        // Create the prompt
        const prompt = await db.prompt.create({
          data: {
            title: row.act,
            content: row.prompt,
            type,
            structuredFormat,
            isPrivate: false,
            authorId,
            categoryId,
          },
        });

        // Create initial version
        await db.promptVersion.create({
          data: {
            promptId: prompt.id,
            version: 1,
            content: row.prompt,
            changeNote: "Imported from prompts.csv",
            createdBy: authorId,
          },
        });

        imported++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Failed to import "${row.act}": ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      errors: errors.slice(0, 10), // Only return first 10 errors
    });
  } catch (error) {
    console.error("Error importing prompts:", error);
    return NextResponse.json(
      { error: "Failed to import prompts" },
      { status: 500 }
    );
  }
}

// Delete all community prompts (prompts imported from CSV)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read CSV to get the titles of community prompts
    const csvPath = path.join(process.cwd(), "prompts.csv");
    const csvContent = await fs.readFile(csvPath, "utf-8");
    const rows = parseCSV(csvContent);
    
    const titles = rows.map(row => row.act);
    
    // Delete all prompts that match the CSV titles
    const result = await db.prompt.deleteMany({
      where: {
        title: { in: titles },
      },
    });

    // Delete all unclaimed users (users with @unclaimed.prompts.chat emails)
    const deletedUsers = await db.user.deleteMany({
      where: {
        email: { endsWith: "@unclaimed.prompts.chat" },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      deletedUsers: deletedUsers.count,
    });
  } catch (error) {
    console.error("Error deleting community prompts:", error);
    return NextResponse.json(
      { error: "Failed to delete community prompts" },
      { status: 500 }
    );
  }
}
