import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OUTPUT, renderBundledFiles } from "../../../scripts/generate-bundled-files.mjs";
import { readBundledDataUri, readBundledText } from "@/lib/bundled-files";
import { loadPrompt } from "@/lib/ai/load-prompt";

const ROOT = join(__dirname, "../../..");

describe("bundled files", () => {
  it("are in sync with the files they embed (run `npm run generate:bundled-files`)", () => {
    expect(readFileSync(join(ROOT, OUTPUT), "utf8")).toBe(renderBundledFiles(ROOT));
  });

  it("embed the skill files byte for byte", () => {
    const path = "plugins/claude/prompts.chat/skills/prompt-lookup/SKILL.md";
    expect(readBundledText(path)).toBe(readFileSync(join(ROOT, path), "utf8"));
  });

  it("embed bot logos as data URIs", () => {
    const uri = readBundledDataUri("public/bots/hermes.png", "image/png");
    expect(uri).toBe(`data:image/png;base64,${readFileSync(join(ROOT, "public/bots/hermes.png")).toString("base64")}`);
  });

  it("return undefined for files that were not embedded", () => {
    expect(readBundledText("package.json")).toBeUndefined();
    expect(readBundledText("__proto__")).toBeUndefined();
    expect(readBundledDataUri("public/logo.svg", "image/svg+xml")).toBeUndefined();
  });

  it("let loadPrompt read every .prompt.yml without the filesystem", () => {
    const prompt = loadPrompt("src/lib/ai/improve-prompt.prompt.yml");
    expect(prompt.messages.length).toBeGreaterThan(0);
  });
});
