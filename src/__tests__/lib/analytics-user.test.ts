import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAnalyticsUserId } from "@/lib/analytics-user";

describe("getAnalyticsUserId", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_ANALYTICS_ID = "G-TEST123";
    process.env.AUTH_SECRET = "secret-a";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns a stable 32-char hex id that does not contain the raw id", () => {
    const id = getAnalyticsUserId("cluser123");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain("cluser123");
    expect(getAnalyticsUserId("cluser123")).toBe(id);
  });

  it("differs per user and per secret", () => {
    const a = getAnalyticsUserId("user-a");
    expect(getAnalyticsUserId("user-b")).not.toBe(a);
    process.env.AUTH_SECRET = "secret-b";
    expect(getAnalyticsUserId("user-a")).not.toBe(a);
  });

  it("falls back to NEXTAUTH_SECRET", () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "legacy-secret";
    expect(getAnalyticsUserId("user-a")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns null without a user id, GA id, or secret", () => {
    expect(getAnalyticsUserId(undefined)).toBeNull();
    expect(getAnalyticsUserId("")).toBeNull();

    delete process.env.GOOGLE_ANALYTICS_ID;
    expect(getAnalyticsUserId("user-a")).toBeNull();

    process.env.GOOGLE_ANALYTICS_ID = "G-TEST123";
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(getAnalyticsUserId("user-a")).toBeNull();
  });
});
