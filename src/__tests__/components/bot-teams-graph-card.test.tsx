import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BotTeamsGraph } from "@/components/bots/teams/bot-teams-graph";
import type { TeamGraphTeam } from "@/lib/bots/team-graph";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/prompts/upvote-button", () => ({
  UpvoteButton: ({ initialCount }: { initialCount: number }) => <span data-testid="upvotes">{initialCount}</span>,
}));

vi.mock("@/components/prompts/prompt-author", () => ({
  PromptAuthor: ({ author }: { author: { username: string } }) => <span>@{author.username}</span>,
}));

vi.mock("@/components/bots/teams/team-install", () => ({
  TeamInstall: () => <button type="button">install</button>,
}));

vi.mock("@/components/bots/teams/bot-team-member-dialog", () => ({
  BotTeamMemberDialog: () => null,
}));

const team: TeamGraphTeam = {
  id: "t1",
  slug: "research-crew",
  title: "Research crew",
  description: null,
  author: { username: "ada", name: null, avatar: null, verified: false },
  isFeatured: true,
  voteCount: 3,
  voted: false,
  installable: true,
  members: ["a", "b"].map((id) => ({
    id,
    slug: id,
    title: `Bot ${id}`,
    icon: null,
    color: null,
    computerRequirements: [],
    role: null,
    description: null,
  })),
  links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
};

const observed: Element[] = [];

describe("BotTeamsGraph card", () => {
  beforeEach(() => {
    observed.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {}
      }
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("fills its parent and shows the title, author, upvotes and install before the graph is laid out", () => {
    const { container } = render(<BotTeamsGraph teams={[team]} variant="card" />);

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass("h-full");
    expect(screen.getByRole("link", { name: "Research crew" })).toHaveAttribute("href", "/bots/teams/research-crew");
    expect(screen.getByLabelText("featured")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
    expect(screen.getByTestId("upvotes")).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "install" })).toBeInTheDocument();
    expect(container.querySelector("svg[role=group]")).toBeNull();
    expect(observed).toContain(card);
  });
});
