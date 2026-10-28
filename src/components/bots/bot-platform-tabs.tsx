"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotPlatformIcon } from "@/components/bots/bot-platform-icon";
import { BOT_PLATFORM_INFO, type BotPlatform } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

/** Static class names so Tailwind keeps them; four platforms wrap into a 2x2 grid to keep labels whole */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2",
};

interface BotPlatformTabsListProps {
  platforms: BotPlatform[];
  label: string;
  /** Set when the container is wide enough from the sm breakpoint to fit four tabs in one row */
  fourAcrossOnWide?: boolean;
}

export function BotPlatformTabsList({ platforms, label, fourAcrossOnWide = false }: BotPlatformTabsListProps) {
  return (
    <TabsList
      aria-label={label}
      className={cn(
        "grid h-auto w-full gap-1 md:w-full",
        COLUMNS[platforms.length] ?? "grid-cols-2",
        fourAcrossOnWide && platforms.length === 4 && "sm:grid-cols-4"
      )}
    >
      {platforms.map((platform) => (
        <TabsTrigger
          key={platform}
          value={platform}
          title={BOT_PLATFORM_INFO[platform].name}
          className="h-11 min-w-0 px-2"
        >
          <BotPlatformIcon platform={platform} />
          <span className="truncate">{BOT_PLATFORM_INFO[platform].shortName}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
