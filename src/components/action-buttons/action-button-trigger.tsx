"use client";

import type { ComponentProps } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ActionButtonConfig } from "@/lib/plugins/action-buttons";
import { cn } from "@/lib/utils";

export function useActionButtonLabel(action: ActionButtonConfig): string {
  const t = useTranslations("actionButtons");
  return action.labelKey && t.has(action.labelKey) ? t(action.labelKey) : action.label;
}

interface ActionButtonTriggerProps extends ComponentProps<typeof Button> {
  action: ActionButtonConfig;
  compact?: boolean;
}

export function ActionButtonTrigger({ action, compact = false, className, ...props }: ActionButtonTriggerProps) {
  const label = useActionButtonLabel(action);

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(compact ? "h-6 px-1.5 gap-1 text-[11px]" : "gap-1.5", "font-medium", className)}
      data-action-button={action.id}
      {...props}
    >
      <Image
        src={action.icon}
        alt=""
        width={16}
        height={16}
        className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
      />
      <span>{label}</span>
    </Button>
  );
}
