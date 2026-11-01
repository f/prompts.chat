import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" } },
}));

import {
  absoluteUrl,
  buildPageMetadata,
  escapeXml,
  getBaseUrl,
  paginatedPath,
  toMetaDescription,
  toSitemapImageUrl,
} from "@/lib/seo";

describe("getBaseUrl", () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalUrl;
  });

  it("should use NEXTAUTH_URL without a trailing slash", () => {
    process.env.NEXTAUTH_URL = "https://example.com/";
    expect(getBaseUrl()).toBe("https://example.com");
  });

  it("should fall back to https://prompts.chat", () => {
    delete process.env.NEXTAUTH_URL;
    expect(getBaseUrl()).toBe("https://prompts.chat");
  });
});

describe("absoluteUrl", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://prompts.chat";
  });

  it("should prefix paths with the site origin", () => {
    expect(absoluteUrl("/categories/coding")).toBe("https://prompts.chat/categories/coding");
  });

  it("should add a missing leading slash", () => {
    expect(absoluteUrl("tags/python")).toBe("https://prompts.chat/tags/python");
  });

  it("should return absolute URLs unchanged", () => {
    expect(absoluteUrl("https://github.com/f")).toBe("https://github.com/f");
  });
});

describe("paginatedPath", () => {
  it("should not add a page parameter to the first page", () => {
    expect(paginatedPath("/tags/python", 1)).toBe("/tags/python");
  });

  it("should add the page parameter to later pages", () => {
    expect(paginatedPath("/tags/python", 3)).toBe("/tags/python?page=3");
  });
});

describe("toMetaDescription", () => {
  it("should collapse whitespace and line breaks", () => {
    expect(toMetaDescription("Act as a\n\n  Linux   terminal.")).toBe("Act as a Linux terminal.");
  });

  it("should replace prompt variables with their names", () => {
    expect(toMetaDescription("Write a poem about ${topic} in ${style:haiku} form")).toBe(
      "Write a poem about topic in style form"
    );
  });

  it("should strip markdown syntax and keep link text", () => {
    expect(toMetaDescription("# Title\n**Bold** see [the docs](https://example.com) ![img](a.png)")).toBe(
      "Title Bold see the docs"
    );
  });

  it("should keep short text as-is", () => {
    expect(toMetaDescription("A short description.")).toBe("A short description.");
  });

  it("should cut long text on a word boundary with an ellipsis", () => {
    const text = "word ".repeat(60);
    const result = toMetaDescription(text, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith("word…")).toBe(true);
  });

  it("should stay fast on very long unterminated markup", () => {
    const start = performance.now();
    toMetaDescription("[".repeat(1_000_000));
    toMetaDescription("${".repeat(500_000));
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("should not leave trailing punctuation before the ellipsis", () => {
    const result = toMetaDescription("First sentence here, second sentence goes on and on", 24);
    expect(result).toBe("First sentence here…");
  });
});

describe("escapeXml", () => {
  it("should escape XML special characters", () => {
    expect(escapeXml(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;");
  });
});

describe("toSitemapImageUrl", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://prompts.chat";
  });

  it("should escape ampersands in query strings", () => {
    expect(toSitemapImageUrl("https://pbs.twimg.com/media/abc?format=jpg&name=large")).toBe(
      "https://pbs.twimg.com/media/abc?format=jpg&amp;name=large"
    );
  });

  it("should make relative upload paths absolute", () => {
    expect(toSitemapImageUrl("/uploads/image.png")).toBe("https://prompts.chat/uploads/image.png");
  });

  it("should percent-encode spaces", () => {
    expect(toSitemapImageUrl("https://example.com/my image.png")).toBe("https://example.com/my%20image.png");
  });

  it("should reject non-http URLs", () => {
    expect(toSitemapImageUrl("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("buildPageMetadata", () => {
  it("should set a self-referencing canonical and matching social tags", () => {
    const metadata = buildPageMetadata({
      title: "Coding Prompts",
      description: "Browse coding prompts.",
      path: "/categories/coding",
    });

    expect(metadata.title).toBe("Coding Prompts");
    expect(metadata.alternates?.canonical).toBe("/categories/coding");
    expect(metadata.openGraph).toMatchObject({
      url: "/categories/coding",
      title: "Coding Prompts | prompts.chat",
      description: "Browse coding prompts.",
    });
    expect(metadata.twitter).toMatchObject({ title: "Coding Prompts | prompts.chat" });
    expect(metadata.robots).toBeUndefined();
  });

  it("should support absolute titles", () => {
    const metadata = buildPageMetadata({
      title: "prompts.chat - Free AI Prompts",
      description: "Home",
      path: "/",
      absoluteTitle: true,
    });

    expect(metadata.title).toEqual({ absolute: "prompts.chat - Free AI Prompts" });
    expect(metadata.openGraph).toMatchObject({ title: "prompts.chat - Free AI Prompts" });
  });

  it("should keep the canonical on noindex pages", () => {
    const metadata = buildPageMetadata({
      title: "Search",
      description: "Search results",
      path: "/prompts",
      noindex: true,
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/prompts");
  });

  it("should point the canonical and social URL at a preferred URL", () => {
    const metadata = buildPageMetadata({
      title: "Trending",
      description: "Trending prompts",
      path: "/prompts?trending=1",
      canonical: "/prompts",
      noindex: true,
    });

    expect(metadata.alternates?.canonical).toBe("/prompts");
    expect(metadata.openGraph).toMatchObject({ url: "/prompts" });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it("should leave images to the route when requested", () => {
    const metadata = buildPageMetadata({
      title: "Prompt",
      description: "A prompt",
      path: "/prompts/abc_prompt",
      image: "route",
    });

    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).not.toHaveProperty("images");
  });
});
