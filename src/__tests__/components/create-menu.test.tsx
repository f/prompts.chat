import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateMenu } from "@/components/layout/create-menu";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("CreateMenu", () => {
  it("opens a menu linking to the prompt, skill, bot and team create flows", async () => {
    render(<CreateMenu />);

    await userEvent.click(screen.getByRole("button", { name: "label" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual([
      ["prompt", "/prompts/new"],
      ["skill", "/prompts/new?type=SKILL"],
      ["bot", "/bots/new"],
      ["team", "/bots/teams/new"],
    ]);
  });
});
