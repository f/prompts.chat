import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { DELETE } from "@/app/api/user/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidateTag } from "next/cache";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const txMock = {
    $queryRaw: vi.fn(),
    user: {
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    classifierChainStep: {
      findFirst: vi.fn(),
    },
    prompt: {
      deleteMany: vi.fn(),
    },
  };

  return {
    db: {
      user: {
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      classifierChainStep: {
        findFirst: vi.fn(),
      },
      prompt: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(txMock)),
      __txMock: txMock,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("DELETE /api/user", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txMock = (db as any).__txMock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 401 when session has no user id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as never);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("should return 404 when user is not found in database", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_nonexistent" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 403 when the sole administrator attempts self-deletion", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin_1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "admin_1",
      role: "ADMIN",
    } as never);

    txMock.$queryRaw.mockResolvedValue([]);
    txMock.user.count.mockResolvedValue(1); // Only 1 admin exists

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("last_admin");
    expect(txMock.$queryRaw).toHaveBeenCalled();
    expect(txMock.user.delete).not.toHaveBeenCalled();
  });

  it("should allow admin deletion if other administrators exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin_1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "admin_1",
      role: "ADMIN",
    } as never);

    txMock.$queryRaw.mockResolvedValue([]);
    txMock.user.count.mockResolvedValue(2); // 2 admins exist
    txMock.classifierChainStep.findFirst.mockResolvedValue(null);
    txMock.user.update.mockResolvedValue({});
    txMock.prompt.deleteMany.mockResolvedValue({ count: 1 });
    txMock.user.delete.mockResolvedValue({});

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(txMock.user.delete).toHaveBeenCalledWith({ where: { id: "admin_1" } });
  });

  it("should return 409 when user owns a classifier used in an active ClassifierChain", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user_1",
      role: "USER",
    } as never);

    txMock.classifierChainStep.findFirst.mockResolvedValue({ chainId: "chain_1", stepId: "step_1" });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("classifier_in_chain");
    expect(txMock.user.delete).not.toHaveBeenCalled();
  });

  it("should return 409 when a Prisma P2003 foreign key constraint error occurs during cascade", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user_1",
      role: "USER",
    } as never);

    txMock.classifierChainStep.findFirst.mockResolvedValue(null);
    txMock.user.update.mockResolvedValue({});
    txMock.prompt.deleteMany.mockResolvedValue({ count: 0 });

    const p2003Error = new Prisma.PrismaClientKnownRequestError("Foreign key violation", {
      code: "P2003",
      clientVersion: "6.19.0",
      meta: { field_name: "classifierId" },
    });
    txMock.user.delete.mockRejectedValue(p2003Error);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("classifier_in_chain");
  });

  it("should successfully delete a regular user with cascading cleanup", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_regular" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user_regular",
      role: "USER",
    } as never);

    txMock.classifierChainStep.findFirst.mockResolvedValue(null);
    txMock.user.update.mockResolvedValue({});
    txMock.prompt.deleteMany.mockResolvedValue({ count: 3 });
    txMock.user.delete.mockResolvedValue({});

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify step 3: API key revocation
    expect(txMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_regular" },
      data: { apiKey: null },
    });

    // Verify step 4: Explicit deletion of private & unlisted prompts
    expect(txMock.prompt.deleteMany).toHaveBeenCalledWith({
      where: {
        authorId: "user_regular",
        OR: [{ isPrivate: true }, { isUnlisted: true }],
      },
    });

    // Verify step 5: Deletion of user record
    expect(txMock.user.delete).toHaveBeenCalledWith({
      where: { id: "user_regular" },
    });

    // Verify cache revalidation
    expect(revalidateTag).toHaveBeenCalledWith("prompts", "max");
    expect(revalidateTag).toHaveBeenCalledWith("categories", "max");
    expect(revalidateTag).toHaveBeenCalledWith("tags", "max");
  });

  it("should return 500 when an unexpected database error occurs", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_regular" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user_regular",
      role: "USER",
    } as never);

    txMock.classifierChainStep.findFirst.mockResolvedValue(null);
    txMock.user.update.mockRejectedValue(new Error("Unexpected DB crash"));

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("server_error");
  });
});
