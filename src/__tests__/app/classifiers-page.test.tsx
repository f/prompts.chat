import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/seo", () => ({ buildPageMetadata: vi.fn() }));
vi.mock("@/lib/classifiers/store", () => ({
  getClassifierCatalog: vi.fn(async () => ({ classifiers: [], chains: [], sources: [] })),
  listedClassifiers: vi.fn(() => []),
  getClassifierVotes: vi.fn(async () => ({ counts: new Map(), voted: new Set() })),
}));

import ClassifiersPage from "@/app/classifiers/page";

describe("Classifiers catalog page header", () => {
  it("spans the content width so the create button sits at the grid's right edge", async () => {
    render(await ClassifiersPage({ searchParams: Promise.resolve({}) }));

    const header = screen.getByTestId("classifiers-header");
    const heading = screen.getByRole("heading", { level: 1, name: "heading" });
    const create = screen.getByRole("link", { name: "create" });
    expect(header).toContainElement(heading);
    expect(header).toContainElement(create);
    expect(create).toHaveAttribute("href", "/classifiers/new");
    expect(header).toHaveClass("justify-between", "flex-wrap");

    for (let el: HTMLElement | null = header; el; el = el.parentElement) {
      expect(el.className).not.toMatch(/\bmax-w-/);
    }
    expect(screen.getByText("intro")).toHaveClass("max-w-3xl");
    expect(screen.getByText("disclaimerTitle").closest("div")).toHaveClass("max-w-3xl");
  });
});
