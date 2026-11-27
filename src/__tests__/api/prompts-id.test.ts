import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/prompts/[id]/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    promptVote: {
      findUnique: vi.fn(),
    },
    promptVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generatePromptEmbedding: vi.fn().mockResolvedValue(undefined),
  findAndSaveRelatedPrompts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/slug", () => ({
  generatePromptSlug: vi.fn().mockResolvedValue("updated-slug"),
}));

vi.mock("@/lib/ai/quality-check", () => ({
  checkPromptQuality: vi.fn().mockResolvedValue({ shouldDelist: false }),
}));

describe("GET /api/prompts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 for non-existent prompt", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/non-existent");
    const response = await GET(request, { params: Promise.resolve({ id: "non-existent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 404 for deleted prompt", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      deletedAt: new Date(),
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123");
    const response = await GET(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 403 for private prompt not owned by user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      isPrivate: true,
      authorId: "owner",
      deletedAt: null,
      _count: { votes: 0 },
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123");
    const response = await GET(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return prompt with vote status for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      title: "Test Prompt",
      content: "Test content",
      isPrivate: false,
      authorId: "author",
      deletedAt: null,
      author: { id: "author", name: "Author" },
      category: null,
      tags: [],
      versions: [],
      _count: { votes: 10 },
    } as never);
    vi.mocked(db.promptVote.findUnique).mockResolvedValue({ id: "vote1" } as never);

    const request = new Request("http://localhost:3000/api/prompts/123");
    const response = await GET(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("123");
    expect(data.voteCount).toBe(10);
    expect(data.hasVoted).toBe(true);
  });

  it("should return prompt for owner even if private", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      isPrivate: true,
      authorId: "owner",
      deletedAt: null,
      _count: { votes: 0 },
    } as never);
    vi.mocked(db.promptVote.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123");
    const response = await GET(request, { params: Promise.resolve({ id: "123" }) });

    expect(response.status).toBe(200);
  });
});

describe("PATCH /api/prompts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 404 for non-existent prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 403 if user does not own the prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1", role: "USER" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "other-user",
      content: "original",
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should allow admin to update any prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "other-user",
      content: "original",
    } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({
      id: "123",
      title: "Updated",
      isPrivate: false,
      isUnlisted: false,
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });

    expect(response.status).toBe(200);
    expect(db.prompt.update).toHaveBeenCalled();
  });

  it("should update prompt successfully", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      authorId: "user1",
      content: "original",
    } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({
      id: "123",
      title: "Updated Title",
      content: "Updated content",
      isPrivate: false,
      isUnlisted: false,
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue({ version: 1 } as never);
    vi.mocked(db.promptVersion.create).mockResolvedValue({} as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title", content: "Updated content" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Updated Title");
    expect(db.promptVersion.create).toHaveBeenCalled(); // New version created
  });

  it("lets admins unlist a bot with isUnlisted", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ authorId: "other-user", content: "original", type: "BOT" } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({ id: "123", isPrivate: false, isUnlisted: true } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ isUnlisted: true }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });

    expect(response.status).toBe(200);
    const data = vi.mocked(db.prompt.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.isUnlisted).toBe(true);
    expect(data.unlistedAt).toBeInstanceOf(Date);
  });

  it("clears unlistedAt when an admin relists", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ authorId: "other-user", content: "original", type: "BOT" } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({ id: "123", isPrivate: false, isUnlisted: false } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ isUnlisted: false }),
    });
    await PATCH(request, { params: Promise.resolve({ id: "123" }) });

    expect(vi.mocked(db.prompt.update).mock.calls[0][0].data).toMatchObject({ isUnlisted: false, unlistedAt: null });
  });

  it("does not let owners change isUnlisted", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1", role: "USER" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ authorId: "user1", content: "original", type: "BOT" } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "PATCH",
      body: JSON.stringify({ isUnlisted: false }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "123" }) });

    expect(response.status).toBe(403);
    expect(db.prompt.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/prompts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 404 for non-existent prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 400 if already deleted", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      authorId: "user1",
      deletedAt: new Date(),
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("already_deleted");
  });

  it("should return 403 if user cannot delete", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1", role: "USER" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      authorId: "user1",
      deletedAt: null,
      isUnlisted: false,
      delistReason: null,
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should allow admin to delete any prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      authorId: "other-user",
      deletedAt: null,
      isUnlisted: false,
    } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({} as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("should allow owner to delete delisted prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1", role: "USER" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      authorId: "user1",
      deletedAt: null,
      isUnlisted: true,
      delistReason: "LOW_QUALITY",
    } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({} as never);

    const request = new Request("http://localhost:3000/api/prompts/123", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
