"use client";

import { useTranslations } from "next-intl";
import { Minus, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { diffChips, type DiffChip, type DiffItem } from "@/lib/list-diff";

const CHIP_STYLES: Record<DiffChip["kind"], string> = {
  added: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30",
  removed: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30 line-through",
  changed: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  unchanged: "bg-muted/50 text-muted-foreground",
};

const CHIP_ICONS = { added: Plus, removed: Minus, changed: Pencil, unchanged: null } as const;

interface ChipListDiffProps {
  original: readonly DiffItem[];
  modified: readonly DiffItem[];
  className?: string;
}

/**
 * A list-like field (platforms, tags, skills, …) as chips: added ones green with +, removed ones
 * red and struck through with −, edited ones yellow, the rest muted
 */
export function ChipListDiff({ original, modified, className }: ChipListDiffProps) {
  const t = useTranslations("changeRequests.member");
  const chips = diffChips(original, modified);
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((chip) => {
        const Icon = CHIP_ICONS[chip.kind];
        return (
          <li key={chip.key} data-diff={chip.kind} className="max-w-full">
            <Badge
              variant="outline"
              className={cn("h-auto max-w-full whitespace-normal wrap-anywhere text-left font-normal", CHIP_STYLES[chip.kind])}
            >
              {Icon && <Icon aria-hidden="true" />}
              {chip.kind !== "unchanged" && <span className="sr-only">{t(chip.kind)}: </span>}
              {chip.text}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
