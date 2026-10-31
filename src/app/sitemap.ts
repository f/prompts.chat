import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import { getAllChapters } from "@/lib/book/chapters";
import { getBotTeamUrl, getBotUrl, getPromptUrl } from "@/lib/urls";
import { getBaseUrl, toSitemapImageUrl } from "@/lib/seo";

// Revalidate every 5 minutes so new prompts reach crawlers quickly
export const revalidate = 300;

// A single sitemap file may hold at most 50,000 URLs. Split this file with
// `generateSitemaps` once the number of public prompts gets close to the cap.
// Bots count against this budget too, and are listed before other prompts.
const MAX_PROMPTS = 45000;

// Listing pages with fewer prompts than this are thin and left out of the sitemap
// (they stay reachable through internal links)
const MIN_LISTING_PROMPTS = 3;

const visiblePromptFilter = {
  isPrivate: false,
  isUnlisted: false,
  deletedAt: null,
};

// Prompt listings (/prompts, categories, tags) leave bots to /bots
const listedPromptFilter = { ...visiblePromptFilter, ...NON_BOT_PROMPTS };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  // Static pages - always included. Their lastModified is only set when it can be
  // derived from real content changes, because Google ignores inaccurate dates.
  const staticPaths = [
    "",
    "/bots",
    "/bots/teams",
    "/prompts",
    "/discover",
    "/categories",
    "/tags",
    "/skills",
    "/workflows",
    "/taste",
    "/promptmasters",
    "/book",
    "/how-to-write-effective-prompts",
    "/kids",
    "/developers",
    "/about",
    "/support",
    "/docs/api",
    "/docs/self-hosting",
  ];

  // Book chapter pages
  const chapters = getAllChapters();
  const bookPages: MetadataRoute.Sitemap = chapters.map((chapter) => ({
    url: `${baseUrl}/book/${chapter.slug}`,
  }));

  // Dynamic pages - skip if database is unavailable (e.g., during build)
  try {
    const [latestPrompt, categories, categoryUpdates, prompts, bots, tags, authors, teams] = await Promise.all([
      db.prompt.findFirst({
        where: listedPromptFilter,
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      db.category.findMany({ select: { id: true, slug: true } }),
      db.prompt.groupBy({
        by: ["categoryId"],
        where: { ...listedPromptFilter, categoryId: { not: null } },
        _count: true,
        _max: { updatedAt: true },
      }),
      db.prompt.findMany({
        where: listedPromptFilter,
        select: { id: true, slug: true, type: true, mediaUrl: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_PROMPTS,
      }),
      db.prompt.findMany({
        where: { ...visiblePromptFilter, type: "BOT" },
        select: { id: true, slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_PROMPTS,
      }),
      db.tag.findMany({
        select: {
          slug: true,
          prompts: {
            where: { prompt: listedPromptFilter },
            select: { prompt: { select: { updatedAt: true } } },
          },
        },
      }),
      db.prompt.groupBy({
        by: ["authorId"],
        where: visiblePromptFilter,
        _count: true,
        _max: { updatedAt: true },
        having: { authorId: { _count: { gte: MIN_LISTING_PROMPTS } } },
      }),
      db.botTeam.findMany({
        where: { members: { some: { bot: { ...visiblePromptFilter, type: "BOT" } } } },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_PROMPTS,
      }),
    ]);

    const authorUsers = await db.user.findMany({
      where: { id: { in: authors.map((a) => a.authorId) } },
      select: { id: true, username: true },
    });

    const latestUpdate = latestPrompt?.updatedAt;
    const listingPaths = new Set(["", "/prompts", "/discover", "/skills", "/workflows", "/taste"]);
    const staticPages: MetadataRoute.Sitemap = staticPaths.map((path) => ({
      url: `${baseUrl}${path}`,
      ...(latestUpdate && listingPaths.has(path) && { lastModified: latestUpdate }),
      ...(path === "/bots" && bots[0] && { lastModified: bots[0].updatedAt }),
      ...(path === "/bots/teams" && teams[0] && { lastModified: teams[0].updatedAt }),
    }));

    const categoryStats = new Map(categoryUpdates.map((c) => [c.categoryId, c]));
    const categoryPages: MetadataRoute.Sitemap = categories
      .filter((category) => (categoryStats.get(category.id)?._count ?? 0) >= MIN_LISTING_PROMPTS)
      .map((category) => ({
        url: `${baseUrl}/categories/${category.slug}`,
        lastModified: categoryStats.get(category.id)?._max.updatedAt ?? undefined,
      }));

    const botPages: MetadataRoute.Sitemap = bots.map((bot) => ({
      url: `${baseUrl}${getBotUrl(bot.id, bot.slug)}`,
      lastModified: bot.updatedAt,
    }));

    const teamPages: MetadataRoute.Sitemap = teams.map((team) => ({
      url: `${baseUrl}${getBotTeamUrl(team.slug)}`,
      lastModified: team.updatedAt,
    }));

    const promptPages: MetadataRoute.Sitemap = prompts.slice(0, Math.max(0, MAX_PROMPTS - bots.length - teams.length)).map((prompt) => {
      const image = prompt.type === "IMAGE" && prompt.mediaUrl ? toSitemapImageUrl(prompt.mediaUrl) : null;
      return {
        url: `${baseUrl}${getPromptUrl(prompt.id, prompt.slug)}`,
        lastModified: prompt.updatedAt,
        ...(image && { images: [image] }),
      };
    });

    const tagPages: MetadataRoute.Sitemap = tags
      .filter((tag) => tag.prompts.length >= MIN_LISTING_PROMPTS)
      .map((tag) => ({
        url: `${baseUrl}/tags/${tag.slug}`,
        lastModified: new Date(Math.max(...tag.prompts.map(({ prompt }) => prompt.updatedAt.getTime()))),
      }));

    const authorUpdates = new Map(authors.map((a) => [a.authorId, a._max.updatedAt]));
    const profilePages: MetadataRoute.Sitemap = authorUsers.map((user) => ({
      url: `${baseUrl}/@${user.username}`,
      lastModified: authorUpdates.get(user.id) ?? undefined,
    }));

    return [...staticPages, ...bookPages, ...categoryPages, ...tagPages, ...botPages, ...teamPages, ...promptPages, ...profilePages];
  } catch {
    // Database unavailable (build time) - return static and book pages only
    const staticPages: MetadataRoute.Sitemap = staticPaths.map((path) => ({ url: `${baseUrl}${path}` }));
    return [...staticPages, ...bookPages];
  }
}
