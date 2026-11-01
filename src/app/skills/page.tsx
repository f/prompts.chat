import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { unstable_cache } from "next/cache";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfinitePromptList } from "@/components/prompts/infinite-prompt-list";
import { HFDataStudioDropdown } from "@/components/prompts/hf-data-studio-dropdown";
import { McpServerPopup } from "@/components/mcp/mcp-server-popup";
import { db } from "@/lib/db";
import { buildPageMetadata } from "@/lib/seo";
import { isAIGenerationEnabled } from "@/lib/ai/generation";
import config from "@/../prompts.config";


// Query for skills list (cached)
function getCachedSkills(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderBy: any,
  perPage: number,
  searchQuery?: string
) {
  const cacheKey = JSON.stringify({ orderBy, perPage, searchQuery });
  
  return unstable_cache(
    async () => {
      const where: Record<string, unknown> = {
        type: "SKILL",
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
      };

      if (searchQuery) {
        where.OR = [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { content: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const [skillsRaw, totalCount] = await Promise.all([
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
          },
        }),
        db.prompt.count({ where }),
      ]);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        skills: skillsRaw.map((p: any) => ({
          ...p,
          voteCount: p._count.votes,
          contributorCount: p._count.contributors,
          contributors: p.contributors,
        })),
        total: totalCount,
      };
    },
    ["skills", cacheKey],
    { tags: ["prompts"] }
  )();
}

interface SkillsPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SkillsPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const t = await getTranslations("seo.skills");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/skills",
    // Search results aren't indexed; sorted views share the main canonical
    noindex: !!q,
  });
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const t = await getTranslations("prompts");
  const tSeo = await getTranslations("seo.skills");
  const tSearch = await getTranslations("search");
  const params = await searchParams;
  
  const perPage = 24;

  // Build order by clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = { createdAt: "desc" };
  if (params.sort === "oldest") {
    orderBy = { createdAt: "asc" };
  } else if (params.sort === "upvotes") {
    orderBy = { votes: { _count: "desc" } };
  }

  const [result, aiGenerationAvailable] = await Promise.all([
    getCachedSkills(orderBy, perPage, params.q),
    isAIGenerationEnabled(),
  ]);
  const skills = result.skills;
  const total = result.total;

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">{tSeo("heading")}</h1>
          <span className="text-xs text-muted-foreground">{tSearch("found", { count: total })}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!config.homepage?.useCloneBranding && (
            <div className="flex items-center gap-2">
              <HFDataStudioDropdown aiGenerationEnabled={aiGenerationAvailable} listing="skills" />
              {config.features.mcp !== false && <McpServerPopup showOfficialBranding resource="skills" />}
            </div>
          )}
          <Button size="sm" className="h-8 text-xs w-full sm:w-auto" asChild>
            <Link href="/prompts/new?type=SKILL">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("createSkill")}
            </Link>
          </Button>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground mb-6">
        {t("skillsDescription")}
      </p>

      <InfinitePromptList
        initialPrompts={skills}
        initialTotal={total}
        filters={{
          q: params.q,
          type: "SKILL",
          sort: params.sort,
        }}
      />
    </div>
  );
}
