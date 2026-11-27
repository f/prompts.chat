import { describe, it, expect, vi, beforeEach } from "vitest";
import { notFound, permanentRedirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findBotBySlug, getBotById, type BotView } from "@/lib/bots";
import BotPage from "@/app/bots/[slug]/page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT 308 ${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" }, features: {}, homepage: {} },
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(),
  getTranslations: vi.fn(),
}));

vi.mock("@/lib/bots", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bots")>();
  return { ...actual, getBotById: vi.fn(), findBotBySlug: vi.fn() };
});

const bot = { id: "abc123", slug: "code-reviewer", isPrivate: false, authorId: "author1" } as BotView;

function render(slug: string) {
  return BotPage({ params: Promise.resolve({ slug }) });
}

describe("/bots/[slug] slug-only URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(getBotById).mockResolvedValue(null);
    vi.mocked(findBotBySlug).mockResolvedValue(null);
  });

  it("should permanently redirect a slug-only URL to the canonical id_slug URL", async () => {
    vi.mocked(findBotBySlug).mockResolvedValue(bot);

    await expect(render("code-reviewer")).rejects.toThrow("NEXT_REDIRECT 308 /bots/abc123_code-reviewer");
    expect(getBotById).toHaveBeenCalledWith("code-reviewer", { includeDeleted: false });
    expect(findBotBySlug).toHaveBeenCalledWith("code-reviewer", null);
    expect(permanentRedirect).toHaveBeenCalledWith("/bots/abc123_code-reviewer");
  });

  it("should fall back to the slug when the id prefix does not resolve", async () => {
    vi.mocked(findBotBySlug).mockResolvedValue(bot);

    await expect(render("deadid_code-reviewer")).rejects.toThrow("NEXT_REDIRECT 308 /bots/abc123_code-reviewer");
    expect(getBotById).toHaveBeenCalledWith("deadid", { includeDeleted: false });
    expect(findBotBySlug).toHaveBeenCalledWith("code-reviewer", null);
  });

  it("should look the slug up with the viewer so their private bots resolve", async () => {
    const user = { id: "user1", role: "USER" };
    vi.mocked(auth).mockResolvedValue({ user } as never);
    vi.mocked(findBotBySlug).mockResolvedValue(bot);

    await expect(render("code-reviewer")).rejects.toThrow("NEXT_REDIRECT");
    expect(findBotBySlug).toHaveBeenCalledWith("code-reviewer", user);
  });

  it("should fall back to the slug when the id resolves to a bot the viewer cannot see", async () => {
    vi.mocked(getBotById).mockResolvedValue({ ...bot, id: "private1", isPrivate: true, authorId: "someone" } as BotView);
    vi.mocked(findBotBySlug).mockResolvedValue(bot);

    await expect(render("private1_code-reviewer")).rejects.toThrow("NEXT_REDIRECT 308 /bots/abc123_code-reviewer");
  });

  it("should keep 404 for an unknown slug", async () => {
    await expect(render("no-such-bot")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findBotBySlug).toHaveBeenCalledWith("no-such-bot", null);
    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });

  it.each(["teams", "new"])("should never resolve reserved segment %s as a bot slug", async (segment) => {
    await expect(render(segment)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findBotBySlug).not.toHaveBeenCalled();
  });

  it("should still canonicalize a stale slug after a valid id without a slug lookup", async () => {
    vi.mocked(getBotById).mockResolvedValue(bot);

    await expect(render("abc123_old-name")).rejects.toThrow("NEXT_REDIRECT 308 /bots/abc123_code-reviewer");
    expect(findBotBySlug).not.toHaveBeenCalled();
  });
});
