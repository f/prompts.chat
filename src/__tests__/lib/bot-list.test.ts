import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { listBots, listLatestBots } from "@/lib/bots";

vi.mock("@/lib/db", () => ({
  db: {
    prompt: { findMany: vi.fn(), count: vi.fn() },
  },
}));

function orderByOfLastCall() {
  const calls = vi.mocked(db.prompt.findMany).mock.calls;
  return (calls[calls.length - 1][0] as { orderBy: unknown }).orderBy;
}

describe("listBots ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);
  });

  it("sorts newest by creation date with an id tiebreaker, without pinning featured bots", async () => {
    await listBots({ sort: "newest" });
    expect(orderByOfLastCall()).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("defaults to the newest order", async () => {
    await listBots();
    expect(orderByOfLastCall()).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("never orders newest by isFeatured", async () => {
    await listBots({ sort: "newest" });
    expect(JSON.stringify(orderByOfLastCall())).not.toContain("isFeatured");
  });

  it("keeps the oldest and upvotes orders", async () => {
    await listBots({ sort: "oldest" });
    expect(orderByOfLastCall()).toEqual([{ createdAt: "asc" }]);

    await listBots({ sort: "upvotes" });
    expect(orderByOfLastCall()).toEqual([{ votes: { _count: "desc" } }, { createdAt: "desc" }]);
  });

  it("matches listLatestBots on the primary sort key", async () => {
    await listLatestBots();
    expect(orderByOfLastCall()).toEqual({ createdAt: "desc" });
  });
});
