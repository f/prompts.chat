import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/prompts/[id]/versions/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    promptVersion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/prompts/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array for prompt with no versions", async () => {
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      isPrivate: false,
      authorId: "user1",
    } as never);
    vi.mocked(db.promptVersion.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/123/versions");
    const response = await GET(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return versions ordered by version desc", async () => {
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      isPrivate: false,
      authorId: "user1",
    } as never);
    vi.mocked(db.promptVersion.findMany).mockResolvedValue([
      {
        id: "v3",
        version: 3,
        content: "Version 3 content",
        changeNote: "Version 3",
        createdAt: new Date(),
        author: { name: "User", username: "user" },
      },
      {
        id: "v2",
        version: 2,
        content: "Version 2 content",
        changeNote: "Version 2",
        createdAt: new Date(),
        author: { name: "User", username: "user" },
      },
      {
        id: "v1",
        version: 1,
        content: "Version 1 content",
        changeNote: "Version 1",
        createdAt: new Date(),
        author: { name: "User", username: "user" },
      },
    ] as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions");
    const response = await GET(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
    expect(data[0].version).toBe(3);
    expect(data[1].version).toBe(2);
    expect(data[2].version).toBe(1);
  });

  it("should include author info in response", async () => {
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      isPrivate: false,
      authorId: "user1",
    } as never);
    vi.mocked(db.promptVersion.findMany).mockResolvedValue([
      {
        id: "v1",
        version: 1,
        content: "Content",
        changeNote: "Initial",
        createdAt: new Date(),
        author: { name: "Test User", username: "testuser" },
      },
    ] as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions");
    const response = await GET(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data[0].author.name).toBe("Test User");
    expect(data[0].author.username).toBe("testuser");
  });

  it("should call findMany with correct parameters", async () => {
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      isPrivate: false,
      authorId: "user1",
    } as never);
    vi.mocked(db.promptVersion.findMany).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/prompts/123/versions");
    await GET(request, {
      params: Promise.resolve({ id: "123" }),
    });

    expect(db.promptVersion.findMany).toHaveBeenCalledWith({
      where: { promptId: "123" },
      orderBy: { version: "desc" },
      include: {
        author: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    });
  });
});

describe("POST /api/prompts/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.$transaction).mockImplementation(((fn: (tx: typeof db) => unknown) => fn(db)) as never);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 404 for non-existent prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 403 if user does not own the prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "other-user",
      content: "Original content",
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 400 for empty content", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation_error");
  });

  it("should return 400 for missing content", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation_error");
  });

  it("should return 400 when content is same as current version", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Same content",
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "Same content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("no_change");
  });

  it("should create version with incrementing version number", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue({
      version: 2,
    } as never);
    vi.mocked(db.promptVersion.create).mockResolvedValue({
      id: "v3",
      version: 3,
      content: "New content",
      changeNote: "Version 3",
      createdAt: new Date(),
      author: { name: "User", username: "user" },
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.version).toBe(3);
  });

  it("should use default changeNote when not provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue(null);
    vi.mocked(db.promptVersion.create).mockResolvedValue({
      id: "v1",
      version: 1,
      content: "New content",
      changeNote: "Version 1",
      createdAt: new Date(),
      author: { name: "User", username: "user" },
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.changeNote).toBe("Version 1");
    expect(db.promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ changeNote: "Version 1" }) })
    );
    expect(db.prompt.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "123" }, data: { content: "New content" } })
    );
  });

  it("should use custom changeNote when provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue(null);
    vi.mocked(db.promptVersion.create).mockResolvedValue({
      id: "v1",
      version: 1,
      content: "New content",
      changeNote: "Fixed typo in instructions",
      createdAt: new Date(),
      author: { name: "User", username: "user" },
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({
        content: "New content",
        changeNote: "Fixed typo in instructions",
      }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.changeNote).toBe("Fixed typo in instructions");
  });

  it("should start at version 1 when no previous versions exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue(null);
    vi.mocked(db.promptVersion.create).mockResolvedValue({
      id: "v1",
      version: 1,
      content: "New content",
      changeNote: "Version 1",
      createdAt: new Date(),
      author: { name: "User", username: "user" },
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.version).toBe(1);
  });

  it("should return created version with author info", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "Original content",
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue(null);
    vi.mocked(db.promptVersion.create).mockResolvedValue({
      id: "v1",
      version: 1,
      content: "New content",
      changeNote: "Version 1",
      createdAt: new Date(),
      author: { name: "Test User", username: "testuser" },
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/versions", {
      method: "POST",
      body: JSON.stringify({ content: "New content" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.author.name).toBe("Test User");
    expect(data.author.username).toBe("testuser");
  });
});
