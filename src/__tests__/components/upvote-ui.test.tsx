import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpvoteCount } from "@/components/prompts/upvote-count";
import { UpvoteButton } from "@/components/prompts/upvote-button";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({
  analyticsPrompt: { upvote: vi.fn(), removeUpvote: vi.fn() },
}));

function iconOf(element: HTMLElement) {
  const icon = element.querySelector("svg");
  expect(icon).not.toBeNull();
  return icon!;
}

describe("UpvoteCount", () => {
  it("renders the canonical arrow icon with the count", () => {
    const { container } = render(<UpvoteCount count={42} />);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper).toHaveTextContent("42");
    expect(wrapper).toHaveClass("flex", "items-center", "gap-0.5");
    expect(wrapper).not.toHaveClass("text-primary");

    const icon = iconOf(wrapper);
    expect(icon).toHaveClass("lucide-arrow-big-up", "h-3.5", "w-3.5");
    expect(icon).not.toHaveClass("fill-current");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("highlights and fills the icon when voted", () => {
    const { container } = render(<UpvoteCount count={3} voted />);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper).toHaveClass("text-primary");
    expect(iconOf(wrapper)).toHaveClass("fill-current");
  });
});

describe("UpvoteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the same icon and count markup as cards in the small variant", () => {
    render(<UpvoteButton promptId="p1" initialVoted={false} initialCount={7} isLoggedIn size="sm" />);
    const button = screen.getByRole("button", { pressed: false });

    expect(button).toHaveTextContent("7");
    expect(iconOf(button)).toHaveClass("lucide-arrow-big-up", "h-3.5", "w-3.5");
  });

  it("uses the shared icon in the circular variant and reflects the voted state", () => {
    render(<UpvoteButton promptId="p1" initialVoted initialCount={7} isLoggedIn size="circular" />);
    const button = screen.getByRole("button", { pressed: true });

    expect(button).toHaveClass("bg-primary");
    expect(iconOf(button)).toHaveClass("lucide-arrow-big-up", "fill-current");
  });

  it("still toggles through the existing vote endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voted: true, voteCount: 8 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UpvoteButton voteUrl="/api/bots/teams/t/vote" initialVoted={false} initialCount={7} isLoggedIn size="sm" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("8"));
    expect(fetchMock).toHaveBeenCalledWith("/api/bots/teams/t/vote", { method: "POST" });
    expect(iconOf(screen.getByRole("button"))).toHaveClass("fill-current");

    vi.unstubAllGlobals();
  });
});
