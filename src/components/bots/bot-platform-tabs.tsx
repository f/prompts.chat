"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotPlatformIcon } from "@/components/bots/bot-platform-icon";
import { BOT_PLATFORM_INFO, type BotPlatform } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

/**
 * Columns follow the width of the tab list's container, not the viewport, so the same list fits the
 * page sidebar, the full-width mobile card, and the bundle dialog. The widest label ("OpenClaw") needs
 * a ~110px tab: two fit from 14.5rem, three from 24rem (@sm), four from 32rem (@lg).
 * Static class names so Tailwind keeps them.
 */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @min-[14.5rem]:grid-cols-2",
  3: "grid-cols-1 @min-[14.5rem]:grid-cols-2 @sm:grid-cols-3",
  4: "grid-cols-1 @min-[14.5rem]:grid-cols-2 @lg:grid-cols-4",
};

/** With three tabs in two columns, the last one spans the row instead of leaving a hole */
const LAST_OF_THREE = "@min-[14.5rem]:col-span-2 @sm:col-span-1";

interface BotPlatformTabsListProps {
  platforms: BotPlatform[];
  label: string;
}

export function BotPlatformTabsList({ platforms, label }: BotPlatformTabsListProps) {
  return (
    <div className="@container min-w-0">
      <TabsList
        aria-label={label}
        className={cn("grid h-auto w-full gap-1 md:w-full", COLUMNS[platforms.length] ?? COLUMNS[4])}
      >
        {platforms.map((platform, index) => (
          <TabsTrigger
            key={platform}
            value={platform}
            title={BOT_PLATFORM_INFO[platform].name}
            className={cn("h-11 min-w-0 px-2", platforms.length === 3 && index === 2 && LAST_OF_THREE)}
          >
            <BotPlatformIcon platform={platform} />
            <span className="truncate">{BOT_PLATFORM_INFO[platform].shortName}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
