import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock, Flame, RefreshCw, Star, Users } from "lucide-react";
import { db } from "@/lib/db";
import { NON_BOT_PROMPTS, trendingPromptListWhere } from "@/lib/prompt-list";
import { Button } from "@/components/ui/button";
import { Masonry } from "@/components/ui/masonry";
import { PromptCard } from "@/components/prompts/prompt-card";
import { TrendingBadge } from "@/components/prompts/trending-badge";
import { LatestBots } from "@/components/bots/latest-bots";

interface DiscoveryPromptsProps {
  isHomepage?: boolean;
}

export async function DiscoveryPrompts({ isHomepage = false }: DiscoveryPromptsProps) {
  const t = await getTranslations("feed");
  const tDiscovery = await getTranslations("discovery");

  const limit = isHomepage ? 9 : 15;

  const promptInclude = {
    author: {
      select: { id: true, name: true, username: true, avatar: true, verified: true },
    },
    category: {
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    },
    tags: {
      include: { tag: true },
    },
    contributors: {
      select: { id: true, username: true, name: true, avatar: true },
    },
    _count: {
      select: {
        votes: true,
        contributors: true,
        outgoingConnections: { where: { label: { not: "related" } } },
        incomingConnections: { where: { label: { not: "related" } } },
      },
    },
  };

  // Get today's date at midnight for filtering today's votes
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [trendingPromptsRaw, featuredPromptsRaw, todaysMostUpvotedRaw, latestPromptsRaw, recentlyUpdatedRaw, mostContributedRaw] = await Promise.all([
    isHomepage
      ? db.prompt.findMany({
          where: trendingPromptListWhere(),
          orderBy: [{ trendingUntil: "desc" }, { createdAt: "desc" }],
          take: limit,
          include: promptInclude,
        })
      : Promise.resolve([]),
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
        ...NON_BOT_PROMPTS,
        isFeatured: true,
      },
      orderBy: { featuredAt: "desc" },
      take: limit,
      include: promptInclude,
    }),
    // Today's most upvoted - prompts with votes from today, ordered by vote count
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
        ...NON_BOT_PROMPTS,
        votes: {
          some: {
            createdAt: {
              gte: today,
            },
          },
        },
      },
      orderBy: {
        votes: {
          _count: "desc",
        },
      },
      take: limit,
      include: promptInclude,
    }),
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
        ...NON_BOT_PROMPTS,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: promptInclude,
    }),
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
        ...NON_BOT_PROMPTS,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: promptInclude,
    }),
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
        ...NON_BOT_PROMPTS,
      },
      orderBy: {
        contributors: {
          _count: "desc",
        },
      },
      take: limit,
      include: promptInclude,
    }),
  ]);

  const mapPrompt = (p: typeof featuredPromptsRaw[0]) => ({
    ...p,
    voteCount: p._count?.votes ?? 0,
    contributorCount: p._count?.contributors ?? 0,
    contributors: p.contributors,
  });

  const trendingPrompts = trendingPromptsRaw.map(mapPrompt);
  const featuredPrompts = featuredPromptsRaw.map(mapPrompt);
  const todaysMostUpvoted = todaysMostUpvotedRaw.map(mapPrompt);
  const latestPrompts = latestPromptsRaw.map(mapPrompt);
  const recentlyUpdated = recentlyUpdatedRaw.map(mapPrompt);
  const mostContributed = mostContributedRaw.map(mapPrompt);

  return (
    <div className={isHomepage ? "flex flex-col" : "container py-6"}>
      {trendingPrompts.length > 0 && (
        <section className="py-12 border-b" aria-labelledby="trending-prompts-heading">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h2 id="trending-prompts-heading" className="text-xl font-semibold">{tDiscovery("trending")}</h2>
                <TrendingBadge />
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts?trending=1" prefetch={false}>
                  {tDiscovery("seeAll")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Masonry columnCount={{ default: 1, md: 2, lg: 3 }} gap={16}>
              {trendingPrompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </Masonry>
          </div>
        </section>
      )}

      {/* Featured Prompts Section */}
      {featuredPrompts.length > 0 && (
        <section className={isHomepage ? "py-12 border-b" : "pb-8 mb-8 border-b"}>
          <div className={isHomepage ? "container" : ""}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <h2 className="text-xl font-semibold">{tDiscovery("featuredPrompts")}</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts" prefetch={false}>
                  {t("browseAll")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Masonry columnCount={{ default: 1, md: 2, lg: 3 }} gap={16}>
              {featuredPrompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </Masonry>
          </div>
        </section>
      )}

      {isHomepage && <LatestBots />}

      {/* Today's Most Upvoted Section */}
      {todaysMostUpvoted.length > 0 && (
        <section className={isHomepage ? "py-12 border-b" : "pb-8 mb-8 border-b"}>
          <div className={isHomepage ? "container" : ""}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <h2 className="text-xl font-semibold">{tDiscovery("todaysMostUpvoted")}</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts" prefetch={false}>
                  {t("browseAll")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Masonry columnCount={{ default: 1, md: 2, lg: 3 }} gap={16}>
              {todaysMostUpvoted.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </Masonry>
          </div>
        </section>
      )}

      {/* Latest Prompts Section */}
      {latestPrompts.length > 0 && (
        <section className={isHomepage ? "py-12 border-b" : "pb-8 mb-8 border-b"}>
          <div className={isHomepage ? "container" : ""}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">{tDiscovery("latestPrompts")}</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts" prefetch={false}>
                  {t("browseAll")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Masonry columnCount={{ default: 1, md: 2, lg: 3 }} gap={16}>
              {latestPrompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </Masonry>
          </div>
        </section>
      )}

      {/* Recently Updated Section */}
      {recentlyUpdated.length > 0 && (
        <section className={isHomepage ? "py-12 border-b" : "pb-8 mb-8 border-b"}>
          <div className={isHomepage ? "container" : ""}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">{tDiscovery("recentlyUpdated")}</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts" prefetch={false}>
                  {t("browseAll")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Masonry columnCount={{ default: 1, md: 2, lg: 3 }} gap={16}>
              {recentlyUpdated.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </Masonry>
          </div>
        </section>
      )}

      {/* Most Contributed Section */}
      {mostContributed.length > 0 && (
        <section className={isHomepage ? "py-12 border-b" : "pb-8"}>
          <div className={isHomepage ? "container" : ""}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <h2 className="text-xl font-semibold">{tDiscovery("mostContributed")}</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts" prefetch={false}>
                  {t("browseAll")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Masonry columnCount={{ default: 1, md: 2, lg: 3 }} gap={16}>
              {mostContributed.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </Masonry>
          </div>
        </section>
      )}
    </div>
  );
}
