import { describe, it, expect, vi } from "vitest";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" }, features: {}, homepage: {} },
}));


vi.mock("@/lib/book/chapters", () => ({ getAllChapters: () => [] }));

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () =>
        new Proxy(
          {},
          {
            get: () => () => Promise.reject(new Error("database unavailable")),
          }
        ),
    }
  ),
}));

describe("sitemap", () => {
  it("should revalidate every 5 minutes", async () => {
    const { revalidate } = await import("@/app/sitemap");
    expect(revalidate).toBe(300);
  });

  it("lists every classifier and chain page even without a database", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const { getChains, getClassifiers } = await import("@/lib/classifiers");
    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    for (const c of getClassifiers()) expect(paths).toContain(`/classifiers/${c.slug}`);
    for (const c of getChains()) expect(paths).toContain(`/classifiers/chains/${c.slug}`);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
