import { describe, it, expect } from "vitest";
import { parseLimit } from "@/lib/pagination";

const opts = { defaultValue: 10, max: 50 };

describe("parseLimit", () => {
  it("returns the default for missing input", () => {
    expect(parseLimit(null, opts)).toBe(10);
    expect(parseLimit(undefined, opts)).toBe(10);
    expect(parseLimit("", opts)).toBe(10);
    expect(parseLimit("   ", opts)).toBe(10);
  });

  it("returns the default for non-integer input instead of NaN", () => {
    expect(parseLimit("abc", opts)).toBe(10);
    expect(parseLimit("10abc", opts)).toBe(10);
    expect(parseLimit("1.5", opts)).toBe(10);
    expect(parseLimit("1e3", opts)).toBe(10);
    expect(parseLimit("NaN", opts)).toBe(10);
  });

  it("parses valid integers", () => {
    expect(parseLimit("5", opts)).toBe(5);
    expect(parseLimit(" 25 ", opts)).toBe(25);
    expect(parseLimit("50", opts)).toBe(50);
  });

  it("clamps values above max", () => {
    expect(parseLimit("51", opts)).toBe(50);
    expect(parseLimit("1000000000", opts)).toBe(50);
  });

  it("clamps values above Number.MAX_SAFE_INTEGER to max", () => {
    expect(parseLimit("99999999999999999999999", opts)).toBe(50);
  });

  it("clamps zero and negative values to min (default 1)", () => {
    expect(parseLimit("0", opts)).toBe(1);
    expect(parseLimit("-5", opts)).toBe(1);
  });

  it("respects a custom min", () => {
    expect(parseLimit("2", { ...opts, min: 5 })).toBe(5);
    expect(parseLimit("-1", { ...opts, min: 0 })).toBe(0);
  });
});
