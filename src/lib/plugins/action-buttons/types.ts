// ============================================
// Action Buttons Plugin Types
// ============================================

export interface ActionButtonCategory {
  slug: string;
  parent?: { slug: string } | null;
}

/**
 * An action button that replaces the Run button for prompts in the
 * configured categories.
 */
export interface ActionButtonConfig {
  id: string;
  /** English label, used when `labelKey` has no translation */
  label: string;
  /** Translation key under the `actionButtons` namespace */
  labelKey?: string;
  /** Path to the icon asset in /public */
  icon: string;
  /** Category slugs the button applies to */
  categories: string[];
  /** Also match prompts whose parent category is listed. Default: true */
  includeSubcategories?: boolean;
  /** Platform ids from `@/lib/run-platforms`, in display order */
  agents: string[];
  /** Instruction prepended to the prompt content before it is sent to the agent */
  promptPrefix: string;
  /** Fall back to the Run button when clone branding is enabled. Default: true */
  hideWithCloneBranding?: boolean;
}

export interface ActionButtonPlugin {
  id: string;
  name: string;
  buttons: ActionButtonConfig[];
}
