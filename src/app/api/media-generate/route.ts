import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getMediaGeneratorPlugin,
  getAvailableModels,
  isMediaGenerationAvailable,
} from "@/lib/plugins/media-generators";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const available = isMediaGenerationAvailable();
  const imageModels = getAvailableModels("image");
  const videoModels = getAvailableModels("video");
  const audioModels = getAvailableModels("audio");

  // Get user's credit info
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      generationCreditsRemaining: true,
      dailyGenerationLimit: true,
      flagged: true,
    },
  });

  return NextResponse.json({
    available,
    imageModels,
    videoModels,
    audioModels,
    credits: {
      remaining: user?.generationCreditsRemaining ?? 0,
      daily: user?.dailyGenerationLimit ?? 0,
    },
    canGenerate: !user?.flagged && (user?.generationCreditsRemaining ?? 0) > 0,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, model, provider, type, inputImageUrl, resolution, aspectRatio } = body;

    if (!prompt || !model || !provider || !type) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, model, provider, type" },
        { status: 400 }
      );
    }

    const plugin = getMediaGeneratorPlugin(provider);

    if (!plugin) {
      return NextResponse.json(
        { error: `Provider "${provider}" not found` },
        { status: 404 }
      );
    }

    if (!plugin.isEnabled()) {
      return NextResponse.json(
        { error: `Provider "${provider}" is not enabled` },
        { status: 400 }
      );
    }

    // Atomic conditional decrement: check credits, flagged status, and deduct
    // in a single SQL statement to prevent TOCTOU race conditions.
    const result = await db.user.updateMany({
      where: {
        id: session.user.id,
        flagged: false,
        generationCreditsRemaining: { gt: 0 },
      },
      data: {
        generationCreditsRemaining: { decrement: 1 },
      },
    });

    if (result.count === 0) {
      // Determine the specific reason for rejection
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { flagged: true, generationCreditsRemaining: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (user.flagged) {
        return NextResponse.json(
          { error: "Your account has been flagged. Media generation is disabled." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "No generation credits remaining. Credits reset daily." },
        { status: 403 }
      );
    }

    // Credit already deducted — now call the external provider
    let task;
    try {
      task = await plugin.startGeneration({
        prompt,
        model,
        type,
        inputImageUrl,
        resolution,
        aspectRatio,
      });
    } catch (generationError) {
      // Refund the credit on generation failure
      await db.user.update({
        where: { id: session.user.id },
        data: { generationCreditsRemaining: { increment: 1 } },
      });
      throw generationError;
    }

    return NextResponse.json({
      success: true,
      taskId: task.taskId,
      socketAccessToken: task.socketAccessToken,
      webSocketUrl: plugin.getWebSocketUrl(),
      provider,
    });
  } catch (error) {
    console.error("Media generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
