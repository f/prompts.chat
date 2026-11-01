import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button"
import { InfinitePromptList } from "@/components/prompts/infinite-prompt-list";
import { PromptFilters } from "@/components/prompts/prompt-filters";
import { FilterProvider } from "@/components/prompts/filter-context";
import { PinnedCategories } from "@/components/categories/pinned-categories";
import { HFDataStudioDropdown } from "@/components/prompts/hf-data-studio-dropdown";
import { McpServerPopup } from "@/components/mcp/mcp-server-popup";
import { db } from "@/lib/db";
import { isAISearchEnabled, semanticSearch } from "@/lib/ai/embeddings";
import { isAIGenerationEnabled } from "@/lib/ai/generation";
import { buildPageMetadata } from "@/lib/seo";
import { promptListTypeWhere } from "@/lib/prompt-list";
import { trendingWhere } from "@/lib/trending";
import config from "@/../prompts.config";

export const revalidate = 60;

// Query for categories (cached)
const getCategories = unstable_cache(
  async () => {
    return db.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });
  },
  ["categories"],
  { tags: ["categories"] }
);

// Query for pinned categories (cached)
const getPinnedCategories = unstable_cache(
  async () => {
    return db.category.findMany({
      where: { pinned: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
      },
    });
  },
  ["pinned-categories"],
  { tags: ["categories"] }
);

// Query for tags (cached)
const getTags = unstable_cache(
  async () => {
    return db.tag.findMany({
      orderBy: { name: "asc" },
    });
  },
  ["tags"],
  { tags: ["tags"] }
);

// Query for prompts list (cached)
function getCachedPrompts(
  where: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderBy: any,
  perPage: number
) {
  // Create a stable cache key from the query parameters
  const cacheKey = JSON.stringify({ where, orderBy, perPage });
  
  return unstable_cache(
    async () => {
      const [promptsRaw, totalCount] = await Promise.all([
        db.prompt.findMany({
          where,
          orderBy,
          skip: 0,
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
            contributors: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
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
            userExamples: {
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                mediaUrl: true,
                user: {
                  select: {
                    username: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        }),
        db.prompt.count({ where }),
      ]);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prompts: promptsRaw.map((p: any) => ({
          ...p,
          voteCount: p._count.votes,
          contributorCount: p._count.contributors,
          contributors: p.contributors,
        })),
        total: totalCount,
      };
    },
    ["prompts", cacheKey],
    { tags: ["prompts"] }
  )();
}

interface PromptsPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    category?: string;
    tag?: string;
    sort?: string;
    page?: string;
    ai?: string;
    trending?: string;
  }>;
}

/**
 * Finds the filtered category by slug, or by ID for links created before
 * category filters used slugs
 */
function findCategory(categories: Awaited<ReturnType<typeof getCategories>>, param?: string) {
  if (!param) return undefined;
  return categories.find((c) => c.slug === param) ?? categories.find((c) => c.id === param);
}

