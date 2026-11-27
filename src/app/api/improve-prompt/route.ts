import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { improvePrompt } from "@/lib/ai/improve-prompt";
import { db } from "@/lib/db";
import { isValidApiKeyFormat } from "@/lib/api-key";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/config";

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000, "Prompt too long"),
  outputFormat: z.enum(["text", "structured_json", "structured_yaml"]).default("text"),
  outputType: z.enum(["text", "image", "video", "sound"]).default("text"),
});

async function authenticateRequest(request: NextRequest) {
  // First check session auth
  const session = await auth();
  if (session?.user?.id) {
    return { id: session.user.id, username: session.user.name || "user" };
  }

  // Fall back to API key auth
  const apiKey = request.headers.get("x-api-key") || 
                 request.headers.get("authorization")?.replace("Bearer ", "") ||
                 request.headers.get("prompts-api-key");

  if (!apiKey || !isValidApiKeyFormat(apiKey)) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { apiKey },
    select: { id: true, username: true },
  });

  return user;
}

export async function POST(request: NextRequest) {
  const config = await getConfig();
  if (config.features.promptEnhancer === false) {
    return NextResponse.json({ error: "Prompt enhancer is not enabled" }, { status: 404 });
  }

  try {
    // Authenticate request (session or API key)
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in or provide a valid API key." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { prompt, outputFormat, outputType } = validation.data;

    const result = await improvePrompt({ prompt, outputFormat, outputType });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error improving prompt:", error);

    if (error instanceof Error) {
      // Handle rate limiting
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "An error occurred while improving the prompt" },
      { status: 500 }
    );
  }
}
