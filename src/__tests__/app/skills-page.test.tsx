import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("@/lib/seo", () => ({ buildPageMetadata: vi.fn() }));
vi.mock("@/lib/ai/generation", () => ({ isAIGenerationEnabled: vi.fn(async () => false) }));
vi.mock("@/../prompts.config", () => ({ default: { homepage: { useCloneBranding: true }, features: {} } }));
vi.mock("@/components/prompts/infinite-prompt-list", () => ({
  InfinitePromptList: (props: { initialPrompts: { id: string }[]; filters: object; emptyTitle?: string }) => (
    <div data-testid="skill-list" data-filters={JSON.stringify(props.filters)} data-empty-title={props.emptyTitle}>
      {props.initialPrompts.map((p) => p.id).join(",")}
    </div>
  ),
}));

import SkillsPage from "@/app/skills/page";
import { db } from "@/lib/db";

const skill = (id: string) => ({ id, title: id, _count: { votes: 2, contributors: 0 }, contributors: [] });

async function renderPage(searchParams: { q?: string; sort?: string } = {}) {
  render(await SkillsPage({ searchParams: Promise.resolve(searchParams) }));
}

const list = () => screen.getByTestId("skill-list");
const listFilters = () => JSON.parse(list().dataset.filters!);
const queriedWhere = () => vi.mocked(db.prompt.findMany).mock.calls[0][0]!.where;

beforeEach(() => {
  vi.mocked(db.prompt.findMany).mockReset().mockResolvedValue([skill("a"), skill("b")] as never);
  vi.mocked(db.prompt.count).mockReset().mockResolvedValue(2);
});

describe("Skills page search", () => {
  it("shows the shared listing sidebar with search and sort, but no type, category or tag filters", async () => {
    await renderPage();
    const aside = document.querySelector("aside")!;
    expect(aside).toHaveClass("lg:w-56", "lg:sticky");
    const inputs = within(aside).getAllByRole("searchbox");
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toHaveAttribute("placeholder", "searchSkillsPlaceholder");
    expect(within(aside).getByText("search.sortBy")).toBeInTheDocument();
    expect(within(aside).queryByText("prompts.promptType")).toBeNull();
    expect(within(aside).queryByText("prompts.promptCategory")).toBeNull();
    expect(document.querySelector("main")).toContainElement(list());
  });

  it("lists public skills when there is no query", async () => {
    await renderPage();
    expect(queriedWhere()).toEqual({ type: "SKILL", isPrivate: false, isUnlisted: false, deletedAt: null });
    expect(list()).toHaveTextContent("a,b");
    expect(listFilters()).toEqual({ type: "SKILL" });
  });

  it("hydrates the search from the URL and passes the same query to further pages", async () => {
    await renderPage({ q: "  deploy ", sort: "upvotes" });
    for (const input of screen.getAllByRole("searchbox") as HTMLInputElement[]) expect(input.value).toBe("deploy");
    expect(queriedWhere()).toMatchObject({
      type: "SKILL",
      isPrivate: false,
      isUnlisted: false,
      deletedAt: null,
      OR: [
        { title: { contains: "deploy", mode: "insensitive" } },
        { content: { contains: "deploy", mode: "insensitive" } },
        { description: { contains: "deploy", mode: "insensitive" } },
      ],
    });
    expect(vi.mocked(db.prompt.findMany).mock.calls[0][0]!.orderBy).toEqual({ votes: { _count: "desc" } });
    expect(listFilters()).toEqual({ q: "deploy", type: "SKILL", sort: "upvotes" });
  });

  it("shows the clear action only once a filter is active", async () => {
    await renderPage();
    expect(screen.getByText("search.clear").closest("button")).toHaveClass("invisible");
  });

  it("names skills in the empty state", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);
    await renderPage({ q: "zzzz" });
    expect(list()).toHaveAttribute("data-empty-title", "noSkills");
    expect(list()).toBeEmptyDOMElement();
    expect(screen.getByText("search.clear").closest("button")).toHaveClass("visible");
  });
});

describe("InfinitePromptList empty state", () => {
  it("uses the listing's own title and falls back to prompts", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    const { InfinitePromptList } = await vi.importActual<typeof import("@/components/prompts/infinite-prompt-list")>(
      "@/components/prompts/infinite-prompt-list"
    );
    const { unmount } = render(<InfinitePromptList initialPrompts={[]} initialTotal={0} filters={{ q: "zz", type: "SKILL" }} emptyTitle="No skills found" />);
    expect(screen.getByRole("heading", { name: "No skills found" })).toBeInTheDocument();
    expect(screen.getByText("noPromptsDescription")).toBeInTheDocument();
    unmount();
    render(<InfinitePromptList initialPrompts={[]} initialTotal={0} filters={{}} />);
    expect(screen.getByRole("heading", { name: "noPrompts" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
