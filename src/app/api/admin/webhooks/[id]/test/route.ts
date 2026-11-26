import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPrivateUrl } from "@/lib/webhook";
import { getWebhookSiteUrl } from "@/lib/app-url";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the webhook configuration
    const webhook = await db.webhookConfig.findUnique({
      where: { id },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Replace placeholders with test values (must match WEBHOOK_PLACEHOLDERS)
    let payload = webhook.payload;
    const siteUrl = getWebhookSiteUrl();
    const testData: Record<string, string> = {
      "{{PROMPT_ID}}": "test-prompt-id-12345",
      "{{PROMPT_TITLE}}": "Test Prompt Title",
      "{{PROMPT_DESCRIPTION}}": "This is a test description for the webhook.",
      "{{PROMPT_CONTENT}}": "This is the test prompt content. It demonstrates how your webhook will receive data when a new prompt is created.",
      "{{PROMPT_TYPE}}": "TEXT",
      "{{PROMPT_URL}}": `${siteUrl}/prompts/test-prompt-id-12345`,
      "{{PROMPT_MEDIA_URL}}": "https://example.com/media/test-image.png",
      "{{AUTHOR_USERNAME}}": "testuser",
      "{{AUTHOR_NAME}}": "Test User",
      "{{AUTHOR_AVATAR}}": "https://avatars.githubusercontent.com/u/1234567",
      "{{CATEGORY_NAME}}": "Development",
      "{{TAGS}}": "testing, webhook, automation",
      "{{TIMESTAMP}}": new Date().toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      "{{SITE_URL}}": siteUrl,
      "{{CHATGPT_URL}}": `https://chat.openai.com/?prompt=${encodeURIComponent("This is the test prompt content. It demonstrates how your webhook will receive data when a new prompt is created.")}`,
    };

    for (const [placeholder, value] of Object.entries(testData)) {
      payload = payload.replaceAll(placeholder, value);
    }

    // Parse the payload as JSON
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // A10: Validate webhook URL is not targeting private/internal networks
    if (isPrivateUrl(webhook.url)) {
      return NextResponse.json(
        { error: "Webhook URL targets a private/internal network which is not allowed" },
        { status: 400 }
      );
    }

    // Send the test request
    const response = await fetch(webhook.url, {
      method: webhook.method,
      headers: {
        "Content-Type": "application/json",
        ...(webhook.headers as Record<string, string> | null),
      },
      body: webhook.method !== "GET" ? JSON.stringify(parsedPayload) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Webhook returned ${response.status}: ${text}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Test webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to test webhook" },
      { status: 500 }
    );
  }
}
