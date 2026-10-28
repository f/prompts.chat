"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotPlatformIcon } from "@/components/bots/bot-platform-icon";
import { BOT_PLATFORM_INFO, type BotPlatform } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

/**
 * Columns follow the width of the tab list's container, not the viewport, so the same list fits the
 * page sidebar, the full-width mobile card, and the bundle dialog. The widest label ("OpenClaw") needs
 * a ~110px tab: two fit from 14.5rem, three from 24rem (@sm), four from 32rem (@lg).
 */
const BREAKPOINTS = ["base", "two", "sm", "lg"] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];

/** Columns per breakpoint for a given tab count; four tabs skip three columns to avoid a 3 + 1 layout */
export function platformTabColumns(count: number): Record<Breakpoint, number> {
  const two = Math.min(2, count);
  const three = count === 4 ? 2 : Math.min(3, count);
  const four = count === 4 || count === 7 ? 4 : Math.min(3, count);
  return { base: 1, two, sm: three, lg: four };
}

/**
 * The list is a 12-column grid. A tab spans 12 / columns, and tabs in a short last row share its
 * 12 columns so rows never leave a hole (3 tabs in two columns: 2 + 1 with the last one full width).
 */
export function platformTabSpans(count: number, index: number): Record<Breakpoint, number> {
  const columns = platformTabColumns(count);
  const spans = {} as Record<Breakpoint, number>;
  for (const breakpoint of BREAKPOINTS) {
    const perRow = columns[breakpoint];
    const fullRows = Math.floor(count / perRow) * perRow;
    spans[breakpoint] = 12 / (index < fullRows ? perRow : count - fullRows);
  }
  return spans;
}

/** Static class names so Tailwind keeps them */
const SPAN_CLASSES: Record<Breakpoint, Record<number, string>> = {
  base: { 12: "col-span-12", 6: "col-span-6", 4: "col-span-4", 3: "col-span-3" },
  two: {
    12: "@min-[14.5rem]:col-span-12",
    6: "@min-[14.5rem]:col-span-6",
    4: "@min-[14.5rem]:col-span-4",
    3: "@min-[14.5rem]:col-span-3",
  },
  sm: { 12: "@sm:col-span-12", 6: "@sm:col-span-6", 4: "@sm:col-span-4", 3: "@sm:col-span-3" },
  lg: { 12: "@lg:col-span-12", 6: "@lg:col-span-6", 4: "@lg:col-span-4", 3: "@lg:col-span-3" },
};

function spanClassName(count: number, index: number): string {
  const spans = platformTabSpans(count, index);
  return BREAKPOINTS.map((breakpoint) => SPAN_CLASSES[breakpoint][spans[breakpoint]]).join(" ");
}

interface BotPlatformTabsListProps {
  platforms: BotPlatform[];
  label: string;
}

export function BotPlatformTabsList({ platforms, label }: BotPlatformTabsListProps) {
  return (
    <div className="@container min-w-0">
      <TabsList aria-label={label} className="grid h-auto w-full grid-cols-12 gap-1 md:w-full">
        {platforms.map((platform, index) => (
          <TabsTrigger
            key={platform}
            value={platform}
            title={BOT_PLATFORM_INFO[platform].name}
            className={cn("h-11 min-w-0 px-2", spanClassName(platforms.length, index))}
          >
            <BotPlatformIcon platform={platform} />
            <span className="truncate">{BOT_PLATFORM_INFO[platform].shortName}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
