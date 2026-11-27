import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/prompts/search/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/prompts/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array for query shorter than 2 characters", async () => {
    const request = new Request("http://localhost:3000/api/prompts/search?q=a");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.prompts).toEqual([]);
    expect(db.prompt.findMany).not.toHaveBeenCalled();
  });

  it("should return empty array for empty query", async () => {
    const request = new Request("http://localhost:3000/api/prompts/search?q=");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.prompts).toEqual([]);
  });

  it("should return empty array for missing query", async () => {
    const request = new Request("http://localhost:3000/api/prompts/search");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.prompts).toEqual([]);
  });

  it("should search prompts with valid query", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([
      {
        id: "1",
        title: "Test Prompt",
        slug: "test-prompt",
        author: { username: "testuser" },
      },
    ] as never);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.prompts).toHaveLength(1);
    expect(data.prompts[0].title).toBe("Test Prompt");
  });

  it("should respect limit parameter", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test&limit=5");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });

  it("should cap limit at 50", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test&limit=100");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it("should fall back to the default limit for a non-numeric limit", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new NextRequest("http://localhost:3000/api/prompts/search?q=test&limit=abc");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });

  it("should clamp zero and negative limits to 1", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    await GET(new NextRequest("http://localhost:3000/api/prompts/search?q=test&limit=-5"));
    await GET(new NextRequest("http://localhost:3000/api/prompts/search?q=test&limit=0"));

    expect(db.prompt.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 1 }));
    expect(db.prompt.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ take: 1 }));
  });

  it("should use default limit of 10", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });

  it("should filter public prompts for unauthenticated users", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          isUnlisted: false,
        }),
      })
    );
  });

  it("should include user's private prompts for authenticated users", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalled();
    const callArgs = vi.mocked(db.prompt.findMany).mock.calls[0][0];
    expect(callArgs).toBeDefined();
  });

  it("should filter to owner-only prompts when ownerOnly=true", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test&ownerOnly=true");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalled();
  });

  it("should handle comma-separated keywords", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([
      { id: "1", title: "Coding Helper", slug: "coding-helper", author: { username: "test" } },
    ] as never);

    const request = new Request("http://localhost:3000/api/prompts/search?q=coding,helper");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(db.prompt.findMany).toHaveBeenCalled();
  });

  it("should cap the number of comma-separated keywords at 10", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const keywords = Array.from({ length: 30 }, (_, i) => `kw${i}`).join(",");
    const request = new NextRequest(`http://localhost:3000/api/prompts/search?q=${keywords}`);

    await GET(request);

    const call = vi.mocked(db.prompt.findMany).mock.calls[0][0] as {
      where: { AND: Array<{ OR?: unknown[] }> };
    };
    const searchFilter = call.where.AND[1];
    expect(searchFilter.OR).toHaveLength(10);
  });

  it("should truncate overly long queries to 200 characters", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new NextRequest(`http://localhost:3000/api/prompts/search?q=${"a".repeat(1000)}`);

    await GET(request);

    const call = vi.mocked(db.prompt.findMany).mock.calls[0][0] as {
      where: { AND: Array<{ OR?: Array<{ title: { contains: string } }> }> };
    };
    const contains = call.where.AND[1].OR![0].title.contains;
    expect(contains).toHaveLength(200);
  });

  it("should order results by featured then viewCount", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
      })
    );
  });

  it("should select appropriate fields", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          title: true,
          slug: true,
          author: {
            select: {
              username: true,
            },
          },
        },
      })
    );
  });

  it("should handle database errors gracefully", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockRejectedValue(new Error("Database error"));

    const request = new Request("http://localhost:3000/api/prompts/search?q=test");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Search failed");
  });

  it("should handle special characters in query", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/search?q=test%20query%20with%20spaces");

    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
