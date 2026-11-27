import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChipListDiff } from "@/components/changes/chip-list-diff";
import { FieldDiffList } from "@/components/changes/field-diff-list";
import { textItems } from "@/lib/list-diff";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ChipListDiff", () => {
  it("renders one chip per item, marking added and removed ones", () => {
    const { container } = render(
      <ChipListDiff original={textItems(["OpenClaw", "Hermes Agent"])} modified={textItems(["Grok Bot", "OpenClaw"])} />
    );
    const chips = [...container.querySelectorAll("li")].map((li) => [li.getAttribute("data-diff"), li.textContent]);
    expect(chips).toEqual([
      ["added", "added: Grok Bot"],
      ["unchanged", "OpenClaw"],
      ["removed", "removed: Hermes Agent"],
    ]);
    expect(screen.getByText("Hermes Agent").closest("[data-slot], span")?.className).toContain("line-through");
  });
});

describe("FieldDiffList", () => {
  it("shows list fields as chips without the diff frame and text fields with it", () => {
    const { container } = render(
      <FieldDiffList
        fields={[
          { key: "platforms", label: "Platforms", original: "OpenClaw", modified: "OpenClaw, Hermes Agent", items: { original: textItems(["OpenClaw"]), modified: textItems(["OpenClaw", "Hermes Agent"]) } },
          { key: "description", label: "Description", original: "Old", modified: "New" },
        ]}
      />
    );
    expect(container.querySelectorAll("li[data-diff]")).toHaveLength(2);
    expect(screen.getAllByText(/tokens/)).toHaveLength(2);
    expect(screen.getByText("Platforms").nextElementSibling?.textContent).not.toMatch(/tokens/);
  });
});
