import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedTeams } from "@/components/bots/teams/featured-teams";
import { listFeaturedTeams } from "@/lib/bots/teams";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock("@/components/bots/teams/team-card", () => ({
  TeamCard: ({ team }: { team: { title: string; memberCount: number } }) => (
    <article data-testid="team-card">{`${team.title} (${team.memberCount})`}</article>
  ),
}));

vi.mock("@/lib/bots/teams", () => ({
  listFeaturedTeams: vi.fn(),
  teamExcerpt: (description: string | null) => description,
}));

function team(id: string, title: string) {
  return {
    id,
    slug: id,
    title,
    description: null,
    isFeatured: true,
    isUnlisted: false,
    voteCount: 2,
    category: null,
    members: [{ bot: { id: "a" } }, { bot: { id: "b" } }],
  };
}

describe("FeaturedTeams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows featured teams with a View all link to the teams page", async () => {
    vi.mocked(listFeaturedTeams).mockResolvedValue([team("t1", "Research crew"), team("t2", "Ops crew")] as never);

    render((await FeaturedTeams())!);

    expect(listFeaturedTeams).toHaveBeenCalledWith(6);
    expect(screen.getByRole("heading", { name: "featuredTeams" })).toBeInTheDocument();
    expect(screen.getAllByTestId("team-card").map((card) => card.textContent)).toEqual(["Research crew (2)", "Ops crew (2)"]);
    expect(screen.getByRole("link", { name: /viewAll/ })).toHaveAttribute("href", "/bots/teams");
  });

  it("renders nothing when no team is featured", async () => {
    vi.mocked(listFeaturedTeams).mockResolvedValue([]);

    expect(await FeaturedTeams()).toBeNull();
  });
});
