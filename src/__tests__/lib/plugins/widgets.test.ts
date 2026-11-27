import { describe, it, expect } from "vitest";
import {
  DEFAULT_WIDGET_PLACEMENTS,
  getWidgetPlugin,
  getWidgetPrompts,
  getWidgetPromptsForPlacement,
  injectWidgets,
  isWidget,
  widgetHasPlacement,
  type InjectedWidget,
  type WidgetPrompt,
} from "@/lib/plugins/widgets";

const items = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ id: `item-${start + i}` }));
const widgetIds = (list: unknown[]) => list.filter(isWidget).map((item) => (item as InjectedWidget).id);
const widgetSlots = (list: unknown[], id: string) =>
  list.flatMap((item, index) => (isWidget(item) && item.id.startsWith(id) ? [index] : []));

describe("widget placements", () => {
  it("defaults widgets without placements to the prompts feed", () => {
    expect(DEFAULT_WIDGET_PLACEMENTS).toEqual(["prompts"]);
    const widget = { id: "x", placements: undefined } as unknown as WidgetPrompt;
    expect(widgetHasPlacement(widget, "prompts")).toBe(true);
    expect(widgetHasPlacement(widget, "bots")).toBe(false);
    expect(widgetHasPlacement(widget, "teams")).toBe(false);
  });

  it("keeps the existing widgets on prompts only", () => {
    for (const id of ["coderabbit", "book", "textream", "commandcode"]) {
      const plugin = getWidgetPlugin(id)!;
      for (const widget of plugin.prompts) {
        expect(widgetHasPlacement(widget, "prompts")).toBe(true);
        expect(widgetHasPlacement(widget, "bots")).toBe(false);
        expect(widgetHasPlacement(widget, "teams")).toBe(false);
      }
    }
  });

  it("returns only the widgets declared for a surface", () => {
    const bots = getWidgetPromptsForPlacement("bots").map((widget) => widget.id);
    const prompts = getWidgetPromptsForPlacement("prompts").map((widget) => widget.id);
    expect(bots).toEqual(["spacefast-bots-publish"]);
    expect(prompts).not.toContain("spacefast-bots-publish");
    expect(prompts).toEqual(
      getWidgetPrompts()
        .filter((widget) => !widget.placements)
        .map((widget) => widget.id)
    );
  });
});

describe("injectWidgets", () => {
  it("leaves the prompts feed unchanged when no placement is given", () => {
    const result = injectWidgets(items(100));
    expect(widgetIds(result)).not.toContain("spacefast-bots-publish");
    // CodeRabbit: position 2, every 50, max 3; the last one appends after the 100th item
    expect(widgetSlots(result, "coderabbit-code-review")).toHaveLength(3);
    expect(result.length).toBeGreaterThan(100);
    expect(injectWidgets(items(100), { placement: "prompts" })).toEqual(result);
  });

  it("injects only bots widgets on the bots surface", () => {
    const result = injectWidgets(items(24), { placement: "bots" });
    expect(widgetIds(result)).toEqual(["spacefast-bots-publish"]);
    expect(result).toHaveLength(25);
    // Position 4: before the fifth bot
    expect(widgetSlots(result, "spacefast-bots-publish")).toEqual([4]);
  });

  it("injects on the teams surface", () => {
    const result = injectWidgets(items(10), { placement: "teams" });
    expect(widgetIds(result)).toEqual(["spacefast-bots-publish"]);
  });

  it("asks shouldInject with the placement and filters", () => {
    expect(widgetIds(injectWidgets(items(24), { placement: "bots", filters: { category: "dev" } }))).toEqual([]);
    expect(widgetIds(injectWidgets(items(24), { placement: "bots", filters: { q: "dashboard" } }))).toEqual(["spacefast-bots-publish"]);
    expect(widgetIds(injectWidgets(items(24), { placement: "bots", filters: { q: "email" } }))).toEqual([]);
  });

  it("skips listings that are shorter than the widget's position", () => {
    expect(widgetIds(injectWidgets(items(3), { placement: "bots" }))).toEqual([]);
    expect(injectWidgets([], { placement: "bots" })).toEqual([]);
  });

  describe("paginated listings", () => {
    // Spacefast: position 4, every 48, max 3 => listing positions 4, 52, 100
    const page = (number: number, total: number, perPage = 24) => {
      const offset = (number - 1) * perPage;
      return injectWidgets(items(Math.min(perPage, total - offset), offset), { placement: "bots", offset }, { totalItems: total });
    };

    it("counts positions across pages instead of restarting on each page", () => {
      const total = 200;
      expect(widgetSlots(page(1, total), "spacefast")).toEqual([4]);
      expect(widgetSlots(page(2, total), "spacefast")).toEqual([]);
      expect(widgetSlots(page(3, total), "spacefast")).toEqual([52 - 48]);
      expect(widgetSlots(page(5, total), "spacefast")).toEqual([100 - 96]);
      expect(widgetSlots(page(7, total), "spacefast")).toEqual([]);
    });

    it("keeps instance ids unique across pages", () => {
      const total = 200;
      expect(widgetIds(page(1, total))).toEqual(["spacefast-bots-publish"]);
      expect(widgetIds(page(3, total))).toEqual(["spacefast-bots-publish-1"]);
      expect(widgetIds(page(5, total))).toEqual(["spacefast-bots-publish-2"]);
      expect((page(3, total).find(isWidget) as InjectedWidget).instanceIndex).toBe(1);
    });

    it("leaves a position at a page boundary to the next page", () => {
      // Position 52 is the first item of page 2 with 52 per page; position 100 follows 48 items later
      expect(widgetSlots(page(1, 200, 52), "spacefast")).toEqual([4]);
      expect(widgetSlots(page(2, 200, 52), "spacefast")).toEqual([0, 49]);
    });

    it("appends a widget positioned right after the last item of the listing", () => {
      expect(widgetSlots(page(1, 4), "spacefast")).toEqual([4]);
    });
  });
});
