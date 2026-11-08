import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));
vi.mock("@/../prompts.config", () => ({ default: { homepage: {}, features: {} } }));
vi.mock("@/lib/analytics", () => ({
  analyticsSearch: { search: vi.fn(), filter: vi.fn(), sort: vi.fn(), clearFilters: vi.fn(), aiSearchToggle: vi.fn() },
}));

import { PromptFilters } from "@/components/prompts/prompt-filters";

const categories = [
  { id: "support", name: "Support", slug: "support", parentId: null, count: 3 },
  { id: "security", name: "Security", slug: "security", parentId: null, count: 2 },
];

function renderFilters(props: Partial<Parameters<typeof PromptFilters>[0]> = {}) {
  return render(
    <PromptFilters
      categories={categories}
      tags={[]}
      currentFilters={{}}
      basePath="/classifiers"
      primaryFilter={null}
      showSort={false}
      searchPlaceholder="Search classifiers"
      {...props}
    />
  );
}

const desktopSearch = () => screen.getByLabelText("search.search", { selector: "#listing-search" }) as HTMLInputElement;
const searchboxes = () => screen.getAllByRole("searchbox") as HTMLInputElement[];

beforeEach(() => {
  vi.useFakeTimers();
  push.mockClear();
  searchParams = new URLSearchParams();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PromptFilters", () => {
  it("labels both search inputs and the mobile filter toggle", () => {
    renderFilters();
    expect(searchboxes()).toHaveLength(2);
    for (const input of searchboxes()) {
      expect(input).toHaveAccessibleName("search.search");
      expect(input).toHaveAttribute("placeholder", "Search classifiers");
    }
    const toggle = screen.getByRole("button", { name: "search.filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the type select when the listing has no primary filter", () => {
    renderFilters();
    expect(screen.queryByText("prompts.promptType")).toBeNull();
    expect(screen.getByText("prompts.promptCategory")).toBeInTheDocument();
  });

  it("keeps the prompt type select by default", () => {
    renderFilters({ primaryFilter: undefined, basePath: "/prompts" });
    expect(screen.getByText("prompts.promptType")).toBeInTheDocument();
  });

  it("hides category, sort and tags when a listing has none", () => {
    renderFilters({ categories: [], basePath: "/skills", showSort: true });
    expect(screen.queryByText("prompts.promptCategory")).toBeNull();
    expect(screen.queryByText("prompts.promptTags")).toBeNull();
    expect(screen.getByText("search.sortBy")).toBeInTheDocument();
  });

  it("pushes a debounced search to the listing URL, keeping the category and dropping the page", () => {
    searchParams = new URLSearchParams("category=security&page=3");
    renderFilters({ currentFilters: { category: "security" } });
    fireEvent.change(desktopSearch(), { target: { value: "jailbreak" } });
    expect(push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/classifiers");
    expect(url.searchParams.get("q")).toBe("jailbreak");
    expect(url.searchParams.get("category")).toBe("security");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("removes the query when the search is emptied", () => {
    searchParams = new URLSearchParams("q=refund&category=support");
    renderFilters({ currentFilters: { q: "refund", category: "support" } });
    fireEvent.change(desktopSearch(), { target: { value: "" } });
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledWith("/classifiers?category=support");
  });

  it("clears every filter at once and cancels a pending search", () => {
    searchParams = new URLSearchParams("q=refund&category=support");
    renderFilters({ currentFilters: { q: "refund", category: "support" } });
    fireEvent.change(desktopSearch(), { target: { value: "refunds" } });
    fireEvent.click(screen.getByRole("button", { name: "search.clear" }));
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/classifiers");
  });

  it("starts from the query in the URL and follows it on back/forward navigation", () => {
    const { rerender } = renderFilters({ currentFilters: { q: "fraud" } });
    expect(searchboxes().map((i) => i.value)).toEqual(["fraud", "fraud"]);

    const props = { categories, tags: [], basePath: "/classifiers", primaryFilter: null, showSort: false };
    rerender(<PromptFilters {...props} currentFilters={{ q: "refund" }} />);
    expect(searchboxes().map((i) => i.value)).toEqual(["refund", "refund"]);

    rerender(<PromptFilters {...props} currentFilters={{}} />);
    expect(searchboxes().map((i) => i.value)).toEqual(["", ""]);
  });

  it("does not overwrite the input the visitor is typing in", () => {
    const { rerender } = renderFilters({ currentFilters: { q: "ref" } });
    const input = desktopSearch();
    input.focus();
    fireEvent.change(input, { target: { value: "refund" } });
    const props = { categories, tags: [], basePath: "/classifiers", primaryFilter: null, showSort: false };
    rerender(<PromptFilters {...props} currentFilters={{ q: "refu" }} />);
    expect(input.value).toBe("refund");
  });
});
