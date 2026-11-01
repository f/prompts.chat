import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import type { ReactNode } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../messages/en.json";
import { SpacefastWidgetCard } from "@/components/widgets/spacefast-widget-card";
import { ListingWidgetCard } from "@/components/widgets/listing-widget-card";
import { getWidgetPlugin, injectWidgets, isWidget, type InjectedWidget } from "@/lib/plugins/widgets";
import { SPACEFAST_MCP_REGISTRY_URL, SPACEFAST_URL } from "@/lib/plugins/widgets/spacefast-links";

vi.mock("next-intl", async () => await vi.importActual("next-intl"));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

vi.mock("@/lib/analytics", () => ({
  analyticsWidget: { click: vi.fn(), action: vi.fn(), copy: vi.fn(), view: vi.fn() },
}));

import { analyticsWidget } from "@/lib/analytics";

function withIntl(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

const spacefast = getWidgetPlugin("spacefast")!.prompts[0];

describe("SpacefastWidgetCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the Spacefast brand, copy and logo", () => {
    render(withIntl(<SpacefastWidgetCard widgetId="spacefast-bots-publish" placement="bots" />));
    const card = screen.getByTestId("spacefast-widget");
    expect(within(card).getByText("Spacefast")).toBeInTheDocument();
    expect(within(card).getByText(en.widgets.sponsored)).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Bots that answer with a live link" })).toBeInTheDocument();
    expect(within(card).getByText("live link").className).toContain("sf-widget-gradient");
    expect(within(card).getByText(en.widgets.spacefast.description)).toBeInTheDocument();
    expect(card.querySelector("img")?.getAttribute("src")).toBe("/sponsors/spacefast.svg");
    expect(card.textContent).not.toContain("SpaceFast");
  });

  it("links to spacefast.com and the MCP registry entry", () => {
    render(withIntl(<SpacefastWidgetCard widgetId="spacefast-bots-publish" placement="bots" />));
    const heading = screen.getByRole("link", { name: "Bots that answer with a live link" });
    const connector = screen.getByRole("link", { name: /Add MCP connector/ });
    const site = screen.getByRole("link", { name: /spacefast\.com/ });
    expect(heading).toHaveAttribute("href", SPACEFAST_URL);
    expect(connector).toHaveAttribute("href", SPACEFAST_MCP_REGISTRY_URL);
    expect(site).toHaveAttribute("href", SPACEFAST_URL);
    for (const link of [heading, connector, site]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(SPACEFAST_MCP_REGISTRY_URL).toBe(
      "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.spacefast%2Fmcp/versions/latest"
    );
  });

  it("tracks clicks with the widget id", () => {
    render(withIntl(<SpacefastWidgetCard widgetId="spacefast-bots-publish-1" placement="bots" />));
    fireEvent.click(screen.getByRole("link", { name: "Bots that answer with a live link" }));
    expect(analyticsWidget.click).toHaveBeenCalledWith("spacefast-bots-publish-1", "Spacefast");
    fireEvent.click(screen.getByRole("link", { name: /Add MCP connector/ }));
    expect(analyticsWidget.action).toHaveBeenCalledWith("spacefast-bots-publish-1", "MCP connector", SPACEFAST_MCP_REGISTRY_URL);
    fireEvent.click(screen.getByRole("link", { name: /spacefast\.com/ }));
    expect(analyticsWidget.action).toHaveBeenCalledWith("spacefast-bots-publish-1", "spacefast.com", SPACEFAST_URL);
  });

  it("shows the feature pills only in the taller teams cell", () => {
    const { unmount } = render(withIntl(<SpacefastWidgetCard widgetId="w" placement="bots" />));
    expect(screen.queryByText(en.widgets.spacefast.features.privateByDefault)).not.toBeInTheDocument();
    unmount();
    render(withIntl(<SpacefastWidgetCard widgetId="w" placement="teams" />));
    expect(screen.getByText(en.widgets.spacefast.features.privateByDefault)).toBeInTheDocument();
    expect(screen.getByTestId("spacefast-widget").className).toContain("h-full");
  });
});

describe("ListingWidgetCard", () => {
  it("renders custom widgets with their instance id and placement", () => {
    const [widget] = injectWidgets(Array.from({ length: 10 }, (_, id) => ({ id })), { placement: "bots" }).filter(isWidget);
    render(withIntl(<ListingWidgetCard widget={widget} placement="bots" />));
    expect(screen.getByTestId("spacefast-widget")).toBeInTheDocument();
  });

  it("renders default widgets as compact cards without the content preview", () => {
    const widget: InjectedWidget = {
      ...getWidgetPlugin("commandcode")!.prompts[0],
      placements: ["bots"],
      instanceIndex: 0,
      isWidget: true,
    };
    const { container } = render(withIntl(<ListingWidgetCard widget={widget} placement="bots" />));
    expect(screen.getByText(widget.title)).toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
  });
});

describe("Spacefast widget config", () => {
  it("appears on the bots and teams listings, not the prompts feed", () => {
    expect(spacefast.placements).toEqual(["bots", "teams"]);
    expect(spacefast.render).toBeTypeOf("function");
    expect(spacefast.sponsor?.logo).toBe("/sponsors/spacefast.svg");
    expect(fs.existsSync(path.join(process.cwd(), "public", spacefast.sponsor!.logo))).toBe(true);
  });

  it("has translations in every locale", () => {
    const dir = path.join(process.cwd(), "messages");
    const locales = fs.readdirSync(dir).filter((file) => file.endsWith(".json"));
    expect(locales).toHaveLength(17);
    for (const file of locales) {
      const messages = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const widgets = messages.widgets;
      expect(widgets?.sponsored, file).toBeTruthy();
      for (const key of ["title", "description", "published", "live", "connector"]) {
        expect(widgets.spacefast[key], `${file} ${key}`).toBeTruthy();
      }
      expect(Object.keys(widgets.spacefast.features).sort(), file).toEqual(["privateByDefault", "sameLink", "versionHistory"]);
      expect(widgets.spacefast.title, file).toMatch(/<hl>.+<\/hl>/);
      expect(JSON.stringify(widgets), file).not.toContain("SpaceFast");
    }
  });
});
