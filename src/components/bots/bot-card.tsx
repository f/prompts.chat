import { useTranslations } from "next-intl";
import { ArrowBigUp, Clock, Star, Zap } from "lucide-react";
import { BotCardLink } from "@/components/bots/bot-analytics";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotComputerBadges } from "@/components/bots/bot-computer-badge";
import { BotPlatformIcons } from "@/components/bots/bot-platform-icons";
import {
  isBotColor,
  isBotIconName,
  normalizeComputerRequirements,
  parseBotConfig,
  resolveBotPlatforms,
  type BotColor,
  type BotComputerRequirement,
  type BotConfig,
  type BotIconName,
  type BotPlatform,
} from "@/lib/bots/schema";
import { getBotUrl } from "@/lib/urls";
import { Badge } from "@/components/ui/badge";
import { PromptAuthor, type PromptAuthorData } from "@/components/prompts/prompt-author";
import { TrendingBadge } from "@/components/prompts/trending-badge";
import { isTrending } from "@/lib/trending";

/** The subset of BotView a card needs; BotView satisfies it */
export interface BotCardData {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  platforms: BotPlatform[];
  icon: BotIconName | null;
  color: BotColor | null;
  isFeatured: boolean;
  trendingUntil?: Date | string | null;
  computerRequirements?: readonly BotComputerRequirement[] | null;
  config: Pick<BotConfig, "routines">;
  author: PromptAuthorData;
  voteCount: number;
}

/** BOT-type prompt rows as returned by prompt list queries */
export interface BotPromptFields {
  id: string;
  slug?: string | null;
  title: string;
  description: string | null;
  isFeatured?: boolean;
  trendingUntil?: Date | string | null;
  botIcon?: string | null;
  botColor?: string | null;
  botPlatforms?: readonly BotPlatform[] | null;
  botPlatform?: BotPlatform | null;
  botConfig?: unknown;
  computerRequirements?: readonly string[] | null;
  author: PromptAuthorData;
  voteCount?: number;
  _count?: { votes?: number };
}

export function promptToBotCardData(prompt: BotPromptFields): BotCardData {
  return {
    id: prompt.id,
    slug: prompt.slug ?? null,
    title: prompt.title,
    description: prompt.description,
    platforms: resolveBotPlatforms(prompt),
    icon: prompt.botIcon && isBotIconName(prompt.botIcon) ? prompt.botIcon : null,
    color: prompt.botColor && isBotColor(prompt.botColor) ? prompt.botColor : null,
    isFeatured: prompt.isFeatured ?? false,
    trendingUntil: prompt.trendingUntil ?? null,
    computerRequirements: normalizeComputerRequirements(prompt.computerRequirements),
    config: parseBotConfig(prompt.botConfig),
    author: prompt.author,
    voteCount: prompt.voteCount ?? prompt._count?.votes ?? 0,
  };
}

interface BotCardProps {
  bot: BotCardData;
  /** 1-based position in the listing, reported with card clicks */
  position?: number;
}

export function BotCard({ bot, position }: BotCardProps) {
  const t = useTranslations("bots");
  const tPrompts = useTranslations("prompts");
  const scheduled = bot.config.routines.filter((r) => r.type === "schedule").length;
  const events = bot.config.routines.length - scheduled;

  return (
    <div className="group relative flex min-w-0 flex-col rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BotAvatar icon={bot.icon} color={bot.color} size="sm" />
          <h2 className="min-w-0 text-sm font-medium leading-snug">
            <BotCardLink
              botId={bot.id}
              position={position}
              href={getBotUrl(bot.id, bot.slug)}
              prefetch={false}
              className="line-clamp-1 wrap-anywhere hover:underline after:absolute after:inset-0 after:content-['']"
            >
              {bot.title}
            </BotCardLink>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isTrending(bot.trendingUntil) && <TrendingBadge className="text-[10px]" />}
          {bot.isFeatured && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
          <Badge variant="outline" className="text-[10px]">
            {tPrompts("types.bot")}
          </Badge>
        </div>
      </div>

      {bot.description && <p className="mb-2 text-xs text-muted-foreground line-clamp-2 wrap-anywhere">{bot.description}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        <BotPlatformIcons platforms={bot.platforms} className="relative z-10" />
        <BotComputerBadges requirements={bot.computerRequirements} focusable={false} />
        {scheduled > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t("scheduledCount", { count: scheduled })}
          </span>
        )}
        {events > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {t("eventCount", { count: events })}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
        <PromptAuthor author={bot.author} className="relative z-10" />
        <span className="flex shrink-0 items-center gap-0.5">
          <ArrowBigUp className="h-3.5 w-3.5" />
          {bot.voteCount}
        </span>
      </div>
    </div>
  );
}
