import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/user/export/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    prompt: {
      findMany: vi.fn(),
    },
    userPromptExample: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/user/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 401 when session has no user ID", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 404 if user is not found in database", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_nonexistent" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 200 with formatted JSON and appropriate headers for empty library", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user_1",
      username: "alice",
      name: "Alice Smith",
      email: "alice@example.com",
      avatar: "https://example.com/alice.png",
      bio: "Hello world",
      customLinks: null,
      role: "USER",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    } as never);

    vi.mocked(db.prompt.findMany).mockResolvedValue([]);
    vi.mocked(db.userPromptExample.findMany).mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(200);

    const contentType = response.headers.get("Content-Type");
    expect(contentType).toContain("application/json");

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain('attachment; filename="prompts-export-alice-');

    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toBe("no-store, private");

    const data = await response.json();
    expect(data.version).toBe("1.0");
    expect(data.user.username).toBe("alice");
    expect(data.stats.totalPrompts).toBe(0);
    expect(data.prompts).toEqual([]);
    expect(data.externalPromptExamples).toEqual([]);

    // Assert sensitive fields are undefined
    expect(data.user.password).toBeUndefined();
    expect(data.user.apiKey).toBeUndefined();
  });

  it("should correctly serialize public, private, unlisted, and soft-deleted prompts with versions and tags", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user_1",
      username: "alice",
      name: "Alice Smith",
      email: "alice@example.com",
      avatar: null,
      bio: null,
      customLinks: null,
      role: "USER",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    } as never);

    const mockPrompts = [
      {
        id: "p1",
        title: "Public Prompt",
        slug: "public-prompt",
        description: "A public prompt",
        content: "Do something publicly",
        type: "TEXT",
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
        mediaUrl: null,
        viewCount: 10,
        structuredFormat: null,
        bestWithModels: ["gpt-4o"],
        bestWithMCP: null,
        workflowLink: null,
        botPlatforms: [],
        botIcon: null,
        botColor: null,
        installUrl: null,
        computerRequirements: [],
        botConfig: null,
        createdAt: new Date("2025-02-01T10:00:00.000Z"),
        updatedAt: new Date("2025-02-02T10:00:00.000Z"),
        category: { id: "c1", name: "Coding", slug: "coding" },
        tags: [{ tag: { id: "t1", name: "TypeScript", slug: "typescript", color: "#3178c6" } }],
        versions: [
          { id: "v1", version: 1, content: "Do something v1", changeNote: "Initial", createdAt: new Date("2025-02-01") },
        ],
        userExamples: [{ id: "e1", mediaUrl: "https://example.com/ex1.png", comment: "Great output", createdAt: new Date("2025-02-01") }],
      },
      {
        id: "p2",
        title: "Private Prompt",
        slug: null,
        description: "My private notes",
        content: "Top secret",
        type: "TEXT",
        isPrivate: true,
        isUnlisted: false,
        deletedAt: null,
        mediaUrl: null,
        viewCount: 1,
        structuredFormat: null,
        bestWithModels: [],
        bestWithMCP: null,
        workflowLink: null,
        botPlatforms: [],
        botIcon: null,
        botColor: null,
        installUrl: null,
        computerRequirements: [],
        botConfig: null,
        createdAt: new Date("2025-02-03T10:00:00.000Z"),
        updatedAt: new Date("2025-02-03T10:00:00.000Z"),
        category: null,
        tags: [],
        versions: [],
        userExamples: [],
      },
      {
        id: "p3",
        title: "Unlisted Prompt",
        slug: "unlisted-prompt",
        description: null,
        content: "Unlisted content",
        type: "TEXT",
        isPrivate: false,
        isUnlisted: true,
        deletedAt: null,
        mediaUrl: null,
        viewCount: 0,
        structuredFormat: null,
        bestWithModels: [],
        bestWithMCP: null,
        workflowLink: null,
        botPlatforms: [],
        botIcon: null,
        botColor: null,
        installUrl: null,
        computerRequirements: [],
        botConfig: null,
        createdAt: new Date("2025-02-04T10:00:00.000Z"),
        updatedAt: new Date("2025-02-04T10:00:00.000Z"),
        category: null,
        tags: [],
        versions: [],
        userExamples: [],
      },
      {
        id: "p4",
        title: "Soft Deleted Prompt",
        slug: null,
        description: null,
        content: "Was deleted earlier",
        type: "TEXT",
        isPrivate: false,
        isUnlisted: false,
        deletedAt: new Date("2025-02-05T12:00:00.000Z"),
        mediaUrl: null,
        viewCount: 5,
        structuredFormat: null,
        bestWithModels: [],
        bestWithMCP: null,
        workflowLink: null,
        botPlatforms: [],
        botIcon: null,
        botColor: null,
        installUrl: null,
        computerRequirements: [],
        botConfig: null,
        createdAt: new Date("2025-01-10T10:00:00.000Z"),
        updatedAt: new Date("2025-02-05T12:00:00.000Z"),
        category: null,
        tags: [],
        versions: [],
        userExamples: [],
      },
    ];

    const mockExternalExamples = [
      {
        id: "ext1",
        mediaUrl: "https://example.com/external.png",
        comment: "Tested on another prompt",
        createdAt: new Date("2025-02-04"),
        prompt: { id: "other_p", title: "Someone else's prompt", slug: "someone-elses-prompt" },
      },
    ];

    vi.mocked(db.prompt.findMany).mockResolvedValue(mockPrompts as never);
    vi.mocked(db.userPromptExample.findMany).mockResolvedValue(mockExternalExamples as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.stats.totalPrompts).toBe(4);
    expect(data.stats.activePrompts).toBe(3);
    expect(data.stats.softDeletedPrompts).toBe(1);
    expect(data.stats.publicPrompts).toBe(1);
    expect(data.stats.privatePrompts).toBe(1);
    expect(data.stats.unlistedPrompts).toBe(1);
    expect(data.stats.promptExamplesCount).toBe(2);

    expect(data.prompts).toHaveLength(4);
    expect(data.prompts[0].tags).toEqual([
      { id: "t1", name: "TypeScript", slug: "typescript", color: "#3178c6" },
    ]);
    expect(data.prompts[0].versions).toHaveLength(1);
    expect(data.prompts[0].examples).toHaveLength(1);
    expect(data.prompts[3].deletedAt).not.toBeNull();
    expect(data.externalPromptExamples).toHaveLength(1);
  });
});
