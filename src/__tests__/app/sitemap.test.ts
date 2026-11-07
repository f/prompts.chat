import { describe, it, expect, vi } from "vitest";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" }, features: {}, homepage: {} },
}));


vi.mock("@/lib/book/chapters", () => ({ getAllChapters: () => [] }));

const state = vi.hoisted(() => ({ dbAvailable: false }));

// Every query returns an empty result, or fails while the database is "unavailable"
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () =>
        new Proxy(
          {},
          {
            get: (_target, method) => () =>
              state.dbAvailable ? Promise.resolve(method === "findFirst" ? null : []) : Promise.reject(new Error("database unavailable")),
          }
        ),
    }
  ),
}));

vi.mock("@/lib/classifiers/store", () => {
  const classifier = (slug: string, isUnlisted: boolean) => ({ slug, isUnlisted, updatedAt: new Date("2026-11-01T00:00:00Z") });
  return {
    getClassifierCatalog: async () => {
      if (!state.dbAvailable) throw new Error("database unavailable");
      return {
        classifiers: [classifier("support-ticket-routing", false), classifier("hidden-one", true)],
        chains: [{ slug: "support-inbox-triage" }],
        sources: [],
      };
    },
    listedClassifiers: (catalog: { classifiers: { isUnlisted: boolean }[] }) => catalog.classifiers.filter((c) => !c.isUnlisted),
  };
});

describe("sitemap", () => {
  it("should revalidate every 5 minutes", async () => {
    const { revalidate } = await import("@/app/sitemap");
    expect(revalidate).toBe(300);
  });

  it("keeps the classifier catalog page but no detail pages without a database", async () => {
    state.dbAvailable = false;
    const { default: sitemap } = await import("@/app/sitemap");
    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/classifiers");
    expect(paths.filter((p) => p.startsWith("/classifiers/"))).toEqual([]);
  });

  it("lists listed classifiers and every chain from the database", async () => {
    state.dbAvailable = true;
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/classifiers/support-ticket-routing");
    expect(paths).toContain("/classifiers/chains/support-inbox-triage");
    expect(paths).not.toContain("/classifiers/hidden-one");
    expect(entries.find((e) => e.url.endsWith("/classifiers/support-ticket-routing"))?.lastModified).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
