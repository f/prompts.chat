import { describe, it, expect } from "vitest";
import { HF_DATASET_URL, HF_LISTING_QUERIES, hfQueryUrl } from "@/lib/hf-data-studio";

describe("HF_LISTING_QUERIES", () => {
  it("matches skills by their SKILL.md front matter or file separator", () => {
    expect(HF_LISTING_QUERIES.skills).toContain("name:");
    expect(HF_LISTING_QUERIES.skills).toContain("description:");
    expect(HF_LISTING_QUERIES.skills).toContain("concat(chr(31), 'FILE:')");
  });

  it("says bots and teams aren't in the dataset", () => {
    expect(HF_LISTING_QUERIES.bots).toMatch(/^-- Bots aren't in this dataset/);
    expect(HF_LISTING_QUERIES.teams).toMatch(/^-- Bot teams aren't in this dataset/);
  });

  it("avoids the backslashes, asterisks, || and quoted -- the dataset viewer mangles", () => {
    for (const sql of Object.values(HF_LISTING_QUERIES)) {
      expect(sql).not.toMatch(/[\\*]|\|\||'[^'\n]*--/);
    }
  });

  it("queries the train split", () => {
    for (const sql of Object.values(HF_LISTING_QUERIES)) {
      expect(sql).toMatch(/FROM\s+train\s/);
    }
  });
});

describe("hfQueryUrl", () => {
  it("opens the SQL console with the query", () => {
    const url = new URL(hfQueryUrl(HF_LISTING_QUERIES.skills));
    expect(`${url.origin}${url.pathname}`).toBe(HF_DATASET_URL);
    expect(url.searchParams.get("views[]")).toBe("train");
    expect(url.searchParams.get("sql")).toBe(HF_LISTING_QUERIES.skills);
  });
});
