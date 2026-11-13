import { describe, it, expect, vi, afterEach } from "vitest";

vi.unmock("@/lib/config");

async function loadConfig() {
  vi.resetModules();
  const { getConfig } = await import("@/lib/config");
  return getConfig();
}

describe("features.webmcp", () => {
  afterEach(() => {
    delete process.env.PCHAT_FEATURE_WEBMCP;
  });

  it("is on by default", async () => {
    expect((await loadConfig()).features.webmcp).toBe(true);
  });

  it.each([
    ["false", false],
    ["0", false],
    ["true", true],
    ["1", true],
  ])("PCHAT_FEATURE_WEBMCP=%s sets it to %s", async (value, expected) => {
    process.env.PCHAT_FEATURE_WEBMCP = value;
    expect((await loadConfig()).features.webmcp).toBe(expected);
  });
});
