import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { formatDistanceToNow } from "@/lib/date";
import { Edit, History, GitPullRequest, Users, ImageIcon, Video, FileText, Shield, Trash2, Cpu, Terminal, Wrench } from "lucide-react";
import { AnimatedDate } from "@/components/ui/animated-date";
import { ShareDropdown } from "@/components/prompts/share-dropdown";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewPrompt } from "@/lib/prompt-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InteractivePromptContent } from "@/components/prompts/interactive-prompt-content";
import { SkillViewer } from "@/components/prompts/skill-viewer";
import { UpvoteButton } from "@/components/prompts/upvote-button";
import { AddVersionForm } from "@/components/prompts/add-version-form";
import { DeleteVersionButton } from "@/components/prompts/delete-version-button";
import { VersionCompareModal } from "@/components/prompts/version-compare-modal";
import { VersionCompareButton } from "@/components/prompts/version-compare-button";
import { FeaturePromptButton } from "@/components/prompts/feature-prompt-button";
import { UnlistPromptButton } from "@/components/prompts/unlist-prompt-button";
import { TrendingBadge } from "@/components/prompts/trending-badge";
import { TrendingPromptButton } from "@/components/prompts/trending-prompt-button";
import { isTrending } from "@/lib/trending";
import { UserExamplesSection } from "@/components/prompts/user-examples-section";
import { DelistBanner } from "@/components/prompts/delist-banner";
import { RestorePromptButton } from "@/components/prompts/restore-prompt-button";
import { CommentSection } from "@/components/comments";
import { PromptFlowSection } from "@/components/prompts/prompt-flow-section";
import { RelatedPrompts } from "@/components/prompts/related-prompts";
import { RelatedBots } from "@/components/bots/related-bots";
import { getRelatedSkillsAndBots } from "@/lib/related-content";
import { ChangeRequestList } from "@/components/prompts/change-request-list";
import { AddToCollectionButton } from "@/components/prompts/add-to-collection-button";
import { getConfig } from "@/lib/config";
import { JsonLd, breadcrumbSchema, promptHowToSchema, promptSchema } from "@/components/seo/structured-data";
import { AI_MODELS } from "@/lib/works-best-with";
import { getPromptUrl } from "@/lib/urls";
import { buildPageMetadata, NOINDEX_ROBOTS, toMetaDescription } from "@/lib/seo";

interface PromptPageProps {
  params: Promise<{ id: string }>;
}

// Flagged comments are shadow-banned: only admins and their authors see them
const PUBLIC_COMMENT_WHERE = { deletedAt: null, flagged: false };

// Most comments included in structured data; the full thread is on the page
const MAX_SCHEMA_COMMENTS = 50;

/**
 * Extracts the prompt ID from a URL parameter that may contain a slug
 * Supports formats: "abc123", "abc123_some-slug", or "abc123_some-slug.prompt.md"
 */
function extractPromptId(idParam: string): string {
  let param = idParam;
  // Strip .prompt.md suffix if present
  if (param.endsWith(".prompt.md")) {
    param = param.slice(0, -".prompt.md".length);
  }
  // If the param contains an underscore, extract the ID (everything before first underscore)
  const underscoreIndex = param.indexOf("_");
  if (underscoreIndex !== -1) {
    return param.substring(0, underscoreIndex);
  }
  return param;
}


// Titles that already say what they are don't get a suffix, e.g. "Information Gathering Prompt"
const TITLE_KEYWORDS: Record<string, RegExp> = {
  SKILL: /\bskills?\b/i,
  TASTE: /\btaste\b/i,
};
const PROMPT_KEYWORD = /\bprompts?\b/i;

/**
 * Builds a search-friendly title, e.g. "Movie Critic - ChatGPT Prompt" or "Neon Portrait - Nano Banana Prompt"
 */
async function getPromptMetaTitle(title: string, type: string, bestWithModels: string[]): Promise<string> {
  if ((TITLE_KEYWORDS[type] ?? PROMPT_KEYWORD).test(title)) {
    return title;
  }

  const t = await getTranslations("seo.promptTypes");
  const model = AI_MODELS[bestWithModels[0] as keyof typeof AI_MODELS];
  if (model && type !== "SKILL" && type !== "TASTE") {
    return `${title} - ${t("model", { model: model.name })}`;
  }

  const label = ["STRUCTURED", "IMAGE", "VIDEO", "AUDIO", "SKILL", "TASTE"].includes(type) ? type : "TEXT";
  return `${title} - ${t(label)}`;
}

