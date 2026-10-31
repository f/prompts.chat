import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BotComputerBadges } from "@/components/bots/bot-computer-badge";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => ({ cloud: "Needs a cloud computer", local: "Needs your computer" })[key] ?? key,
}));

function renderBadges(props: Parameters<typeof BotComputerBadges>[0]) {
  return render(
    <TooltipProvider>
      <BotComputerBadges {...props} />
    </TooltipProvider>
  );
}

describe("BotComputerBadges", () => {
  it("renders nothing for bots that need no computer", () => {
    expect(renderBadges({ requirements: [] }).container).toBeEmptyDOMElement();
    expect(renderBadges({ requirements: null }).container).toBeEmptyDOMElement();
  });

  it("is a labelled, focusable icon by default", () => {
    renderBadges({ requirements: ["CLOUD"] });
    const badge = screen.getByRole("img", { name: "Needs a cloud computer" });
    expect(badge).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("img", { name: "Needs your computer" })).not.toBeInTheDocument();
  });

  it("shows both icons side by side, cloud first, without duplicates", () => {
    renderBadges({ requirements: ["LOCAL", "CLOUD", "LOCAL"] });
    expect(screen.getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))).toEqual([
      "Needs a cloud computer",
      "Needs your computer",
    ]);
  });

  it("stays out of the tab order when it sits inside a link", () => {
    renderBadges({ requirements: ["CLOUD", "LOCAL"], focusable: false });
    for (const badge of screen.getAllByRole("img")) expect(badge).not.toHaveAttribute("tabindex");
  });
});
