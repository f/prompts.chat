import { describe, it, expect } from "vitest";
import {
  categoryPromptsWhere,
  isPageOutOfRange,
  lastPage,
  parseDayFilter,
  parsePageParam,
  profilePromptsWhere,
  tagPromptsWhere,
} from "@/lib/listing-pagination";

describe("parsePageParam", () => {
  it("should default to the first page", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam("")).toBe(1);
  });

  it("should treat invalid and non-positive values as the first page", () => {
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
  });

  it("should parse page numbers", () => {
    expect(parsePageParam("7")).toBe(7);
  });
});

describe("lastPage", () => {
  it("should keep a first page for empty listings", () => {
    expect(lastPage(0, 24)).toBe(1);
  });

  it("should round partial pages up", () => {
    expect(lastPage(24, 24)).toBe(1);
    expect(lastPage(25, 24)).toBe(2);
  });
});

describe("isPageOutOfRange", () => {
  it("should never reject the first page", () => {
    expect(isPageOutOfRange(1, 0, 24)).toBe(false);
  });

  it("should accept the last page", () => {
    expect(isPageOutOfRange(2, 25, 24)).toBe(false);
  });

  it("should reject pages past the end", () => {
    expect(isPageOutOfRange(3, 25, 24)).toBe(true);
    expect(isPageOutOfRange(2, 0, 24)).toBe(true);
  });
});

describe("tagPromptsWhere", () => {
  it("should only list public prompts to visitors", () => {
    expect(tagPromptsWhere("tag1")).toMatchObject({
      tags: { some: { tagId: "tag1" } },
      isUnlisted: false,
      deletedAt: null,
      type: { not: "BOT" },
      OR: [{ isPrivate: false }],
    });
  });

  it("should include the viewer's own private prompts", () => {
    expect(tagPromptsWhere("tag1", "user1").OR).toEqual([{ isPrivate: false }, { authorId: "user1" }]);
  });
});

describe("categoryPromptsWhere", () => {
  it("should list public non-bot prompts of the category", () => {
    const where = categoryPromptsWhere("cat1");
    expect(where).toMatchObject({ categoryId: "cat1", isPrivate: false, isUnlisted: false, deletedAt: null, type: { not: "BOT" } });
    expect(where.OR).toBeUndefined();
  });

  it("should narrow the listing by a search query", () => {
    expect(categoryPromptsWhere("cat1", "sql").OR).toEqual([
      { title: { contains: "sql", mode: "insensitive" } },
      { content: { contains: "sql", mode: "insensitive" } },
    ]);
  });
});

describe("parseDayFilter", () => {
  it("should ignore missing and malformed dates", () => {
    expect(parseDayFilter(undefined)).toBeNull();
    expect(parseDayFilter("2024-1-5")).toBeNull();
    expect(parseDayFilter("not-a-date")).toBeNull();
  });

  it("should span the whole day", () => {
    const day = parseDayFilter("2024-03-15");
    expect(day?.start.getDate()).toBe(15);
    expect(day?.start.getHours()).toBe(0);
    expect(day?.end.getHours()).toBe(23);
  });
});

describe("profilePromptsWhere", () => {
  it("should hide private prompts from visitors", () => {
    expect(profilePromptsWhere("u1", { includePrivate: false })).toMatchObject({ authorId: "u1", isPrivate: false });
  });

  it("should show private prompts to their author", () => {
    expect(profilePromptsWhere("u1", { includePrivate: true })).not.toHaveProperty("isPrivate");
  });

  it("should filter by day", () => {
    const where = profilePromptsWhere("u1", { includePrivate: false, date: "2024-03-15" });
    expect(where.createdAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });
});
