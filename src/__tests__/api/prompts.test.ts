import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/prompts/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    promptVersion: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/webhook", () => ({
  triggerWebhooks: vi.fn(),
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generatePromptEmbedding: vi.fn().mockResolvedValue(undefined),
  findAndSaveRelatedPrompts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/slug", () => ({
  generatePromptSlug: vi.fn().mockResolvedValue("test-prompt"),
}));

vi.mock("@/lib/ai/quality-check", () => ({
  checkPromptQuality: vi.fn().mockResolvedValue({ shouldDelist: false }),
}));

vi.mock("@/lib/similarity", () => ({
  isSimilarContent: vi.fn().mockReturnValue(false),
  normalizeContent: vi.fn().mockReturnValue("normalized content"),
}));

describe("GET /api/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated prompts", async () => {
    const mockPrompts = [
      {
        id: "1",
        title: "Test Prompt",
        content: "Test content",
        type: "TEXT",
        isPrivate: false,
        author: { id: "user1", name: "Test User", username: "testuser" },
        category: null,
        tags: [],
        contributors: [],
        _count: { votes: 5, contributors: 0 },
      },
    ];

    vi.mocked(db.prompt.findMany).mockResolvedValue(mockPrompts as never);
    vi.mocked(db.prompt.count).mockResolvedValue(1);

    const request = new Request("http://localhost:3000/api/prompts?page=1&perPage=24");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.prompts).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.perPage).toBe(24);
  });

  it("should fall back to defaults when pagination parameters are malformed", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    const request = new Request(
      "http://localhost:3000/api/prompts?page=not-a-number&perPage=bad-value"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page).toBe(1);
    expect(data.perPage).toBe(24);
  });

  it("should clamp pagination parameters to configured maximums", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    const request = new Request(
      "http://localhost:3000/api/prompts?page=20000&perPage=999"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page).toBe(10000);
    expect(data.perPage).toBe(100);
  });

  it("should filter by type", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    const request = new Request("http://localhost:3000/api/prompts?type=IMAGE");
    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "IMAGE" }),
      })
    );
  });

  it("should exclude bots when no type is given", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    await GET(new Request("http://localhost:3000/api/prompts"));

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: { notIn: ["BOT", "CLASSIFIER"] } }),
      })
    );
    expect(db.prompt.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ type: { notIn: ["BOT", "CLASSIFIER"] } }),
    });
  });

  it("should exclude bots from the trending filter by default", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    await GET(new Request("http://localhost:3000/api/prompts?trending=1"));

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { notIn: ["BOT", "CLASSIFIER"] },
          trendingUntil: { gt: expect.any(Date) },
        }),
      })
    );
  });

  it("should return trending bots when type=BOT and trending=1 are requested", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    await GET(new Request("http://localhost:3000/api/prompts?trending=1&type=BOT"));

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "BOT",
          trendingUntil: { gt: expect.any(Date) },
        }),
      })
    );
  });

  it("should return bots when type=BOT is requested", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    await GET(new Request("http://localhost:3000/api/prompts?type=BOT"));

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "BOT" }),
      })
    );
  });

  it("should filter by category", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    const request = new Request("http://localhost:3000/api/prompts?category=cat-123");
    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: "cat-123" }),
      })
    );
  });

  it("should filter by search query", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    const request = new Request("http://localhost:3000/api/prompts?q=test");
    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ title: expect.any(Object) }),
          ]),
        }),
      })
    );
  });

  it("should support sorting by upvotes", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    const request = new Request("http://localhost:3000/api/prompts?sort=upvotes");
    await GET(request);

    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { votes: { _count: "desc" } },
      })
    );
  });

  it("should handle database errors", async () => {
    vi.mocked(db.prompt.findMany).mockRejectedValue(new Error("DB Error"));

    const request = new Request("http://localhost:3000/api/prompts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("server_error");
  });
});

describe("POST /api/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ flagged: false } as never);
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
  });

  const validPromptData = {
    title: "Test Prompt",
    description: "A test prompt",
    content: "This is test content",
    type: "TEXT",
    tagIds: [],
    isPrivate: false,
  };

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      body: JSON.stringify(validPromptData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 400 for invalid input", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);

    const request = new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      body: JSON.stringify({ title: "" }), // Missing required fields
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation_error");
  });

  it("should return 429 for rate limiting", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findFirst).mockResolvedValue({ id: "recent" } as never);

    const request = new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      body: JSON.stringify(validPromptData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("rate_limit");
  });

  it("should return 409 for duplicate prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findFirst)
      .mockResolvedValueOnce(null) // Rate limit check
      .mockResolvedValueOnce({ id: "existing", slug: "existing-prompt", title: "Test" } as never); // Duplicate check

    const request = new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      body: JSON.stringify(validPromptData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("duplicate_prompt");
  });

  it("should create prompt successfully", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
    vi.mocked(db.prompt.create).mockResolvedValue({
      id: "new-prompt",
      title: "Test Prompt",
      slug: "test-prompt",
      content: "This is test content",
      type: "TEXT",
      isPrivate: false,
      author: { id: "user1", name: "Test", username: "test" },
      category: null,
      tags: [],
    } as never);
    vi.mocked(db.promptVersion.create).mockResolvedValue({} as never);

    const request = new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      body: JSON.stringify(validPromptData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("new-prompt");
    expect(db.prompt.create).toHaveBeenCalled();
    expect(db.promptVersion.create).toHaveBeenCalled();
  });

  it("should return 429 when flagged user exceeds daily limit", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({ flagged: true } as never);
    vi.mocked(db.prompt.count).mockResolvedValue(5); // Already at limit

    const request = new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      body: JSON.stringify(validPromptData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("daily_limit");
  });
});
