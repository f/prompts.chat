import {
  DEFAULT_WIDGET_PLACEMENTS,
  type WidgetPlugin,
  type WidgetPrompt,
  type WidgetContext,
  type WidgetPlacement,
  type InjectedWidget,
} from "./types";
import { coderabbitWidget } from "./coderabbit";
import { bookWidget } from "./book";
import { textreamWidget } from "./textream";
import { commandcodeWidget } from "./commandcode";
import { spacefastWidget } from "./spacefast";

export * from "./types";

// Registry of all widget plugins
const widgetPlugins: WidgetPlugin[] = [
  coderabbitWidget,
  bookWidget,
  textreamWidget,
  commandcodeWidget,
  spacefastWidget,
];

/**
 * Get all registered widget plugins
 */
export function getWidgetPlugins(): WidgetPlugin[] {
  return widgetPlugins;
}

/**
 * Get all widget prompts
 */
export function getWidgetPrompts(): WidgetPrompt[] {
  return widgetPlugins.flatMap((plugin) => plugin.prompts);
}

/**
 * Get a specific widget plugin by ID
 */
export function getWidgetPlugin(id: string): WidgetPlugin | undefined {
  return widgetPlugins.find((plugin) => plugin.id === id);
}

/**
 * Get a specific prompt from a widget plugin
 */
export function getWidgetPrompt(pluginId: string, promptId: string): WidgetPrompt | undefined {
  const plugin = getWidgetPlugin(pluginId);
  return plugin?.prompts.find((prompt) => prompt.id === promptId);
}

/**
 * Whether a widget appears on the given surface; widgets without `placements` stay on prompts
 */
export function widgetHasPlacement(widget: WidgetPrompt, placement: WidgetPlacement): boolean {
  return (widget.placements ?? DEFAULT_WIDGET_PLACEMENTS).includes(placement);
}

/**
 * Get the widget prompts that appear on the given surface
 */
export function getWidgetPromptsForPlacement(placement: WidgetPlacement): WidgetPrompt[] {
  return getWidgetPrompts().filter((widget) => widgetHasPlacement(widget, placement));
}

/**
 * Calculate all insertion positions for a widget based on its positioning config
 */
function getWidgetInsertionPositions(
  widget: WidgetPrompt,
  totalItems: number
): number[] {
  const config = widget.positioning;
  const mode = config?.mode ?? "once";
  // Support legacy `position` field, fallback to positioning.position, then default to 2
  const startPosition = config?.position ?? widget.position ?? 2;
  
  if (mode === "once") {
    const maxCount = config?.maxCount ?? 1;
    return maxCount > 0 ? [startPosition] : [];
  }
  
  // Repeat mode
  const repeatEvery = config?.repeatEvery ?? 30;
  const maxCount = config?.maxCount; // undefined = unlimited
  const positions: number[] = [];
  
  let currentPosition = startPosition;
  let count = 0;
  
  // Generate positions until we exceed the total items or hit maxCount
  while (currentPosition <= totalItems + positions.length) {
    if (maxCount !== undefined && count >= maxCount) break;
    positions.push(currentPosition);
    currentPosition += repeatEvery;
    count++;
  }
  
  return positions;
}

/**
 * Inject widget prompts into a list of items.
 * Each widget defines its own shouldInject logic and positioning strategy.
 * 
 * Positioning modes:
 * - "once": Insert widget once at the specified position (default)
 * - "repeat": Insert widget every N items (configured via repeatEvery)
 * 
 * Only widgets whose `placements` include `context.placement` (default "prompts") are injected.
 * For paginated surfaces, pass `context.offset` (index of the page's first item) so positions
 * are counted across the whole listing rather than restarting on every page.
 *
 * @param items - The original list of items
 * @param context - Context passed to each widget's shouldInject function
 * @returns A new array with widget prompts injected, marked with { isWidget: true }
 */
export function injectWidgets<T>(
  items: T[],
  context: WidgetContext = {},
  { totalItems }: { totalItems?: number } = {}
): (T | InjectedWidget)[] {
  const placement = context.placement ?? "prompts";
  const widgetPrompts = getWidgetPromptsForPlacement(placement);
  
  if (widgetPrompts.length === 0 || items.length === 0) {
    return items;
  }

  const pageStart = Math.max(0, context.offset ?? 0);
  const pageEnd = pageStart + items.length;
  // Without a known total, the page is treated as the end of the listing
  const total = Math.max(totalItems ?? pageEnd, pageEnd);
  const isLastPage = pageEnd >= total;

  // Filter widgets that should be injected based on their own logic
  const widgetsToInject = widgetPrompts.filter((widget) => {
    if (widget.shouldInject) {
      return widget.shouldInject({ ...context, itemCount: items.length });
    }
    // Default: inject if no filters are active
    return !context.filters?.q && !context.filters?.category && !context.filters?.tag;
  });

  if (widgetsToInject.length === 0) {
    return items;
  }

  // Collect all insertions: { position, widget, instanceIndex }
  const insertions: { position: number; widget: WidgetPrompt; instanceIndex: number }[] = [];
  
  for (const widget of widgetsToInject) {
    const positions = getWidgetInsertionPositions(widget, total);
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      // Positions past the page belong to later pages, except on the last page where they append
      if (position < pageStart || (position >= pageEnd && !isLastPage)) continue;
      insertions.push({ position: position - pageStart, widget, instanceIndex: i });
    }
  }
  
  // Sort insertions by position (ascending) for correct offset calculation
  insertions.sort((a, b) => a.position - b.position);

  const result: (T | InjectedWidget)[] = [...items];
  
  // Inject widgets at their calculated positions
  let offset = 0;
  for (const insertion of insertions) {
    const insertAt = Math.min(insertion.position + offset, result.length);
    const instanceId = insertion.instanceIndex > 0
      ? `${insertion.widget.id}-${insertion.instanceIndex}`
      : insertion.widget.id;
    result.splice(insertAt, 0, { ...insertion.widget, id: instanceId, instanceIndex: insertion.instanceIndex, isWidget: true as const });
    offset++;
  }

  return result;
}
