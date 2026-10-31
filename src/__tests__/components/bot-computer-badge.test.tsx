import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BotComputerBadge } from "@/components/bots/bot-computer-badge";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => ({ cloud: "Needs a cloud computer", local: "Needs your computer" })[key] ?? key,
}));

function renderBadge(props: Parameters<typeof BotComputerBadge>[0]) {
  return render(
    <TooltipProvider>
      <BotComputerBadge {...props} />
    </TooltipProvider>
  );
}

describe("BotComputerBadge", () => {
  it("renders nothing for bots that need no computer", () => {
    const { container } = renderBadge({ requirement: "NONE" });
    expect(container).toBeEmptyDOMElement();
  });

  it("is a labelled, focusable icon by default", () => {
    renderBadge({ requirement: "CLOUD" });
    const badge = screen.getByRole("img", { name: "Needs a cloud computer" });
    expect(badge).toHaveAttribute("tabindex", "0");
  });

  it("stays out of the tab order when it sits inside a link", () => {
    renderBadge({ requirement: "LOCAL", focusable: false });
    const badge = screen.getByRole("img", { name: "Needs your computer" });
    expect(badge).not.toHaveAttribute("tabindex");
  });
});