export async function generateMetadata({ params }: PromptPageProps): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = extractPromptId(idParam);
  const prompt = await db.prompt.findUnique({
    where: { id },
    select: {
      title: true,
      slug: true,
      description: true,
      content: true,
      type: true,
      bestWithModels: true,
      isPrivate: true,
      isUnlisted: true,
      deletedAt: true,
      authorId: true,
    },
  });

  if (!prompt) {
    return { title: "Prompt Not Found", robots: NOINDEX_ROBOTS };
  }

  if (prompt.deletedAt || prompt.isPrivate) {
    const session = await auth();
    const canView = prompt.deletedAt ? session?.user?.role === "ADMIN" : canViewPrompt(prompt, session);
    return { title: canView ? prompt.title : "Prompt Not Found", robots: NOINDEX_ROBOTS };
  }

  // Always the slugged URL, also when the page is requested as /prompts/{id}
  const canonicalPath = getPromptUrl(id, prompt.slug);

  return buildPageMetadata({
    title: await getPromptMetaTitle(prompt.title.trim(), prompt.type, prompt.bestWithModels),
    description: toMetaDescription(prompt.description || prompt.content),
    path: canonicalPath,
    openGraphType: "article",
    image: "route",
    // Unlisted prompts are reachable by direct link only
    noindex: prompt.isUnlisted,
  });
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { id: idParam } = await params;
  const id = extractPromptId(idParam);
  const session = await auth();
  const config = await getConfig();
  const t = await getTranslations("prompts");
  const locale = await getLocale();

  const isAdmin = session?.user?.role === "ADMIN";
  
  // Admins can view deleted prompts, others cannot
  const prompt = await db.prompt.findFirst({
    where: { id, ...(isAdmin ? {} : { deletedAt: null }) },
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
          parent: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          content: true,
          changeNote: true,
          createdAt: true,
          author: {
            select: {
              name: true,
              username: true,
            },
          },
        },
      },
      _count: {
        select: {
          votes: true,
          comments: { where: PUBLIC_COMMENT_WHERE },
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
    },
  });

  if (!prompt) {
    notFound();
  }

  // Check if user can view private prompt
  if (!canViewPrompt(prompt, session)) {
    notFound();
  }

  // Non-canonical URLs are redirected in layout.tsx
  const canonicalPath = getPromptUrl(prompt.id, prompt.slug);

  // Check if user has voted
  const userVote = session?.user
    ? await db.promptVote.findUnique({
        where: {
          userId_promptId: {
            userId: session.user.id,
            promptId: id,
          },
        },
      })
    : null;

  // Check if user has this prompt in their collection
  const userCollection = session?.user
    ? await db.collection.findUnique({
        where: {
          userId_promptId: {
            userId: session.user.id,
            promptId: id,
          },
        },
      })
    : null;

  // Fetch related prompts (via PromptConnection with label "related")
  const relatedConnections = await db.promptConnection.findMany({
    where: {
      sourceId: id,
      label: "related",
    },
    orderBy: { order: "asc" },
    include: {
      target: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          type: true,
          isPrivate: true,
          isUnlisted: true,
          deletedAt: true,
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: { votes: true },
          },
        },
      },
    },
  });

  // Filter out private, unlisted, or deleted related prompts
  const relatedPrompts = relatedConnections
    .map((conn) => conn.target)
    .filter((p) => !p.isPrivate && !p.isUnlisted && !p.deletedAt);

  const { skills: relatedSkills, bots: relatedBots } = await getRelatedSkillsAndBots(id, {
    excludeIds: relatedPrompts.map((p) => p.id),
  });

  // Check if prompt has flow connections (previous/next, not "related")
  const flowConnectionCount = await db.promptConnection.count({
    where: {
      OR: [
        { sourceId: id, label: { not: "related" } },
        { targetId: id, label: { not: "related" } },
      ],
    },
  });
  const hasFlowConnections = flowConnectionCount > 0;

  // Comments everyone can see (flagged ones are shadow-banned) for structured data
  const showComments = config.features.comments !== false && !prompt.isPrivate;
  const schemaComments = showComments
    ? await db.comment.findMany({
        where: { promptId: id, ...PUBLIC_COMMENT_WHERE },
        orderBy: { createdAt: "asc" },
        take: MAX_SCHEMA_COMMENTS,
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentId: true,
          author: { select: { name: true, username: true } },
        },
      })
    : [];

  // Unlisted prompts are accessible via direct link (like YouTube unlisted videos)
  // They just don't appear in public listings, search results, or feeds

  const isOwner = session?.user?.id === prompt.authorId;
  const canEdit = isOwner || isAdmin;
  const voteCount = prompt._count?.votes ?? 0;
  const hasVoted = !!userVote;
  const inCollection = !!userCollection;

  // Fetch change requests for this prompt
  const changeRequests = await db.changeRequest.findMany({
    where: { promptId: id },
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  const pendingCount = changeRequests.filter((cr) => cr.status === "PENDING").length;

  // Get delist reason (cast to expected type after Prisma migration)
  const delistReason = (prompt as { delistReason?: string | null }).delistReason as
    | "TOO_SHORT" | "NOT_ENGLISH" | "LOW_QUALITY" | "NOT_LLM_INSTRUCTION" | "MANUAL" | null;

  // Get works best with fields (cast until Prisma types are regenerated)
  const bestWithModels = (prompt as unknown as { bestWithModels?: string[] }).bestWithModels || [];
  const bestWithMCP = (prompt as unknown as { bestWithMCP?: { command: string; tools?: string[] }[] }).bestWithMCP || [];

  return (
    <>
      {/* Structured Data for Rich Results */}
      <JsonLd
        data={promptHowToSchema({
          id: prompt.id,
          name: prompt.title,
          description: prompt.description || `AI prompt: ${prompt.title}`,
          content: prompt.content,
          author: prompt.author.name || prompt.author.username,
          authorUrl: `${process.env.NEXTAUTH_URL || "https://prompts.chat"}/@${prompt.author.username}`,
          datePublished: prompt.createdAt.toISOString(),
          dateModified: prompt.updatedAt.toISOString(),
          category: prompt.category?.name,
          tags: prompt.tags.map(({ tag }) => tag.name),
          voteCount: voteCount,
          branding: config.branding,
        })}
      />
      {!prompt.isPrivate && (
        <JsonLd
          data={[
            promptSchema({
              path: canonicalPath,
              title: prompt.title,
              description: toMetaDescription(prompt.description || prompt.content),
              content: prompt.content,
              type: prompt.type,
              mediaUrl: prompt.mediaUrl,
              author: { name: prompt.author.name || prompt.author.username, username: prompt.author.username },
              datePublished: prompt.createdAt,
              dateModified: prompt.updatedAt,
              category: prompt.category?.name,
              tags: prompt.tags.map(({ tag }) => tag.name),
              voteCount,
              comments: schemaComments.map((comment) => ({
                id: comment.id,
                parentId: comment.parentId,
                text: comment.content,
                createdAt: comment.createdAt,
                author: { name: comment.author.name || comment.author.username, username: comment.author.username },
              })),
              commentCount: showComments ? prompt._count.comments : 0,
            }),
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Prompts", path: "/prompts" },
              ...(prompt.category?.parent
                ? [{ name: prompt.category.parent.name, path: `/categories/${prompt.category.parent.slug}` }]
                : []),
              ...(prompt.category ? [{ name: prompt.category.name, path: `/categories/${prompt.category.slug}` }] : []),
              { name: prompt.title, path: canonicalPath },
            ]),
          ]}
        />
      )}
      <div className="container max-w-4xl py-8">
        {/* Deleted Banner - shown to admins when prompt is deleted */}
      {prompt.deletedAt && isAdmin && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                {t("promptDeleted")}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-500">
                {t("promptDeletedDescription")}
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <RestorePromptButton promptId={prompt.id} />
          </div>
        </div>
      )}

      {/* Delist Banner - shown to owner and admins when prompt is delisted */}
      {prompt.isUnlisted && delistReason && (isOwner || isAdmin) && (
        <DelistBanner
          promptId={prompt.id}
          delistReason={delistReason}
          isOwner={isOwner}
          isDeleted={!!prompt.deletedAt}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        {/* Title row with upvote button */}
        <div className="flex items-center gap-4 mb-2">
          <div className="shrink-0">
            <UpvoteButton
              promptId={prompt.id}
              initialVoted={hasVoted}
              initialCount={voteCount}
              isLoggedIn={!!session?.user}
              size="circular"
            />
          </div>
          <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="text-3xl font-bold">{prompt.title}</h1>
              {prompt.isPrivate && (
                <Badge variant="secondary">{t("promptPrivate")}</Badge>
              )}
              {isTrending(prompt.trendingUntil) && <TrendingBadge />}
            </div>
          </div>
        </div>
        
        {/* Description */}
        {prompt.description && (
          <p className="text-muted-foreground">{prompt.description}</p>
        )}
      </div>
      <div className="border-b mb-6 sm:hidden" />

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <Link href={`/@${prompt.author.username}`} title={`@${prompt.author.username}`}>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src={prompt.author.avatar || undefined} />
                <AvatarFallback className="text-xs">{prompt.author.name?.charAt(0) || prompt.author.username.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>
            {prompt.contributors.map((contributor) => (
              <Link key={contributor.id} href={`/@${contributor.username}`} title={`@${contributor.username}`}>
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={contributor.avatar || undefined} />
                  <AvatarFallback className="text-xs">{contributor.name?.charAt(0) || contributor.username.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
            ))}
          </div>
          {prompt.contributors.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  <Link href={`/@${prompt.author.username}`} className="hover:underline">@{prompt.author.username}</Link> +{prompt.contributors.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium mb-1.5">{t("promptContributors")}</div>
                  {prompt.contributors.map((contributor) => (
                    <Link
                      key={contributor.id}
                      href={`/@${contributor.username}`}
                      className="flex items-center gap-2 hover:underline rounded px-1 py-0.5 -mx-1"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={contributor.avatar || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {contributor.name?.charAt(0) || contributor.username.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">@{contributor.username}</span>
                    </Link>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href={`/@${prompt.author.username}`} className="hover:underline">@{prompt.author.username}</Link>
          )}
        </div>
        {prompt.contributors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{prompt.contributors.length + 1} {t("contributors")}</span>
          </div>
        )}
        <AnimatedDate 
          date={prompt.createdAt} 
          relativeText={formatDistanceToNow(prompt.createdAt, locale)} 
          locale={locale}
        />
      </div>

      {/* Category and Tags */}
      {(prompt.category || prompt.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {prompt.category && (
            <Link href={`/categories/${prompt.category.slug}`}>
              <Badge variant="outline">{prompt.category.name}</Badge>
            </Link>
          )}
          {prompt.category && prompt.tags.length > 0 && (
            <span className="text-muted-foreground">•</span>
          )}
          {prompt.tags.map(({ tag }) => (
            <Link key={tag.id} href={`/tags/${tag.slug}`}>
              <Badge
                variant="secondary"
                style={{ backgroundColor: tag.color + "20", color: tag.color }}
              >
                {tag.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Content Tabs */}
      <Tabs defaultValue="content">
        <div className="flex flex-col gap-3 mb-4">
          {/* Action buttons - on top on mobile */}
          <div className="flex items-center justify-between gap-2 md:hidden">
            <AddToCollectionButton
              promptId={prompt.id}
              initialInCollection={inCollection}
              isLoggedIn={!!session?.user}
            />
            <div className="flex gap-2">
              {!isOwner && session?.user && (
                <Button asChild size="sm">
                  <Link href={`/prompts/${id}/changes/new`}>
                    <GitPullRequest className="h-4 w-4 mr-1.5" />
                    {t("createChangeRequest")}
                  </Link>
                </Button>
              )}
              {isOwner && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/prompts/${id}/edit`}>
                    <Edit className="h-4 w-4 mr-1.5" />
                    {t("edit")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="content">{t("promptContent")}</TabsTrigger>
              <TabsTrigger value="versions" className="gap-1">
                <History className="h-4 w-4" />
                {t("versions")}
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
                  {prompt.versions.length > 0 ? prompt.versions[0].version : 1}
                </Badge>
              </TabsTrigger>
              {changeRequests.length > 0 && (
                <TabsTrigger value="changes" className="gap-1">
                  <GitPullRequest className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("changeRequests")}</span>
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
            {/* Action buttons - inline on desktop */}
            <div className="hidden md:flex items-center gap-2">
              <AddToCollectionButton
                promptId={prompt.id}
                initialInCollection={inCollection}
                isLoggedIn={!!session?.user}
              />
              {!isOwner && session?.user && (
                <Button asChild size="sm">
                  <Link href={`/prompts/${id}/changes/new`}>
                    <GitPullRequest className="h-4 w-4 mr-1.5" />
                    {t("createChangeRequest")}
                  </Link>
                </Button>
              )}
              {isOwner && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/prompts/${id}/edit`}>
                    <Edit className="h-4 w-4 mr-1.5" />
                    {t("edit")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <TabsContent value="content" className="space-y-4 mt-0">
          {/* Media Preview with User Examples (for image/video prompts) */}
          {prompt.mediaUrl && (
            <UserExamplesSection 
              mediaUrl={prompt.mediaUrl} 
              title={prompt.title} 
              type={prompt.type}
              promptId={prompt.id}
              isLoggedIn={!!session?.user}
              currentUserId={session?.user?.id}
              isAdmin={isAdmin}
            />
          )}

          {/* Prompt Text Content */}
          <div>
            {prompt.requiresMediaUpload && prompt.requiredMediaType && prompt.requiredMediaCount && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 mb-3">
                {prompt.requiredMediaType === "IMAGE" && <ImageIcon className="h-3.5 w-3.5" />}
                {prompt.requiredMediaType === "VIDEO" && <Video className="h-3.5 w-3.5" />}
                {prompt.requiredMediaType === "DOCUMENT" && <FileText className="h-3.5 w-3.5" />}
                <span className="text-xs font-medium">
                  {prompt.requiredMediaType === "IMAGE" 
                    ? t("requiresImage", { count: prompt.requiredMediaCount })
                    : prompt.requiredMediaType === "VIDEO"
                    ? t("requiresVideo", { count: prompt.requiredMediaCount })
                    : t("requiresDocument", { count: prompt.requiredMediaCount })}
                </span>
              </div>
            )}
            {prompt.type === "SKILL" ? (
              <SkillViewer 
                content={prompt.content} 
                promptId={prompt.id}
                promptSlug={prompt.slug ?? undefined}
              />
            ) : prompt.type === "TASTE" ? (
              <InteractivePromptContent 
                content={prompt.content} 
                title="taste.md"
                isLoggedIn={!!session?.user}
                promptId={prompt.id}
                promptSlug={prompt.slug ?? undefined}
                promptType={prompt.type}
                shareTitle={prompt.title}
                promptTitle={prompt.title}
                promptDescription={prompt.description ?? undefined}
              />
            ) : prompt.structuredFormat ? (
              <InteractivePromptContent 
                content={prompt.content} 
                isStructured={true}
                structuredFormat={(prompt.structuredFormat?.toLowerCase() as "json" | "yaml") || "json"}
                title={t("promptContent")}
                isLoggedIn={!!session?.user}
                categoryName={prompt.category?.name}
                parentCategoryName={prompt.category?.parent?.name}
                promptId={prompt.id}
                promptSlug={prompt.slug ?? undefined}
                promptType={prompt.type}
                shareTitle={prompt.title}
                promptTitle={prompt.title}
                promptDescription={prompt.description ?? undefined}
              />
            ) : (
              <InteractivePromptContent 
                content={prompt.content} 
                title={t("promptContent")} 
                isLoggedIn={!!session?.user}
                categoryName={prompt.category?.name}
                parentCategoryName={prompt.category?.parent?.name}
                promptId={prompt.id}
                promptSlug={prompt.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
                promptType={prompt.type}
                shareTitle={prompt.title}
                promptTitle={prompt.title}
                promptDescription={prompt.description ?? undefined}
              />
            )}
          </div>

          {/* Works Best With */}
          {bestWithModels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("worksBestWith")}:</span>
              <div className="flex flex-wrap gap-1.5">
                {bestWithModels.map((slug) => {
                  const model = AI_MODELS[slug as keyof typeof AI_MODELS];
                  return (
                    <Badge key={slug} variant="secondary" className="text-xs">
                      {model?.name || slug}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* MCP Tools */}
          {bestWithMCP.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("mcpTools")}:</span>
              <div className="flex flex-wrap gap-1.5">
                {bestWithMCP.flatMap((mcp, mcpIndex) => 
                  mcp.tools && mcp.tools.length > 0 
                    ? mcp.tools.map((tool, toolIndex) => (
                        <Tooltip key={`${mcpIndex}-${toolIndex}`}>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs font-mono cursor-help gap-1">
                              <Wrench className="h-3 w-3" />
                              {tool}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <code className="text-xs break-all">{mcp.command}</code>
                          </TooltipContent>
                        </Tooltip>
                      ))
                    : [(
                        <Tooltip key={mcpIndex}>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs font-mono cursor-help">
                              {mcp.command.split("/").pop()?.replace("server-", "") || mcp.command}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <code className="text-xs break-all">{mcp.command}</code>
                          </TooltipContent>
                        </Tooltip>
                      )]
                )}
              </div>
            </div>
          )}

          {/* Report & Prompt Flow - hide for SKILL and TASTE types */}
          {prompt.type !== "SKILL" && prompt.type !== "TASTE" && (
            <PromptFlowSection
              promptId={prompt.id}
              promptTitle={prompt.title}
              canEdit={canEdit}
              isOwner={isOwner}
              isLoggedIn={!!session?.user}
              currentUserId={session?.user?.id}
              isAdmin={isAdmin}
              workflowLink={(prompt as unknown as { workflowLink?: string | null }).workflowLink}
              hasFlowConnections={hasFlowConnections}
            />
          )}

          {/* Related Prompts */}
          {relatedPrompts.length > 0 && (
            <RelatedPrompts prompts={relatedPrompts} />
          )}

          <RelatedPrompts prompts={relatedSkills} title={t("relatedSkills")} />
          <RelatedBots bots={relatedBots} />

          {/* Comments Section */}
          {config.features.comments !== false && !prompt.isPrivate && (
            <CommentSection
              promptId={prompt.id}
              currentUserId={session?.user?.id}
              isAdmin={isAdmin}
              isLoggedIn={!!session?.user}
              locale={locale}
            />
          )}
        </TabsContent>

        <TabsContent value="versions" className="mt-0">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">{t("versionHistory")}</h2>
              <div className="flex items-center gap-2">
                <VersionCompareModal 
                  versions={prompt.versions} 
                  currentContent={prompt.content}
                  promptType={prompt.type}
                  structuredFormat={prompt.structuredFormat}
                />
                {canEdit && (
                  <AddVersionForm promptId={prompt.id} currentContent={prompt.content} />
                )}
              </div>
            </div>
            {prompt.versions.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">{t("noVersions")}</p>
            ) : (
              <div className="divide-y border rounded-lg">
                {prompt.versions.map((version, index) => {
                  const isLatestVersion = index === 0;
                  return (
                    <div
                      key={version.id}
                      className="px-4 py-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">v{version.version}</span>
                          {isLatestVersion && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              {t("currentVersion")}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(version.createdAt, locale)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            by @{version.author.username}
                          </span>
                        </div>
                        {version.changeNote && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {version.changeNote}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isLatestVersion && (
                          <VersionCompareButton
                            versionContent={version.content}
                            versionNumber={version.version}
                            currentContent={prompt.content}
                            promptType={prompt.type}
                            structuredFormat={prompt.structuredFormat}
                          />
                        )}
                        {canEdit && !isLatestVersion && (
                          <DeleteVersionButton
                            promptId={prompt.id}
                            versionId={version.id}
                            versionNumber={version.version}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {changeRequests.length > 0 && (
          <TabsContent value="changes" className="mt-0">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">{t("changeRequests")}</h2>
              </div>
              <ChangeRequestList changeRequests={changeRequests} basePath={`/prompts/${id}`} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Admin Area */}
      {isAdmin && (
        <div className="mt-8 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-500">{t("adminArea")}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FeaturePromptButton
              promptId={prompt.id}
              isFeatured={prompt.isFeatured}
            />
            <TrendingPromptButton
              promptId={prompt.id}
              trendingUntil={prompt.trendingUntil}
            />
            <UnlistPromptButton
              promptId={prompt.id}
              isUnlisted={prompt.isUnlisted}
            />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/prompts/${id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                {t("edit")}
              </Link>
            </Button>
          </div>
        </div>
      )}

      </div>
    </>
  );
}
