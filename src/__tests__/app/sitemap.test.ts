import { describe, it, expect, vi } from "vitest";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" }, features: {}, homepage: {} },
}));


vi.mock("@/lib/book/chapters", () => ({ getAllChapters: () => [] }));

describe("sitemap", () => {
  it("should revalidate every 5 minutes", async () => {
    const { revalidate } = await import("@/app/sitemap");
    expect(revalidate).toBe(300);
  });
});
