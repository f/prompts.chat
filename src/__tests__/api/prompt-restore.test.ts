import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/prompts/[id]/restore/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidateTag } from "next/cache";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

describe("POST /api/prompts/[id]/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123/restore", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 if user is not admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1", role: "USER" } } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/restore", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 404 for non-existent prompt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/prompts/123/restore", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Prompt not found");
  });

  it("should return 400 if prompt is not deleted", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      deletedAt: null,
      type: "PROMPT",
    } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/restore", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Prompt is not deleted");
    expect(db.prompt.update).not.toHaveBeenCalled();
  });

  it("should restore soft-deleted prompt and revalidate cache tags", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      deletedAt: new Date(),
      type: "PROMPT",
    } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({ id: "123", deletedAt: null } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/restore", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(db.prompt.update).toHaveBeenCalledWith({
      where: { id: "123" },
      data: { deletedAt: null },
    });
    expect(revalidateTag).toHaveBeenCalledWith("prompts", "max");
    expect(revalidateTag).toHaveBeenCalledWith("categories", "max");
    expect(revalidateTag).toHaveBeenCalledWith("tags", "max");
    expect(revalidateTag).toHaveBeenCalledWith("prompt-flow", "max");
    expect(revalidateTag).not.toHaveBeenCalledWith("classifiers", "max");
  });

  it("should revalidate classifiers tag if restored prompt is of type CLASSIFIER", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      deletedAt: new Date(),
      type: "CLASSIFIER",
    } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({ id: "123", deletedAt: null } as never);

    const request = new Request("http://localhost:3000/api/prompts/123/restore", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith("prompts", "max");
    expect(revalidateTag).toHaveBeenCalledWith("categories", "max");
    expect(revalidateTag).toHaveBeenCalledWith("tags", "max");
    expect(revalidateTag).toHaveBeenCalledWith("prompt-flow", "max");
    expect(revalidateTag).toHaveBeenCalledWith("classifiers", "max");
  });
});
