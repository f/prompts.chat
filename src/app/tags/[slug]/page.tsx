import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Bot, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { countBots } from "@/lib/bots";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import { auth } from "@/lib/auth";
import config from "@/../prompts.config";
import { Button } from "@/components/ui/button";
import { PromptCard } from "@/components/prompts/prompt-card";
import { McpServerPopup } from "@/components/mcp/mcp-server-popup";
import { JsonLd, breadcrumbSchema, collectionPageSchema } from "@/components/seo/structured-data";
import { buildPageMetadata, NOINDEX_ROBOTS, paginatedPath } from "@/lib/seo";
import { isPageOutOfRange, parsePageParam, TAG_PROMPTS_PER_PAGE, tagPromptsWhere } from "@/lib/listing-pagination";
import { getPromptUrl } from "@/lib/urls";

// Tags with fewer public prompts than this are too thin to be indexed
const MIN_INDEXABLE_PROMPTS = 3;

interface TagPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const tag = await db.tag.findUnique({
    where: { slug },
    select: {
      name: true,
      _count: {
        select: {
          prompts: { where: { prompt: { isPrivate: false, isUnlisted: false, deletedAt: null, ...NON_BOT_PROMPTS } } },
        },
      },
    },
  });

  if (!tag) {
    return { title: "Tag Not Found", robots: NOINDEX_ROBOTS };
  }

  const t = await getTranslations("seo");
  const title = t("tag.title", { name: tag.name });

  return buildPageMetadata({
    title: page > 1 ? `${title} - ${t("page", { page })}` : title,
    description: t("tag.description", { name: tag.name, count: tag._count.prompts }),
    path: paginatedPath(`/tags/${slug}`, page),
    noindex: tag._count.prompts < MIN_INDEXABLE_PROMPTS,
  });
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const session = await auth();
  const t = await getTranslations("tags");
  const tPrompts = await getTranslations("prompts");
  const tSeo = await getTranslations("seo");
  const tBots = await getTranslations("bots");

  const tag = await db.tag.findUnique({
    where: { slug },
  });

  if (!tag) {
    notFound();
  }

  const page = parsePageParam(pageParam);
  const perPage = TAG_PROMPTS_PER_PAGE;
  const where = tagPromptsWhere(tag.id, session?.user?.id);

  // Fetch prompts with this tag; bots are listed on /bots
  const [promptsRaw, total, botCount] = await Promise.all([
    db.prompt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            verified: true,
          },
        },
        category: {
          include: {
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            votes: true,
            contributors: true,
            outgoingConnections: { where: { label: { not: "related" } } },
            incomingConnections: { where: { label: { not: "related" } } },
          },
        },
      },
    }),
    db.prompt.count({ where }),
    countBots({ tagSlugs: [tag.slug] }),
  ]);

  const prompts = promptsRaw.map((p) => ({
    ...p,
    voteCount: p._count.votes,
    contributorCount: p._count.contributors,
  }));

  const totalPages = Math.ceil(total / perPage);

  // Pages past the end would be empty duplicates of the listing. The layout
  // already rejects them on full page loads; this covers client navigation.
  if (isPageOutOfRange(page, total, perPage)) {
    notFound();
  }

  const tagPath = `/tags/${tag.slug}`;

  return (
    <div className="container py-6">
      <JsonLd
        data={[
          collectionPageSchema({
            name: tSeo("tag.heading", { name: tag.name }),
            description: tSeo("tag.description", { name: tag.name, count: total }),
            path: paginatedPath(tagPath, page),
            items: prompts.map((prompt) => ({ name: prompt.title, path: getPromptUrl(prompt.id, prompt.slug) })),
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Tags", path: "/tags" },
            { name: tag.name, path: tagPath },
          ]),
        ]}
      />
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/tags">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t("allTags")}
          </Link>
        </Button>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <h1 className="text-xl font-semibold">{tSeo("tag.heading", { name: tag.name })}</h1>
            <span className="text-sm text-muted-foreground">
              {total} {t("prompts")}
            </span>
            {botCount > 0 && (
              <Link href={`/bots?tag=${tag.slug}`} prefetch={false} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
                <Bot className="h-3.5 w-3.5" />
                {tBots("count", { count: botCount })}
              </Link>
            )}
          </div>
          {config.features.mcp !== false && <McpServerPopup initialTags={[slug]} showOfficialBranding={!config.homepage?.useCloneBranding} />}
        </div>
      </div>

      {/* Prompts Grid */}
      {prompts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {tPrompts("noPrompts")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
            {prompts.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page <= 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <Link href={paginatedPath(`/tags/${slug}`, page - 1)}>
                    {tPrompts("previous")}
                  </Link>
                ) : (
                  <span>{tPrompts("previous")}</span>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page >= totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <Link href={`/tags/${slug}?page=${page + 1}`}>
                    {tPrompts("next")}
                  </Link>
                ) : (
                  <span>{tPrompts("next")}</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
