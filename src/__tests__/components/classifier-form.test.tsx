import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ClassifierForm } from "@/components/classifiers/classifier-form";
import { configFromDefinition } from "@/lib/classifiers/schema";
import { CLASSIFIERS } from "../../../prisma/classifiers/fixtures";

const definition = CLASSIFIERS.find((c) => c.slug === "refund-eligibility")!;
const initial = {
  title: definition.name,
  fields: { description: definition.summary, config: configFromDefinition(definition) },
  isPrivate: false,
};

describe("ClassifierForm step tabs", () => {
  beforeEach(() => {
    // The Radix switch measures itself; jsdom has no ResizeObserver
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps text labels as tab names with decorative icons and marks the current and completed steps", () => {
    render(<ClassifierForm mode="edit" promptId="p1" classifierSlug={definition.slug} initial={initial} sourceIds={[]} />);

    const steps = within(screen.getByRole("list", { name: "steps" })).getAllByRole("button");
    expect(steps.map((b) => b.textContent)).toEqual(
      ["basics", "input", "question", "outcomes", "scenarios", "review"].map((id) => `step.${id}`)
    );
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    for (const button of steps) {
      const icons = button.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(0);
      icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
    }
    expect(steps[0].querySelectorAll("svg")).toHaveLength(1);
    expect(steps[1].querySelectorAll("svg")).toHaveLength(2);
  });

  it("shows an icon on each question type card without changing the radio semantics", () => {
    render(<ClassifierForm mode="edit" promptId="p1" classifierSlug={definition.slug} initial={initial} sourceIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "step.question" }));

    const radios = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    radios.forEach((radio) => expect(radio.querySelector("svg")).toHaveAttribute("aria-hidden", "true"));
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[0].querySelector("svg")).toHaveClass("text-primary");

    fireEvent.click(radios[1]);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
  });
});
