import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedTeams } from "@/components/bots/teams/featured-teams";
import { auth } from "@/lib/auth";
import { teamCardHeights } from "@/lib/bots/team-graph";
import { getVotedTeamIds, listFeaturedTeams } from "@/lib/bots/teams";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/components/bots/teams/bot-teams-graph", () => ({
  BotTeamsGraph: ({
    teams,
    variant,
    isLoggedIn,
  }: {
    teams: { title: string; description: string | null; voted: boolean; members: unknown[]; links: unknown[] }[];
    variant: string;
    isLoggedIn: boolean;
  }) => (
    <article data-testid="team-graph" data-variant={variant} data-logged-in={isLoggedIn}>
      {teams.map((team) => `${team.title} (${team.members.length}/${team.links.length}${team.voted ? ", voted" : ""}${team.description ? ", described" : ""})`)}
    </article>
  ),
}));

vi.mock("@/lib/bots/teams", () => ({
  listFeaturedTeams: vi.fn(),
  getVotedTeamIds: vi.fn(),
  toTeamGraphTeam: (team: { title: string; description: string | null; members: unknown[]; links: unknown[] }, { voted }: { voted: boolean }) => ({
    ...team,
    voted,
  }),
}));

function team(id: string, title: string, size: number) {
  const ids = Array.from({ length: size }, (_, i) => `${id}-bot-${i}`);
  return {
    id,
    slug: id,
    title,
    description: "A **markdown** description",
    isFeatured: true,
    isUnlisted: false,
    voteCount: 2,
    category: null,
    members: ids.map((botId) => ({ id: botId })),
    links: ids.slice(1).map((botId, i) => ({ fromBotId: ids[i], toBotId: botId, label: "" })),
  };
}

describe("FeaturedTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(getVotedTeamIds).mockResolvedValue(new Set());
  });

  it("draws each featured team as a graph card, sized per row for each breakpoint, with a View all link", async () => {
    vi.mocked(listFeaturedTeams).mockResolvedValue([team("t1", "Research crew", 2), team("t2", "Ops crew", 6), team("t3", "Duo", 2)] as never);

    render((await FeaturedTeams())!);

    expect(listFeaturedTeams).toHaveBeenCalledWith(6);
    expect(screen.getByRole("heading", { name: "featuredTeams" })).toBeInTheDocument();
    const cards = screen.getAllByTestId("team-graph");
    expect(cards.map((card) => card.textContent)).toEqual(["Research crew (2/1)", "Ops crew (6/5)", "Duo (2/1)"]);
    expect(cards.every((card) => card.dataset.variant === "card")).toBe(true);
    const heights = (name: string) => cards.map((card) => card.parentElement!.style.getPropertyValue(name));
    const [small, large] = teamCardHeights([team("a", "", 2), team("b", "", 6)]).map((height) => `${height}px`);
    expect(heights("--card-h")).toEqual([small, large, small]);
    expect(heights("--card-h-md")).toEqual([large, large, small]);
    expect(heights("--card-h-lg")).toEqual([large, large, large]);
    expect(screen.getByRole("link", { name: /viewAll/ })).toHaveAttribute("href", "/bots/teams");
  });

  it("marks the teams the signed-in viewer upvoted", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(getVotedTeamIds).mockResolvedValue(new Set(["t2"]));
    vi.mocked(listFeaturedTeams).mockResolvedValue([team("t1", "Research crew", 2), team("t2", "Ops crew", 3)] as never);

    render((await FeaturedTeams())!);

    expect(getVotedTeamIds).toHaveBeenCalledWith("u1", ["t1", "t2"]);
    const cards = screen.getAllByTestId("team-graph");
    expect(cards.map((card) => card.textContent)).toEqual(["Research crew (2/1)", "Ops crew (3/2, voted)"]);
    expect(cards.every((card) => card.dataset.loggedIn === "true")).toBe(true);
  });

  it("renders nothing when no team is featured", async () => {
    vi.mocked(listFeaturedTeams).mockResolvedValue([]);

    expect(await FeaturedTeams()).toBeNull();
    expect(getVotedTeamIds).not.toHaveBeenCalled();
  });
});
