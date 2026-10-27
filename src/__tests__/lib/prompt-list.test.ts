import { describe, it, expect } from "vitest";
import { NON_BOT_PROMPTS, promptListTypeWhere, trendingPromptListWhere } from "@/lib/prompt-list";

describe("trendingPromptListWhere", () => {
  it("lists public, non-bot prompts trending past the current minute", () => {
    const now = Date.UTC(2026, 9, 27, 12, 30, 45);
    expect(trendingPromptListWhere(now)).toEqual({
      isPrivate: false,
      isUnlisted: false,
      deletedAt: null,
      type: { not: "BOT" },
      trendingUntil: { gt: new Date(Date.UTC(2026, 9, 27, 12, 30)) },
    });
  });
});

describe("promptListTypeWhere", () => {
  it("excludes bots when no type is requested", () => {
    expect(promptListTypeWhere()).toEqual({ type: { not: "BOT" } });
    expect(promptListTypeWhere(null)).toEqual(NON_BOT_PROMPTS);
    expect(promptListTypeWhere("")).toEqual(NON_BOT_PROMPTS);
  });

  it("uses the requested type, including BOT", () => {
    expect(promptListTypeWhere("IMAGE")).toEqual({ type: "IMAGE" });
    expect(promptListTypeWhere("BOT")).toEqual({ type: "BOT" });
  });
});