export async function generateMetadata({ searchParams }: PromptsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("seo");
  const filters = [params.q, params.type, params.category, params.tag, params.trending].filter(Boolean);

  // A single category or tag filter shows the same prompts as its own landing page
  if (filters.length === 1 && params.category) {
    const category = findCategory(await getCategories(), params.category);
    if (category) {
      return buildPageMetadata({
        title: t("category.title", { name: category.name }),
        description: t("prompts.description"),
        path: `/categories/${category.slug}`,
      });
    }
  }
  if (filters.length === 1 && params.tag && !params.tag.includes(",")) {
    const tag = (await getTags()).find((tag) => tag.slug === params.tag);
    if (tag) {
      return buildPageMetadata({
        title: t("tag.title", { name: tag.name }),
        description: t("prompts.description"),
        path: `/tags/${tag.slug}`,
      });
    }
  }

  // Search results, trending and other filter views stay out of the index but
  // point their canonical at /prompts; sorting alone doesn't change the content
  return buildPageMetadata({
    title: params.q ? t("prompts.searchTitle", { query: params.q }) : t("prompts.title"),
    description: t("prompts.description"),
    path: "/prompts",
    canonical: "/prompts",
    noindex: filters.length > 0 || !!params.ai,
  });
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const t = await getTranslations("prompts");
  const tSearch = await getTranslations("search");
  const params = await searchParams;

  // Fetch categories, pinned categories, and tags for filter
  const [categories, pinnedCategories, tags] = await Promise.all([
    getCategories(),
    getPinnedCategories(),
    getTags(),
  ]);

  // Legacy ID-based category filters are redirected to slugs in layout.tsx
  const activeCategory = findCategory(categories, params.category);

  const perPage = 24;
  const aiSearchAvailable = await isAISearchEnabled();
  const aiGenerationAvailable = await isAIGenerationEnabled();
  const useAISearch = aiSearchAvailable && params.ai === "1" && params.q;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prompts: any[] = [];
  let total = 0;

  if (useAISearch && params.q) {
    // Use AI semantic search - combine keywords into a single search query
    try {
      // Join comma-separated keywords with spaces for a single semantic search
      const searchQuery = params.q.split(",").map(k => k.trim()).filter(Boolean).join(" ");
      const aiResults = await semanticSearch(searchQuery, perPage);
      
      prompts = aiResults.map((p) => ({
        ...p,
        contributorCount: 0,
      }));
      total = prompts.length;
    } catch {
      // Fallback to regular search on error
    }
  }
  
  // Regular search if AI search not used or failed
  if (!useAISearch || prompts.length === 0) {
    // Build where clause based on filters
    const where: Record<string, unknown> = {
      isPrivate: false,
      isUnlisted: false, // Exclude unlisted prompts
      deletedAt: null, // Exclude soft-deleted prompts
      // Exclude intermediate flow prompts (only show first prompts or standalone)
      // Note: "related" connections are AI-suggested similar prompts, not flow connections
      incomingConnections: { none: { label: { not: "related" } } },
    };
    
    if (params.q) {
      // Handle comma-separated keywords
      const keywords = params.q.split(",").map(k => k.trim()).filter(Boolean);
      if (keywords.length > 1) {
        // Multiple keywords - match any of them
        where.OR = keywords.flatMap(keyword => [
          { title: { contains: keyword, mode: "insensitive" } },
          { content: { contains: keyword, mode: "insensitive" } },
          { description: { contains: keyword, mode: "insensitive" } },
        ]);
      } else {
        // Single keyword
        where.OR = [
          { title: { contains: params.q, mode: "insensitive" } },
          { content: { contains: params.q, mode: "insensitive" } },
          { description: { contains: params.q, mode: "insensitive" } },
        ];
      }
    }
    
    Object.assign(where, promptListTypeWhere(params.type));

    if (params.trending === "1") {
      Object.assign(where, trendingWhere());
    }
    
    if (params.category) {
      where.categoryId = activeCategory?.id ?? params.category;
    }
    
    // Handle tag parameter (can be comma-separated for multiple tags)
    if (params.tag) {
      // Handle multiple tags (comma-separated)
      const tagSlugs = params.tag.split(",").map(t => t.trim()).filter(Boolean);
      if (tagSlugs.length > 0) {
        where.AND = tagSlugs.map(slug => ({
          tags: {
            some: {
              tag: {
                slug,
              },
            },
          },
        }));
      }
    }
    
    // Build order by clause
    const isUpvoteSort = params.sort === "upvotes";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: "desc" };
    if (params.sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (isUpvoteSort) {
      // Sort by vote count descending
      orderBy = { votes: { _count: "desc" } };
    }

    // Fetch initial prompts (first page) - cached
    const result = await getCachedPrompts(where, orderBy, perPage);
    prompts = result.prompts;
    total = result.total;
  }

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <span className="text-xs text-muted-foreground">{tSearch("found", { count: total })}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!config.homepage?.useCloneBranding && (
            <div className="flex items-center gap-2">
              <HFDataStudioDropdown aiGenerationEnabled={aiGenerationAvailable} />
              {config.features.mcp !== false && <McpServerPopup showOfficialBranding />}
            </div>
          )}
          <Button size="sm" className="h-8 text-xs w-full sm:w-auto" asChild>
            <Link href="/prompts/new">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("create")}
            </Link>
          </Button>
        </div>
      </div>
      
      <FilterProvider>
        <Suspense fallback={null}>
          <div className="mb-4">
            <PinnedCategories 
              categories={pinnedCategories} 
              currentCategorySlug={activeCategory?.slug} 
            />
          </div>
        </Suspense>
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <PromptFilters
              categories={categories}
              tags={tags}
              currentFilters={params}
              aiSearchEnabled={aiSearchAvailable}
              showTrendingFilter
            />
          </aside>
          <main className="flex-1 min-w-0">
            <InfinitePromptList
              initialPrompts={prompts}
              initialTotal={total}
              filters={{
                q: params.q,
                type: params.type,
                category: activeCategory?.id ?? params.category,
                categorySlug: activeCategory?.slug,
                tag: params.tag,
                sort: params.sort,
                trending: params.trending === "1" ? "1" : undefined,
              }}
            />
          </main>
        </div>
      </FilterProvider>
    </div>
  );
}
