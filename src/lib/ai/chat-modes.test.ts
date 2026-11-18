import { describe, it, expect } from "vitest";
import {
  CHAT_MODES,
  CHAT_MODE_CONFIG,
  DEFAULT_CHAT_MODE,
  resolveChatMode,
  getChatModeConfig,
  resolveModel,
  buildSearchContext,
} from "./chat-modes";

describe("chat-modes: resolveChatMode", () => {
  it("accepts the two canonical modes", () => {
    expect(resolveChatMode("search")).toBe("search");
    expect(resolveChatMode("pro")).toBe("pro");
  });

  it("is case/whitespace insensitive", () => {
    expect(resolveChatMode(" PRO ")).toBe("pro");
    expect(resolveChatMode("Search")).toBe("search");
  });

  it("falls back to the default for unknown / bad input", () => {
    for (const bad of [undefined, null, "", "deep", "turbo", 42, {}, []]) {
      expect(resolveChatMode(bad as unknown)).toBe(DEFAULT_CHAT_MODE);
    }
  });
});

describe("chat-modes: config shape (Perplexity-style tiers)", () => {
  it("defines exactly two modes", () => {
    expect([...CHAT_MODES]).toEqual(["search", "pro"]);
  });

  it("both modes are search-enabled, like Perplexity", () => {
    expect(CHAT_MODE_CONFIG.search.searchEnabled).toBe(true);
    expect(CHAT_MODE_CONFIG.pro.searchEnabled).toBe(true);
  });

  it("pro mode spends more compute than search mode", () => {
    const s = CHAT_MODE_CONFIG.search;
    const p = CHAT_MODE_CONFIG.pro;
    expect(p.maxLoops).toBeGreaterThan(s.maxLoops);
    expect(p.searchLimit).toBeGreaterThan(s.searchLimit);
    expect(p.maxTokens).toBeGreaterThan(s.maxTokens);
  });

  it("getChatModeConfig returns the resolved config", () => {
    expect(getChatModeConfig("pro").mode).toBe("pro");
    expect(getChatModeConfig("nonsense").mode).toBe(DEFAULT_CHAT_MODE);
  });
});

describe("chat-modes: resolveModel", () => {
  it("uses default models when no env override", () => {
    expect(resolveModel("search", {})).toBe("gpt-4o-mini");
    expect(resolveModel("pro", {})).toBe("gpt-4o");
  });

  it("honors per-mode env overrides", () => {
    const env = { OPENAI_GENERATIVE_MODEL: "my-mini", OPENAI_PRO_MODEL: "my-pro" };
    expect(resolveModel("search", env)).toBe("my-mini");
    expect(resolveModel("pro", env)).toBe("my-pro");
  });

  it("ignores blank env overrides", () => {
    expect(resolveModel("pro", { OPENAI_PRO_MODEL: "   " })).toBe("gpt-4o");
  });
});

describe("chat-modes: buildSearchContext", () => {
  it("returns empty string with no sources", () => {
    expect(buildSearchContext([])).toBe("");
  });

  it("produces numbered, cite-able sources", () => {
    const ctx = buildSearchContext([
      { title: "Linux Terminal", content: "I want you to act as a linux terminal." },
      { title: "Translator", content: "Act as an English translator and improver." },
    ]);
    expect(ctx).toContain("[1] Linux Terminal");
    expect(ctx).toContain("[2] Translator");
    expect(ctx).toMatch(/cite as \[n\]/);
  });

  it("collapses whitespace and truncates long content", () => {
    const long = "word ".repeat(400);
    const ctx = buildSearchContext([{ title: "Big", content: long }]);
    // 500-char cap on the content portion
    const body = ctx.split("[1] Big\n")[1];
    expect(body.length).toBeLessThanOrEqual(500);
    expect(body).not.toContain("  ");
  });
});

