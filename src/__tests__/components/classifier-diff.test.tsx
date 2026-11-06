import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassifierDiff } from "@/components/classifiers/classifier-diff";
import { configFromDefinition } from "@/lib/classifiers/schema";
import { CLASSIFIERS } from "../../../prisma/classifiers/fixtures";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const definition = CLASSIFIERS.find((c) => c.slug === "ticket-urgency")!;
const fields = () => structuredClone({ description: definition.summary, config: configFromDefinition(definition) });

describe("ClassifierDiff", () => {
  it("shows the old and new text of a changed option, not only its key", () => {
    const modified = fields();
    const option = modified.config.question.options[0];
    const before = option.description;
    option.description = "A rewritten level description";

    const { container } = render(
      <ClassifierDiff original={{ title: definition.name, fields: fields() }} modified={{ title: definition.name, fields: modified }} />
    );

    expect(screen.getByText("classifierFields.options")).toBeInTheDocument();
    const added = [...container.querySelectorAll("span.bg-green-500\\/20")].map((s) => s.textContent).join(" ");
    const removed = [...container.querySelectorAll("span.line-through")].map((s) => s.textContent).join(" ");
    expect(added).toMatch(/rewritten/);
    expect(removed.length).toBeGreaterThan(0);
    expect(before).toContain(removed.trim().split(/\s+/)[0]);
    expect(container.querySelectorAll("li[data-diff]")).toHaveLength(0);
  });

  it("keeps chips for plain lists such as tags", () => {
    const modified = fields();
    modified.config.tags = [...modified.config.tags, "new-tag"];
    const { container } = render(
      <ClassifierDiff original={{ title: definition.name, fields: fields() }} modified={{ title: definition.name, fields: modified }} />
    );
    expect(container.querySelector('li[data-diff="added"]')?.textContent).toContain("new-tag");
  });
});
