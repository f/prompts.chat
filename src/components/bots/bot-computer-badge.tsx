"use client";

import { Cloud, Laptop, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BotComputerRequirement } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

export const COMPUTER_REQUIREMENT_ICONS: Record<Exclude<BotComputerRequirement, "NONE">, LucideIcon> = {
  CLOUD: Cloud,
  LOCAL: Laptop,
};

/** "bots.computer" message keys: the short label used in tooltips and aria-labels */
export const COMPUTER_REQUIREMENT_LABELS = { CLOUD: "cloud", LOCAL: "local" } as const;

interface BotComputerBadgeProps {
  requirement: BotComputerRequirement | null | undefined;
  className?: string;
  /** Size of the icon box: "sm" in dense lists, "md" next to headings */
  size?: "sm" | "md";
  /** Set to false inside a link or button, which already takes keyboard focus; the tooltip still shows on hover */
  focusable?: boolean;
}

/** Icon-only marker for a bot that needs a cloud computer or the user's own; the meaning shows on hover and focus */
export function BotComputerBadge({ requirement, className, size = "sm", focusable = true }: BotComputerBadgeProps) {
  const t = useTranslations("bots.computer");
  if (!requirement || requirement === "NONE") return null;
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
