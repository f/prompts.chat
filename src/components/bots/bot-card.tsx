import { useTranslations } from "next-intl";
import { ArrowBigUp, Clock, Star, Zap } from "lucide-react";
import { BotCardLink } from "@/components/bots/bot-analytics";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotComputerBadge } from "@/components/bots/bot-computer-badge";
import { BotPlatformIcons } from "@/components/bots/bot-platform-icons";
import {
  isBotColor,
  isBotComputerRequirement,
  isBotIconName,
  parseBotConfig,
  resolveBotPlatforms,
  type BotColor,
  type BotComputerRequirement,
  type BotConfig,
  type BotIconName,
  type BotPlatform,
} from "@/lib/bots/schema";
import { getBotUrl } from "@/lib/urls";
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
  computerRequirement?: BotComputerRequirement | null;
  config: Pick<BotConfig, "routines">;
  author: { username: string };
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
  computerRequirement?: string | null;
  author: { username: string };
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
    computerRequirement:
      prompt.computerRequirement && isBotComputerRequirement(prompt.computerRequirement)
        ? prompt.computerRequirement
        : null,
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
  const scheduled = bot.config.routines.filter((r) => r.type === "schedule").length;
  const events = bot.config.routines.length - scheduled;

  return (
    <BotCardLink
      botId={bot.id}
      position={position}
      href={getBotUrl(bot.id, bot.slug)}
      prefetch={false}
      className="group flex min-w-0 flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <BotAvatar icon={bot.icon} color={bot.color} />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {isTrending(bot.trendingUntil) && <TrendingBadge className="text-[10px]" />}
          {bot.isFeatured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
          <BotPlatformIcons platforms={bot.platforms} />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold leading-snug wrap-anywhere group-hover:underline">{bot.title}</h2>
        {bot.description && <p className="text-sm text-muted-foreground line-clamp-3 wrap-anywhere">{bot.description}</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <BotComputerBadge requirement={bot.computerRequirement} focusable={false} className="-my-0.5" />
        <span className="min-w-0 wrap-anywhere">@{bot.author.username}</span>
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
        <span className="ml-auto flex items-center gap-0.5">
          <ArrowBigUp className="h-3.5 w-3.5" />
          {bot.voteCount}
        </span>
      </div>
    </BotCardLink>
  );
}
