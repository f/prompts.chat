import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareDropdown, buildEmbedSnippet, buildEmbedUrl } from "@/components/prompts/share-dropdown";
import { toast } from "sonner";
import { analyticsPrompt } from "@/lib/analytics";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/analytics", () => ({
  analyticsPrompt: {
    share: vi.fn(),
  },
}));

describe("embed share helpers", () => {
  it("builds an /embed URL for the current prompt", () => {
    expect(buildEmbedUrl("https://prompts.chat", "Hello & world")).toBe(
      "https://prompts.chat/embed?prompt=Hello%20%26%20world"
    );
  });

  it("builds a one-line iframe snippet", () => {
    const url = buildEmbedUrl("https://prompts.chat", "Hi");
    expect(buildEmbedSnippet(url, 'Say "hi"')).toBe(
      `<iframe src="${url}" title="Say &quot;hi&quot;" width="100%" height="400" style="border:0"></iframe>`
    );
  });
});

describe("ShareDropdown embed actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  /** Renders the menu and opens it. */
  async function openMenu(ui: ReactElement) {
    const user = userEvent.setup();
    render(ui);
    await user.click(screen.getByRole("button"));
    return user;
  }

  it("copies the embed URL for the current prompt", async () => {
    const user = await openMenu(
      <ShareDropdown title="Greeting" prompt="Hello there" promptId="prompt-1" />
    );
    await user.click(await screen.findByRole("menuitem", { name: "copyEmbedUrl" }));

    const expected = buildEmbedUrl(window.location.origin, "Hello there");
    expect(await navigator.clipboard.readText()).toBe(expected);
    expect(toast.success).toHaveBeenCalledWith("urlCopied");
    expect(analyticsPrompt.share).toHaveBeenCalledWith("prompt-1", "embed");
  });

  it("copies a small iframe snippet", async () => {
    const user = await openMenu(
      <ShareDropdown title="Greeting" prompt="Hello there" promptId="prompt-1" />
    );
    await user.click(await screen.findByRole("menuitem", { name: "copyEmbedCode" }));

    const expected = buildEmbedSnippet(
      buildEmbedUrl(window.location.origin, "Hello there"),
      "Greeting"
    );
    expect(await navigator.clipboard.readText()).toBe(expected);
    expect(analyticsPrompt.share).toHaveBeenCalledWith("prompt-1", "embed_iframe");
  });

  it("hides embed actions when there is no prompt text", async () => {
    await openMenu(<ShareDropdown title="Greeting" />);

    expect(screen.getByRole("menuitem", { name: "X / Twitter" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "copyEmbedUrl" })).not.toBeInTheDocument();
  });
});
