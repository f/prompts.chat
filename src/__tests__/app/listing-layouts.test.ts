import { describe, it, expect, vi, beforeEach } from "vitest";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import TagLayout from "@/app/tags/[slug]/layout";
import CategoryLayout from "@/app/categories/[slug]/layout";
import UserProfileLayout from "@/app/[username]/layout";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" }, features: {}, homepage: {} },
}));


vi.mock("next/headers", () => ({ headers: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    tag: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    prompt: { count: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

class NotFoundError extends Error {}

function requestWithQuery(search: string) {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-search": search }) as never);
}

const children = "content";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notFound).mockImplementation(() => {
    throw new NotFoundError();
  });
  vi.mocked(auth).mockResolvedValue(null as never);
});

describe("TagLayout", () => {
  const params = Promise.resolve({ slug: "python" });

  beforeEach(() => {
    vi.mocked(db.tag.findUnique).mockResolvedValue({ id: "tag1" } as never);
  });

  it("should 404 unknown tags", async () => {
    requestWithQuery("");
    vi.mocked(db.tag.findUnique).mockResolvedValue(null);
    await expect(TagLayout({ children, params })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("should render the first page without counting prompts", async () => {
    requestWithQuery("");
    await expect(TagLayout({ children, params })).resolves.toBe(children);
    expect(db.prompt.count).not.toHaveBeenCalled();
  });

  it("should render pages within range", async () => {
    requestWithQuery("?page=2");
    vi.mocked(db.prompt.count).mockResolvedValue(30);
    await expect(TagLayout({ children, params })).resolves.toBe(children);
  });

  it("should 404 pages past the end", async () => {
    requestWithQuery("?page=5");
    vi.mocked(db.prompt.count).mockResolvedValue(30);
    await expect(TagLayout({ children, params })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("should count the signed-in user's private prompts", async () => {
    requestWithQuery("?page=2");
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.prompt.count).mockResolvedValue(30);
    await TagLayout({ children, params });
    expect(vi.mocked(db.prompt.count).mock.calls[0][0]?.where?.OR).toEqual([
      { isPrivate: false },
      { authorId: "user1" },
    ]);
  });
});

describe("CategoryLayout", () => {
  const params = Promise.resolve({ slug: "coding" });

  beforeEach(() => {
    vi.mocked(db.category.findUnique).mockResolvedValue({ id: "cat1" } as never);
  });

  it("should render pages within range", async () => {
    requestWithQuery("?page=2");
    vi.mocked(db.prompt.count).mockResolvedValue(31);
    await expect(CategoryLayout({ children, params })).resolves.toBe(children);
  });

  it("should 404 pages past the end", async () => {
    requestWithQuery("?page=3");
    vi.mocked(db.prompt.count).mockResolvedValue(31);
    await expect(CategoryLayout({ children, params })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("should count search results when a query is set", async () => {
    requestWithQuery("?q=sql&page=2");
    vi.mocked(db.prompt.count).mockResolvedValue(5);
    await expect(CategoryLayout({ children, params })).rejects.toBeInstanceOf(NotFoundError);
    expect(vi.mocked(db.prompt.count).mock.calls[0][0]?.where?.OR).toBeDefined();
  });
});

describe("UserProfileLayout", () => {
  const params = Promise.resolve({ username: "@ada" });

  beforeEach(() => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "u1" } as never);
  });

  it("should render pages within range", async () => {
    requestWithQuery("?page=2");
    vi.mocked(db.prompt.count).mockResolvedValue(25);
    await expect(UserProfileLayout({ children, params })).resolves.toBe(children);
  });

  it("should 404 pages past the end", async () => {
    requestWithQuery("?page=9");
    vi.mocked(db.prompt.count).mockResolvedValue(25);
    await expect(UserProfileLayout({ children, params })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("should count the owner's private prompts", async () => {
    requestWithQuery("?page=2");
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(db.prompt.count).mockResolvedValue(25);
    await UserProfileLayout({ children, params });
    expect(vi.mocked(db.prompt.count).mock.calls[0][0]?.where).not.toHaveProperty("isPrivate");
  });
});
