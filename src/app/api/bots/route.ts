import { NextResponse } from "next/server";
import { BOT_PLATFORM_INFO, BOT_SORTS, botCategoryJson, botTagsJson, getBotUrls, listBots, platformFromParam, type BotSort } from "@/lib/bots";
import { getBaseUrl } from "@/lib/seo";
import { isTrending } from "@/lib/trending";

const MAX_BOTS = 500;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = platformFromParam(searchParams.get("platform") ?? undefined);
  const baseUrl = getBaseUrl();
  const sort = searchParams.get("sort");
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const { bots, total } = await listBots({
    platform,
    categorySlug: searchParams.get("category") ?? undefined,
    tagSlugs: searchParams.get("tag")?.split(",").map((slug) => slug.trim()).filter(Boolean),
    q: searchParams.get("q") ?? undefined,
    sort: BOT_SORTS.includes(sort as BotSort) ? (sort as BotSort) : undefined,
    take: Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_BOTS) : MAX_BOTS,
  });

  return NextResponse.json(
    {
      total,
      bots: bots.map((bot) => ({
        id: bot.id,
        slug: bot.slug,
        name: bot.title,
        description: bot.description,
        platforms: bot.platforms,
        platformNames: bot.platforms.map((platform) => BOT_PLATFORM_INFO[platform].name),
        icon: bot.icon,
        color: bot.color,
        installUrl: bot.installUrl,
        category: botCategoryJson(bot),
        tags: botTagsJson(bot),
        isTrending: isTrending(bot.trendingUntil),
        trendingUntil: bot.trendingUntil,
        author: bot.author.username,
        urls: getBotUrls(bot, baseUrl),
      })),
    },
    { headers: { "X-Robots-Tag": "noindex", "Access-Control-Allow-Origin": "*" } }
  );
}
