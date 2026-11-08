import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CLASSIFIERS } from "../../../prisma/classifiers/fixtures";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/seo", () => ({ buildPageMetadata: vi.fn() }));
vi.mock("@/../prompts.config", () => ({ default: { homepage: {}, features: {} } }));
vi.mock("@/lib/classifiers/store", () => ({
  getClassifierCatalog: vi.fn(async () => ({ classifiers: [], chains: [], sources: [] })),
  listedClassifiers: vi.fn(() => []),
  getClassifierVotes: vi.fn(async () => ({ counts: new Map(), voted: new Set() })),
}));

import ClassifiersPage from "@/app/classifiers/page";
import { getClassifierCatalog, listedClassifiers } from "@/lib/classifiers/store";

const author = { id: "user-ada", name: "Ada", username: "ada", avatar: null, verified: false };
const records = CLASSIFIERS.map((c) => ({ ...c, id: `prompt-${c.slug}`, author, isUnlisted: false }));

async function renderPage(searchParams: { q?: string; category?: string } = {}) {
  render(await ClassifiersPage({ searchParams: Promise.resolve(searchParams) }));
}

const cardNames = () =>
  screen.queryAllByTestId("classifier-card").map((card) => within(card).getAllByRole("link")[0].textContent);

beforeEach(() => {
  vi.mocked(getClassifierCatalog).mockResolvedValue({ classifiers: [], chains: [], sources: [] } as never);
  vi.mocked(listedClassifiers).mockReturnValue([]);
});

describe("Classifiers catalog page header", () => {
  it("spans the content width so the create button sits at the grid's right edge", async () => {
    await renderPage();

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

describe("Classifiers catalog sidebar", () => {
  beforeEach(() => {
    vi.mocked(getClassifierCatalog).mockResolvedValue({ classifiers: records, chains: [], sources: [] } as never);
    vi.mocked(listedClassifiers).mockReturnValue(records as never);
  });

  it("puts search and categories in the shared listing sidebar beside the results", async () => {
    await renderPage();
    const aside = document.querySelector("aside")!;
    expect(aside).toHaveClass("lg:w-56", "lg:sticky");
    expect(within(aside).getAllByRole("searchbox")).toHaveLength(2);
    expect(within(aside).getByText("prompts.promptCategory")).toBeInTheDocument();
    expect(within(aside).queryByText("prompts.promptType")).toBeNull();
    expect(within(aside).queryByText("search.sortBy")).toBeNull();
    expect(document.querySelector("main")).toContainElement(screen.getAllByTestId("classifier-card")[0]);
    expect(cardNames()).toHaveLength(records.length);
  });

  it("hydrates the search box and results from the URL", async () => {
    await renderPage({ q: "  groundedness " });
    for (const input of screen.getAllByRole("searchbox") as HTMLInputElement[]) {
      expect(input.value).toBe("groundedness");
    }
    expect(cardNames().length).toBeGreaterThan(0);
    expect(cardNames().length).toBeLessThan(records.length);
  });

  it("applies the category from the URL together with the search", async () => {
    const refund = records.find((c) => c.slug === "refund-eligibility")!;
    await renderPage({ q: "refund", category: refund.category });
    expect(cardNames()).toContain(refund.name);
    const inCategory = new Set(records.filter((c) => c.category === refund.category).map((c) => c.name));
    for (const name of cardNames()) expect(inCategory.has(name!)).toBe(true);
  });

  it("ignores an unknown category instead of hiding everything", async () => {
    await renderPage({ category: "not-a-category" });
    expect(cardNames()).toHaveLength(records.length);
    expect(screen.getAllByText("search.clear")[0].closest("button")).toHaveClass("invisible");
  });

  it("shows the no-results state with a reset link", async () => {
    await renderPage({ q: "zzzz-no-match" });
    expect(screen.getByText("noResults")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "clearFilters" })).toHaveAttribute("href", "/classifiers");
  });

  it("only counts and shows listed classifiers", async () => {
    const [hidden, ...listed] = records;
    vi.mocked(listedClassifiers).mockReturnValue(listed as never);
    await renderPage({ q: hidden.name });
    expect(cardNames()).not.toContain(hidden.name);
  });
});
