import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InjectedActionButton } from "@/components/action-buttons/injected-action-button";
import { getActionButtonForCategory } from "@/lib/plugins/action-buttons";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string>) =>
      values?.platform ? `${key}:${values.platform}` : key;
    t.has = (key: string) => key === "deployWithSpacefast";
    return t;
  },
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/lib/analytics", () => ({
  analyticsActionButton: { click: vi.fn() },
}));

import { analyticsActionButton } from "@/lib/analytics";

const action = getActionButtonForCategory({ slug: "vibe" })!;
const prefix = action.promptPrefix;

describe("InjectedActionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("renders the Spacefast logo and label", () => {
    render(<InjectedActionButton action={action} content="Build a todo app" />);
    const trigger = screen.getByRole("button", { name: /deployWithSpacefast/ });
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe("/sponsors/spacefast.svg");
  });

  it("opens prefilled agents with the deploy prefix", () => {
    render(<InjectedActionButton action={action} content="Build a todo app" promptId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /deployWithSpacefast/ }));
    fireEvent.click(screen.getByRole("button", { name: /^ChatGPT$/ }));

    expect(window.open).toHaveBeenCalledWith(
      `https://chatgpt.com/?q=${encodeURIComponent(`${prefix}Build a todo app`)}`,
      "_blank"
    );
    expect(analyticsActionButton.click).toHaveBeenCalledWith("spacefast-deploy", "p1", "ChatGPT");
  });

  it("copies the prefixed prompt for agents without a prefill URL", () => {
    render(<InjectedActionButton action={action} content="Build a todo app" />);
    fireEvent.click(screen.getByRole("button", { name: /deployWithSpacefast/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Claude Code$/ }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${prefix}Build a todo app`);
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.getByText("promptCopiedDescription:Claude Code")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "openPlatform:Claude Code" }));
    expect(window.open).toHaveBeenCalledWith("https://claude.ai/code", "_blank");
  });

  it("asks for unfilled variables before launching", () => {
    const getContentWithVariables = (values: Record<string, string>) => `Build a ${values.app} app`;
    render(
      <InjectedActionButton
        action={action}
        content="Build a ${app} app"
        unfilledVariables={[{ name: "app", defaultValue: "" }]}
        getContentWithVariables={getContentWithVariables}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /deployWithSpacefast/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Claude$/ }));
    expect(window.open).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("app"), { target: { value: "notes" } });
    const submitButtons = screen.getAllByRole("button", { name: "deployWithSpacefast" });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    expect(window.open).toHaveBeenCalledWith(
      `https://claude.ai/new?q=${encodeURIComponent(`${prefix}Build a notes app`)}`,
      "_blank"
    );
  });
});
