import { getPlatformById, type Platform } from "@/lib/run-platforms";
import type { ActionButtonCategory, ActionButtonConfig, ActionButtonPlugin } from "./types";
import { spacefastActionButtons } from "./spacefast";

export * from "./types";

// Registry of all action button plugins
const actionButtonPlugins: ActionButtonPlugin[] = [
  spacefastActionButtons,
];

export function getActionButtons(plugins: ActionButtonPlugin[] = actionButtonPlugins): ActionButtonConfig[] {
  return plugins.flatMap((plugin) => plugin.buttons);
}

export function matchesActionButtonCategory(
  button: ActionButtonConfig,
  category: ActionButtonCategory | null | undefined
): boolean {
  if (!category) return false;
  if (button.categories.includes(category.slug)) return true;
  const parentSlug = category.parent?.slug;
  return (button.includeSubcategories ?? true) && !!parentSlug && button.categories.includes(parentSlug);
}

/**
 * Find the action button that replaces the Run button for a prompt's category.
 * Returns undefined when the prompt should keep the normal Run button.
 */
export function getActionButtonForCategory(
  category: ActionButtonCategory | null | undefined,
  options: { useCloneBranding?: boolean; plugins?: ActionButtonPlugin[] } = {}
): ActionButtonConfig | undefined {
  return getActionButtons(options.plugins).find((button) => {
    if (options.useCloneBranding && (button.hideWithCloneBranding ?? true)) return false;
    return matchesActionButtonCategory(button, category);
  });
}

export function getActionButtonAgents(button: ActionButtonConfig): Platform[] {
  return button.agents
    .map((id) => getPlatformById(id))
    .filter((platform): platform is Platform => !!platform);
}

export function buildActionPrompt(button: ActionButtonConfig, content: string): string {
  return `${button.promptPrefix}${content}`;
}
