// ============================================
// Widgets Plugin Types
// ============================================

import type { ReactNode } from "react";

/** Listing surfaces a widget can be injected into */
export type WidgetPlacement = "prompts" | "bots" | "teams";

export const WIDGET_PLACEMENTS: readonly WidgetPlacement[] = ["prompts", "bots", "teams"];

/** Surfaces a widget appears on when it doesn't declare `placements` */
export const DEFAULT_WIDGET_PLACEMENTS: readonly WidgetPlacement[] = ["prompts"];

export interface WidgetContext {
  /** The surface being rendered. Default: "prompts" */
  placement?: WidgetPlacement;
  filters?: {
    q?: string;
    type?: string;
    category?: string;
    categorySlug?: string;
    tag?: string; 
    sort?: string;
    platform?: string;
  };
  page?: number;
  itemCount?: number;
  /**
   * Index of the first item in the overall listing, for paginated surfaces. Positions stay
   * absolute across pages, so a widget at position 30 shows on the second page of 24.
   */
  offset?: number;
}

/**
 * Widget positioning strategy
 * - "once": Show the widget once at the specified position (default)
 * - "repeat": Show the widget repeatedly every `repeatEvery` items
 */
export type WidgetPositionMode = "once" | "repeat";

export interface WidgetPositionConfig {
  /** Where to insert the first occurrence (0-indexed). Default: 2 */
  position?: number;
  /** Positioning mode: "once" (default) or "repeat" */
  mode?: WidgetPositionMode;
  /** For "repeat" mode: insert every N items. e.g., 30 = every 30th position */
  repeatEvery?: number;
  /** Maximum number of times to show this widget. Default: unlimited for repeat, 1 for once */
  maxCount?: number;
}

export interface WidgetPrompt {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  type: "TEXT" | "STRUCTURED";
  structuredFormat?: "json" | "yaml";
  sponsor?: {
    name: string;
    logo: string;
    logoDark?: string;
    url: string;
  };
  tags?: string[];
  category?: string;
  actionUrl?: string;
  actionLabel?: string;
  /** @deprecated Use `positioning.position` instead */
  position?: number;
  /** Widget positioning configuration */
  positioning?: WidgetPositionConfig;
  /** Surfaces this widget is injected into. Default: ["prompts"] */
  placements?: readonly WidgetPlacement[];
  shouldInject?: (context: WidgetContext) => boolean;
  /** Custom render function for completely custom widget designs.
   * instanceIndex is provided for repeated widgets (0-based) to support unique IDs,
   * and placement is the surface the widget is rendered on. */
  render?: (instanceIndex: number, placement: WidgetPlacement) => ReactNode;
}

export interface InjectedWidget extends WidgetPrompt {
  isWidget: true;
  /** 0-based index for repeated widget instances */
  instanceIndex: number;
}

export interface WidgetPlugin {
  id: string;
  name: string;
  prompts: WidgetPrompt[];
}

/**
 * Type guard to check if an item is a widget prompt
 */
export function isWidget(item: unknown): item is InjectedWidget {
  return typeof item === "object" && item !== null && "isWidget" in item && (item as InjectedWidget).isWidget === true;
}
