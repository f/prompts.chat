import { describe, it, expect } from "vitest";
import { parsePromptsCsv, unescapeString } from "./parse-prompts";

describe("parse-prompts: parsePromptsCsv", () => {
  it("parses a simple row and skips the header", () => {
    const csv = `act,prompt,for_devs,type,contributor
Linux Terminal,"act as a linux terminal",TRUE,TEXT,f`;
    const rows = parsePromptsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      act: "Linux Terminal",
      prompt: "act as a linux terminal",
      for_devs: "TRUE",
      type: "TEXT",
      contributor: "f",
    });
  });

  it("handles escaped quotes and commas inside quoted fields", () => {
    const csv = `act,prompt,for_devs,type,contributor
Quoter,"He said ""hi, there""",FALSE,TEXT,someone`;
    const rows = parsePromptsCsv(csv);
    expect(rows[0].prompt).toBe('He said "hi, there"');
  });

  it("handles multi-line quoted fields", () => {
    const csv = `act,prompt,for_devs,type,contributor
Multi,"line one
line two",FALSE,TEXT,x`;
    const rows = parsePromptsCsv(csv);
    expect(rows[0].prompt).toBe("line one\nline two");
  });

  it("unescapes literal escape sequences", () => {
    expect(unescapeString("a\\nb\\tc")).toBe("a\nb\tc");
    expect(unescapeString("back\\\\slash")).toBe("back\\slash");
  });

  it("skips fully empty rows", () => {
    const csv = `act,prompt,for_devs,type,contributor
,,,,
Real,"content",TRUE,TEXT,f`;
    const rows = parsePromptsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].act).toBe("Real");
  });
});
