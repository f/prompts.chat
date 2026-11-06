import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// jsdom is already installed for Vitest. Type only the DOM surface used here.
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, options: { runScripts: string; url: string }) => { window: Window & typeof globalThis };
};
import { compactDirectory, customize, exportCsv, importLibrary, MAX_IMPORT_BYTES, mergeLibrary, normalizeRows, parseCsv, searchLibrary } from "./index";
import { exportPortable } from "./export";

const sample = normalizeRows([
  { title: "Strategist", prompt: "Plan [TOPIC] for [TARGET MARKET]. Repeat [TOPIC].", category: "Business", subcategory: "Planning", tags: ["startup"], description: "Launch ideas" },
  { title: "Engineer", prompt: "Implement ${language:TypeScript} for ${task}", category: "Coding", subcategory: "Engineering", tags: ["software"] },
]);

describe("prompt library index", () => {
  it("searches every indexed field and intersects category/subcategory filters", () => {
    for (const query of ["Strategist", "TOPIC", "startup", "launch ideas", "Business", "Planning"]) expect(searchLibrary(sample, query)[0].title).toBe("Strategist");
    expect(searchLibrary(sample, "startup", "Coding")).toHaveLength(0);
    expect(searchLibrary(sample, "", "Business", "Planning")).toHaveLength(1);
    expect(searchLibrary(sample, "", "Business", "Engineering")).toHaveLength(0);
  });
  it("substitutes repeated placeholders and defaults, preserving originals and literal input", () => {
    expect(customize(sample[0].prompt, { TOPIC: "$& [TARGET MARKET]", "TARGET MARKET": "Manila" })).toBe("Plan $& [TARGET MARKET] for Manila. Repeat $& [TARGET MARKET].");
    expect(customize(sample[1].prompt, { task: "tests" })).toBe("Implement TypeScript for tests");
    expect(customize(sample[0].prompt, {})).toBe(sample[0].prompt);
    expect(customize("${constructor} [TOPIC]", {})).toBe("${constructor} [TOPIC]");
    expect(sample[0].variables).toEqual(["TOPIC", "TARGET MARKET"]);
  });
  it("parses BOM, CRLF, embedded quotes/newlines and roundtrips original text", () => {
    const original = '  quoted "word", line\r\nnext  ';
    const data = normalizeRows([{ title: "CSV", prompt: original, tags: ["a,b"], source: "https://example.org/p", updatedAt: "2026-01-01T00:00:00Z" }]);
    expect(importLibrary('\uFEFF' + exportCsv(data), "csv")).toEqual(data);
    expect(parseCsv('a,b\r\n"hello\nworld","a""b"\r\n')[1]).toEqual(["hello\nworld", 'a"b']);
  });
  it("keeps revisions distinct, deduplicates exact imports, and ignores untrusted supplied IDs", () => {
    expect(mergeLibrary(sample, importLibrary(JSON.stringify(sample), "json"))).toEqual(sample);
    const revision = normalizeRows([{ ...sample[0], id: sample[0].id, prompt: "Changed" }]);
    expect(mergeLibrary(sample, revision)).toHaveLength(3);
    expect(revision[0].version).not.toBe(sample[0].version);
  });
  it.each([
    ['{}', 'json'], ['[{"title":"missing"}]', 'json'], ['[{"title":"x","prompt":"y","source":"javascript:alert(1)"}]', 'json'],
    ['[{"title":"x","prompt":"y","tags":"wrong"}]', 'json'], ['title,prompt\nx,"unclosed', 'csv'], ['title,prompt\nx,"ok"junk', 'csv'],
    ['title,prompt\nx,y,z', 'csv'], ['title,title,prompt\nx,y,z', 'csv'], ['title,wrong\nx,y', 'csv'],
  ] as const)("rejects invalid imports: %s", (text, format) => expect(() => importLibrary(text, format)).toThrow());
  it("enforces byte and collection limits", () => {
    expect(() => importLibrary(" ".repeat(MAX_IMPORT_BYTES + 1), "json")).toThrow();
    expect(() => normalizeRows(Array(10001).fill({ title: "x", prompt: "y" }))).toThrow();
  });
  it("exports a smaller chat directory with stable lookup IDs", () => {
    const full = normalizeRows([{ title: "Long prompt", prompt: "x".repeat(10000) }]);
    const directory = compactDirectory(full);
    expect(directory[0].id).toBe(full[0].id);
    expect(directory[0].preview).toHaveLength(120);
    expect(directory[0]).not.toHaveProperty("prompt");
    expect(JSON.stringify(directory).length).toBeLessThan(JSON.stringify(full).length / 10);
  });
  it("handles a large collection", () => {
    const data = normalizeRows(Array.from({ length: 10000 }, (_, i) => ({ title: `Prompt ${i}`, prompt: `Unique text ${i}`, category: i % 2 ? "Odd" : "Even" })));
    expect(searchLibrary(data, "9999", "Odd")).toHaveLength(1);
  });
  it("loads actual repository CSV without changing or losing content", () => {
    const csv = readFileSync("prompts.csv", "utf8");
    const parsed = parseCsv(csv), data = importLibrary(csv, "csv");
    const promptColumn = parsed[0].indexOf("prompt");
    expect(data.length).toBeGreaterThan(100);
    const content = new Set(data.map(p => p.prompt));
    expect(parsed.slice(1).every(row => content.has(row[promptColumn]))).toBe(true);
  });
});

describe("portable HTML selector", () => {
  it("renders untrusted data safely and supports preview, search, category filtering, and copying", async () => {
    const data = normalizeRows([{ title: '</script><img src=x onerror="window.pwned=true">', prompt: '<script>window.pwned=true</script>', category: "Unsafe text" }, ...sample]);
    const dom = new JSDOM(exportPortable(data), { runScripts: "dangerously", url: "https://example.org" });
    const { document, Event } = dom.window;
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelector<HTMLTextAreaElement>("#text")?.value).toBe(data[0].prompt);
    const search = document.querySelector<HTMLInputElement>("#search")!;
    search.value = "software"; search.dispatchEvent(new Event("input"));
    expect(document.querySelector("#list")?.children).toHaveLength(1);
    expect(document.querySelector("#preview-title")?.textContent).toBe("Engineer");
    const category = document.querySelector<HTMLSelectElement>("#category")!;
    category.value = "Business"; category.dispatchEvent(new Event("change"));
    expect(document.querySelector("#list")?.children).toHaveLength(0);
    expect(document.querySelector<HTMLButtonElement>("#copy")?.disabled).toBe(true);
    search.value = ""; search.dispatchEvent(new Event("input"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(dom.window.navigator, "clipboard", { value: { writeText } });
    document.querySelector<HTMLButtonElement>("#copy")!.click();
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("Copied to clipboard."));
    expect(writeText).toHaveBeenCalledWith(sample[0].prompt);
    expect((dom.window as unknown as { pwned?: boolean }).pwned).toBeUndefined();
    dom.window.close();
  });
});
