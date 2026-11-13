import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddToCollectionButton } from "@/components/prompts/add-to-collection-button";
import { publishPromptState } from "@/lib/prompt-state";

vi.mock("@/lib/analytics", () => ({
  analyticsCollection: { add: vi.fn(), remove: vi.fn() },
}));

describe("AddToCollectionButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows changes made elsewhere once the page refreshes, so the next click undoes them", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<AddToCollectionButton promptId="p1" initialInCollection={false} isLoggedIn />);
    expect(screen.getByRole("button")).toHaveTextContent("addToCollection");

    rerender(<AddToCollectionButton promptId="p1" initialInCollection isLoggedIn />);
    expect(screen.getByRole("button")).toHaveTextContent("inCollection");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/collection?promptId=p1", { method: "DELETE" }));
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("addToCollection"));
  });

  it("follows a WebMCP change back to the value it was rendered with", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<AddToCollectionButton promptId="p1" initialInCollection={false} isLoggedIn />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("inCollection"));

    act(() => publishPromptState(document, { promptId: "other", inCollection: false }));
    expect(screen.getByRole("button")).toHaveTextContent("inCollection");
    act(() => publishPromptState(document, { promptId: "p1", inCollection: false }));
    rerender(<AddToCollectionButton promptId="p1" initialInCollection={false} isLoggedIn />);
    expect(screen.getByRole("button")).toHaveTextContent("addToCollection");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/collection", expect.objectContaining({ method: "POST" })));
  });

  it("keeps a WebMCP change that lands while its own request is pending", async () => {
    let respond!: (value: { ok: boolean }) => void;
    const fetchMock = vi.fn(() => new Promise((resolve) => { respond = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AddToCollectionButton promptId="p1" initialInCollection={false} isLoggedIn />);
    fireEvent.click(screen.getByRole("button"));
    act(() => publishPromptState(document, { promptId: "p1", inCollection: false }));
    await act(async () => respond({ ok: true }));

    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    expect(screen.getByRole("button")).toHaveTextContent("addToCollection");
  });

  it("keeps its own state while the props stay the same", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const { rerender } = render(<AddToCollectionButton promptId="p1" isLoggedIn />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("inCollection"));

    rerender(<AddToCollectionButton promptId="p1" isLoggedIn />);
    expect(screen.getByRole("button")).toHaveTextContent("inCollection");
  });
});
