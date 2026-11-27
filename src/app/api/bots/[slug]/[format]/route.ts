import { NextResponse } from "next/server";
import { botToJson, botToMarkdown, botToSkill, extractBotId, getBotById } from "@/lib/bots";
import { botPairingsJson, getBotPairings } from "@/lib/bots/pairings";
import { checkPromptAccess } from "@/lib/prompt-access";
import { getBaseUrl } from "@/lib/seo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; format: string }> }
) {
  const { slug, format } = await params;
  if (format !== "md" && format !== "skill" && format !== "json") {
    return new NextResponse("Unknown format", { status: 404 });
  }

  const bot = await getBotById(extractBotId(slug));
  if (!bot) {
    return new NextResponse("Bot not found", { status: 404 });
  }
  const denied = await checkPromptAccess(bot);
  if (denied) return denied;

  const baseUrl = getBaseUrl();
  // Raw files duplicate the bot page, so keep them out of search results
  const headers = {
    "X-Robots-Tag": "noindex",
    ...(!bot.isPrivate && { "Access-Control-Allow-Origin": "*" }),
  };

  if (format === "json") {
    const betterTogetherWith = botPairingsJson(await getBotPairings(bot.id), baseUrl);
    return NextResponse.json({ ...botToJson(bot, baseUrl), betterTogetherWith }, { headers });
  }

  const output = format === "skill" ? botToSkill(bot, baseUrl) : botToMarkdown(bot, baseUrl);
  return new NextResponse(output, {
    headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
  });
}
