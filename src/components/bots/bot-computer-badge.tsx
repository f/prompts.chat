"use client";

import { Cloud, Laptop, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeComputerRequirements, type BotComputerRequirement } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

export const COMPUTER_REQUIREMENT_ICONS: Record<BotComputerRequirement, LucideIcon> = {
  CLOUD: Cloud,
  LOCAL: Laptop,
};

/** "bots.computer" message keys: the short label used in tooltips and aria-labels */
export const COMPUTER_REQUIREMENT_LABELS = { CLOUD: "cloud", LOCAL: "local" } as const satisfies Record<BotComputerRequirement, string>;

interface BotComputerBadgeProps {
  requirement: BotComputerRequirement;
  className?: string;
  /** Size of the icon box: "sm" in dense lists, "md" next to headings */
  size?: "sm" | "md";
  /** Set to false inside a link or button, which already takes keyboard focus; the tooltip still shows on hover */
  focusable?: boolean;
}

/** Icon-only marker for one computer a bot needs; the meaning shows on hover and focus */
export function BotComputerBadge({ requirement, className, size = "sm", focusable = true }: BotComputerBadgeProps) {
  const t = useTranslations("bots.computer");
  const Icon = COMPUTER_REQUIREMENT_ICONS[requirement];
  const label = t(COMPUTER_REQUIREMENT_LABELS[requirement]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          tabIndex={focusable ? 0 : undefined}
          aria-label={label}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
            size === "sm" ? "h-5 w-5" : "h-6 w-6",
            className
          )}
        >
          <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

interface BotComputerBadgesProps extends Omit<BotComputerBadgeProps, "requirement" | "className"> {
  requirements: readonly BotComputerRequirement[] | null | undefined;
  className?: string;
}

/** One marker per computer the bot needs, side by side; nothing when it needs none */
export function BotComputerBadges({ requirements, className, ...badgeProps }: BotComputerBadgesProps) {
  const list = normalizeComputerRequirements(requirements);
  if (list.length === 0) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {list.map((requirement) => (
        <BotComputerBadge key={requirement} requirement={requirement} {...badgeProps} />
      ))}
    </span>
  );
}
