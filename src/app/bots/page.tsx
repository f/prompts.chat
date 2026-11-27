import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotCard } from "@/components/bots/bot-card";
import { BotFilters } from "@/components/bots/bot-filters";
import { ListingWidgetCard } from "@/components/widgets/listing-widget-card";
import { HFDataStudioDropdown } from "@/components/prompts/hf-data-studio-dropdown";
import { McpServerPopup } from "@/components/mcp/mcp-server-popup";
import { JsonLd, collectionPageSchema } from "@/components/seo/structured-data";
import { BOT_SORTS, getBotFilterOptions, listBots, platformFromParam, type BotSort } from "@/lib/bots";
import { injectWidgets, isWidget } from "@/lib/plugins/widgets";
import { buildPageMetadata } from "@/lib/seo";
import { isAIGenerationEnabled } from "@/lib/ai/generation";
import { getBotUrl } from "@/lib/urls";
import config from "@/../prompts.config";

const PER_PAGE = 24;

type BotsSearchParams = {
  q?: string;
  platform?: string;
  category?: string;
  tag?: string;
  sort?: string;
  page?: string;
};

interface BotsPageProps {
  searchParams: Promise<BotsSearchParams>;
}

const FILTER_KEYS = ["q", "platform", "category", "tag", "sort"] as const;

export async function generateMetadata({ searchParams }: BotsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("seo.bots");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/bots",
    // Filtered, sorted and paginated views share the main canonical
    noindex: FILTER_KEYS.some((key) => !!params[key]) || !!params.page,
    image: "route",
  });
}

function pageHref(params: BotsSearchParams, page: number) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (params[key]) query.set(key, params[key]);
  }
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/bots?${search}` : "/bots";
}

export default async function BotsPage({ searchParams }: BotsPageProps) {
  const t = await getTranslations("bots");
  const tSeo = await getTranslations("seo.bots");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort = BOT_SORTS.includes(params.sort as BotSort) ? (params.sort as BotSort) : "newest";

  const [{ bots, total }, filterOptions, aiGenerationAvailable] = await Promise.all([
    listBots({
      platform: platformFromParam(params.platform),
      categorySlug: params.category,
      tagSlugs: params.tag?.split(",").map((slug) => slug.trim()).filter(Boolean),
      q: params.q,
      sort,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    getBotFilterOptions(),
    isAIGenerationEnabled(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Pages past the end would be empty duplicates of the listing
  if (page > totalPages) {
    notFound();
  }

  const offset = (page - 1) * PER_PAGE;
  const gridItems = injectWidgets(
    bots.map((bot, index) => ({ bot, position: offset + index + 1 })),
    {
      placement: "bots",
      filters: { q: params.q, category: params.category, categorySlug: params.category, tag: params.tag, sort: params.sort, platform: params.platform },
      page,
      offset,
    },
    { totalItems: total }
  );

  return (
    <div className="container py-6">
      <JsonLd
        data={collectionPageSchema({
          name: tSeo("heading"),
          description: tSeo("description"),
          path: pageHref(params, page),
          items: bots.map((bot) => ({ name: bot.title, path: getBotUrl(bot.id, bot.slug) })),
        })}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-lg font-semibold">{tSeo("heading")}</h1>
          <span className="text-xs text-muted-foreground">{t("count", { count: total })}</span>
        </div>
        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {!config.homepage?.useCloneBranding && (
            <div className="flex items-center gap-2">
              <HFDataStudioDropdown aiGenerationEnabled={aiGenerationAvailable} listing="bots" />
              {config.features.mcp !== false && <McpServerPopup showOfficialBranding resource="bots" />}
            </div>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <Link href="/bots/teams">
              <Users className="h-3.5 w-3.5 mr-1" />
              {t("teams.link")}
            </Link>
          </Button>
          <Button size="sm" className="h-8 text-xs" asChild>
            <Link href="/bots/new">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("create")}
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{t("description")}</p>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <BotFilters
            categories={filterOptions.categories}
            tags={filterOptions.tags}
            currentFilters={params}
          />
        </aside>
        <main className="flex-1 min-w-0">
          {bots.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gridItems.map((item) =>
                isWidget(item) ? (
                  <ListingWidgetCard key={item.id} widget={item} placement="bots" />
                ) : (
                  <BotCard key={item.bot.id} bot={item.bot} position={item.position} />
                )
              )}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("noBots")}</p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={pageHref(params, page - 1)}><ChevronLeft className="h-4 w-4" /></Link>
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
              <span className="text-sm tabular-nums px-2">{page} / {totalPages}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages} asChild={page < totalPages}>
                {page < totalPages ? (
                  <Link href={pageHref(params, page + 1)}><ChevronRight className="h-4 w-4" /></Link>
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
