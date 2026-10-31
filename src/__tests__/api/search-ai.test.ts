import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/search/ai/route";
import { semanticSearch, isAISearchEnabled } from "@/lib/ai/embeddings";

vi.mock("@/lib/ai/embeddings", () => ({
  semanticSearch: vi.fn(),
  isAISearchEnabled: vi.fn(),
}));

let ipCounter = 0;
// The rate limiter is an in-memory singleton, so give each request its own IP
// unless a test is deliberately exercising the limiter.
function makeRequest(query: string, ip: string = `10.0.0.${++ipCounter}`) {
  return new NextRequest(`http://localhost:3000/api/search/ai${query}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("GET /api/search/ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAISearchEnabled).mockResolvedValue(true);
    vi.mocked(semanticSearch).mockResolvedValue([]);
  });

  it("returns 400 when AI search is not enabled", async () => {
    vi.mocked(isAISearchEnabled).mockResolvedValue(false);

    const response = await GET(makeRequest("?q=test"));

    expect(response.status).toBe(400);
    expect(semanticSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when the query is missing or blank", async () => {
    expect((await GET(makeRequest(""))).status).toBe(400);
    expect((await GET(makeRequest("?q="))).status).toBe(400);
    expect((await GET(makeRequest("?q=%20%20"))).status).toBe(400);
    expect(semanticSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when the query is too long", async () => {
    const response = await GET(makeRequest(`?q=${"a".repeat(501)}`));

    expect(response.status).toBe(400);
    expect(semanticSearch).not.toHaveBeenCalled();
  });

  it("accepts a query at the maximum length", async () => {
    const response = await GET(makeRequest(`?q=${"a".repeat(500)}`));

    expect(response.status).toBe(200);
    expect(semanticSearch).toHaveBeenCalledTimes(1);
  });

  it("returns results with the default limit of 20", async () => {
    vi.mocked(semanticSearch).mockResolvedValue([{ id: "1" }] as never);

    const response = await GET(makeRequest("?q=coding"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.query).toBe("coding");
    expect(semanticSearch).toHaveBeenCalledWith("coding", 20);
  });

  it("passes a valid limit through", async () => {
    await GET(makeRequest("?q=coding&limit=5"));

    expect(semanticSearch).toHaveBeenCalledWith("coding", 5);
  });

  it("caps limit at 50", async () => {
    await GET(makeRequest("?q=coding&limit=1000000000"));

    expect(semanticSearch).toHaveBeenCalledWith("coding", 50);
  });

  it("falls back to the default limit for non-numeric values", async () => {
    await GET(makeRequest("?q=coding&limit=abc"));

    expect(semanticSearch).toHaveBeenCalledWith("coding", 20);
  });

  it("clamps negative limits to 1", async () => {
    await GET(makeRequest("?q=coding&limit=-5"));

    expect(semanticSearch).toHaveBeenCalledWith("coding", 1);
  });

  it("returns 429 with Retry-After after 10 requests from one client", async () => {
    const ip = "203.0.113.50";

    for (let i = 0; i < 10; i++) {
      const ok = await GET(makeRequest("?q=coding", ip));
      expect(ok.status).toBe(200);
    }

    const limited = await GET(makeRequest("?q=coding", ip));
    const data = await limited.json();

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(data.error).toMatch(/rate limit/i);
    expect(semanticSearch).toHaveBeenCalledTimes(10);
  });

  it("rate limits each client independently", async () => {
    const busyIp = "203.0.113.60";
    for (let i = 0; i < 11; i++) {
      await GET(makeRequest("?q=coding", busyIp));
    }

    const other = await GET(makeRequest("?q=coding", "203.0.113.61"));

    expect(other.status).toBe(200);
  });

  it("does not count invalid requests against the limit", async () => {
    const ip = "203.0.113.70";
    for (let i = 0; i < 15; i++) {
      await GET(makeRequest("?q=", ip));
    }

    const response = await GET(makeRequest("?q=coding", ip));

    expect(response.status).toBe(200);
  });

  it("returns 500 when the search fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(semanticSearch).mockRejectedValue(new Error("boom"));

    const response = await GET(makeRequest("?q=coding"));

    expect(response.status).toBe(500);
  });
});
