"use client";

import { useBranding } from "@/components/providers/branding-provider";
import {
  getActionButtonForCategory,
  type ActionButtonCategory,
  type ActionButtonConfig,
} from "@/lib/plugins/action-buttons";

export function useActionButton(category: ActionButtonCategory | null | undefined): ActionButtonConfig | undefined {
  const { useCloneBranding } = useBranding();
  return getActionButtonForCategory(category, { useCloneBranding });
}
