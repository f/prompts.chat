import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { publishPromptState } from "@/lib/prompt-state";
import { UpvoteCount } from "@/components/prompts/upvote-count";
import { UpvoteButton } from "@/components/prompts/upvote-button";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

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
    expect(refresh).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("refreshes the router after a vote when asked, so cached pages show the new count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ voted: false, voteCount: 6 }) })
    );

    render(<UpvoteButton promptId="p1" initialVoted initialCount={7} isLoggedIn size="circular" refreshAfterVote />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button", { pressed: false })).toHaveTextContent("6"));
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("shows votes made elsewhere once the page refreshes, so the next click undoes them", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ voted: false, voteCount: 7 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<UpvoteButton promptId="p1" initialVoted={false} initialCount={7} isLoggedIn size="circular" />);
    rerender(<UpvoteButton promptId="p1" initialVoted initialCount={8} isLoggedIn size="circular" />);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("8");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button", { pressed: false })).toHaveTextContent("7"));
    expect(fetchMock).toHaveBeenCalledWith("/api/prompts/p1/vote", { method: "DELETE" });

    vi.unstubAllGlobals();
  });

  it("follows a WebMCP vote change back to the value it was rendered with", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ voted: true, voteCount: 8 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<UpvoteButton promptId="p1" initialVoted={false} initialCount={7} isLoggedIn size="circular" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("8"));

    act(() => publishPromptState(document, { promptId: "p1", voted: false, voteCount: 7 }));
    rerender(<UpvoteButton promptId="p1" initialVoted={false} initialCount={7} isLoggedIn size="circular" />);
    expect(screen.getByRole("button", { pressed: false })).toHaveTextContent("7");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/prompts/p1/vote", { method: "POST" }));

    vi.unstubAllGlobals();
  });

  it("keeps a WebMCP vote change that lands while its own request is pending", async () => {
    let respond!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { respond = resolve; })));

    render(<UpvoteButton promptId="p1" initialVoted={false} initialCount={7} isLoggedIn size="circular" />);
    fireEvent.click(screen.getByRole("button"));
    act(() => publishPromptState(document, { promptId: "p1", voted: false, voteCount: 7 }));
    await act(async () => respond({ ok: true, json: async () => ({ voted: true, voteCount: 8 }) }));

    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    expect(screen.getByRole("button", { pressed: false })).toHaveTextContent("7");

    vi.unstubAllGlobals();
  });

  it("asks signed-out visitors to log in without voting or refreshing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<UpvoteButton promptId="p1" initialVoted={false} initialCount={7} isLoggedIn={false} size="circular" refreshAfterVote />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
