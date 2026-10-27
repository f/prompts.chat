import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { generateMetadata } from "@/app/prompts/(list)/page";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" }, features: {}, homepage: {} },
}));


vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T>(fn: T) => fn,
}));

vi.mock("@/lib/db", () => ({
  db: {
    category: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/ai/embeddings", () => ({ isAISearchEnabled: vi.fn(), semanticSearch: vi.fn() }));
vi.mock("@/lib/ai/generation", () => ({ isAIGenerationEnabled: vi.fn() }));
vi.mock("@/components/prompts/infinite-prompt-list", () => ({ InfinitePromptList: () => null }));
vi.mock("@/components/prompts/prompt-filters", () => ({ PromptFilters: () => null }));
vi.mock("@/components/prompts/filter-context", () => ({ FilterProvider: () => null }));
vi.mock("@/components/categories/pinned-categories", () => ({ PinnedCategories: () => null }));
vi.mock("@/components/prompts/hf-data-studio-dropdown", () => ({ HFDataStudioDropdown: () => null }));
vi.mock("@/components/mcp/mcp-server-popup", () => ({ McpServerPopup: () => null }));

function metadataFor(searchParams: Record<string, string>) {
  return generateMetadata({ searchParams: Promise.resolve(searchParams) });
}

describe("/prompts metadata", () => {
  beforeEach(() => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: "cat1", name: "Coding", slug: "coding", parentId: null },
    ] as never);
    vi.mocked(db.tag.findMany).mockResolvedValue([{ id: "tag1", name: "Python", slug: "python" }] as never);
  });

  it("should index the unfiltered listing", async () => {
    const metadata = await metadataFor({});
    expect(metadata.alternates?.canonical).toBe("/prompts");
    expect(metadata.robots).toBeUndefined();
  });

  it("should keep the trending view out of the index with /prompts as canonical", async () => {
    const metadata = await metadataFor({ trending: "1" });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/prompts");
  });

  it.each([
    { q: "sql" },
    { type: "IMAGE" },
    { tag: "python,sql" },
    { category: "coding", trending: "1" },
    { ai: "1" },
  ])("should keep filter view %o out of the index with /prompts as canonical", async (params) => {
    const metadata = await metadataFor(params);
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/prompts");
  });

  it("should share the main canonical for sorted views", async () => {
    const metadata = await metadataFor({ sort: "upvotes" });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe("/prompts");
  });

  it("should point single category filters at the category page", async () => {
    const metadata = await metadataFor({ category: "coding" });
    expect(metadata.alternates?.canonical).toBe("/categories/coding");
  });
});
