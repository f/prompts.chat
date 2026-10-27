import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DiscoveryPrompts } from "@/components/prompts/discovery-prompts";
import { db } from "@/lib/db";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock("@/components/prompts/prompt-card", () => ({
  PromptCard: ({ prompt }: { prompt: { id: string; title: string } }) => (
    <article data-testid="prompt-card">{prompt.title}</article>
  ),
}));

vi.mock("@/components/ui/masonry", () => ({
  Masonry: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/bots/latest-bots", () => ({
  LatestBots: () => null,
}));

type FindManyArgs = { where: Record<string, unknown> };

function isTrendingQuery(args: FindManyArgs) {
  return "trendingUntil" in args.where;
}

function mockPrompts({ trending = [] as Array<{ id: string; title: string }> } = {}) {
  vi.mocked(db.prompt.findMany).mockImplementation(((args: FindManyArgs) =>
    Promise.resolve(
      isTrendingQuery(args)
        ? trending.map((p) => ({ ...p, contributors: [], _count: { votes: 0, contributors: 0 } }))
        : []
    )) as unknown as typeof db.prompt.findMany);
}

function trendingQueries() {
  return vi
    .mocked(db.prompt.findMany)
    .mock.calls.map(([args]) => args as unknown as FindManyArgs)
    .filter(isTrendingQuery);
}

describe("DiscoveryPrompts trending section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows trending prompts first on the homepage with a See all link", async () => {
    mockPrompts({ trending: [{ id: "t1", title: "Hot prompt" }, { id: "t2", title: "Warm prompt" }] });

    render(await DiscoveryPrompts({ isHomepage: true }));

    const heading = screen.getByRole("heading", { name: "trending" });
    const section = heading.closest("section")!;
    expect(section.parentElement!.firstElementChild).toBe(section);
    expect(section).toHaveTextContent("Hot prompt");
    expect(section).toHaveTextContent("Warm prompt");
    expect(screen.getByRole("link", { name: /seeAll/ })).toHaveAttribute("href", "/prompts?trending=1");
  });

  it("queries only unexpired, public, non-bot trending prompts", async () => {
    mockPrompts();

    await DiscoveryPrompts({ isHomepage: true });

    const [query] = trendingQueries();
    expect(query.where).toEqual({
      isPrivate: false,
      isUnlisted: false,
      deletedAt: null,
      type: { not: "BOT" },
      trendingUntil: { gt: expect.any(Date) },
    });
    expect((query.where.trendingUntil as { gt: Date }).gt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("hides the section when nothing is trending", async () => {
    mockPrompts();

    render(await DiscoveryPrompts({ isHomepage: true }));

    expect(screen.queryByRole("heading", { name: "trending" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /seeAll/ })).not.toBeInTheDocument();
  });

  it("does not add the section outside the homepage", async () => {
    mockPrompts({ trending: [{ id: "t1", title: "Hot prompt" }] });

    render(await DiscoveryPrompts({}));

    expect(trendingQueries()).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "trending" })).not.toBeInTheDocument();
  });
});
