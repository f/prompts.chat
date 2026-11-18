import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as headerGET, POST as headerPOST } from "@/app/api/cron/reset-credits/route";
import { GET as pathGET } from "@/app/api/cron/reset-credits/[token]/route";
import { secretsMatch } from "@/lib/cron";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: { $executeRaw: vi.fn() },
}));

function headerRequest(authorization?: string, method = "POST") {
  return new NextRequest("http://localhost:3000/api/cron/reset-credits", {
    method,
    headers: authorization ? { authorization } : {},
  });
}

function pathRequest(token: string) {
  return [
    new Request(`http://localhost:3000/api/cron/reset-credits/${token}`),
    { params: Promise.resolve({ token }) },
  ] as const;
}

describe("secretsMatch", () => {
  it("matches only identical strings", () => {
    expect(secretsMatch("s3cret", "s3cret")).toBe(true);
    expect(secretsMatch("s3cre", "s3cret")).toBe(false);
    expect(secretsMatch("s3cret!", "s3cret")).toBe(false);
    expect(secretsMatch("", "s3cret")).toBe(false);
    expect(secretsMatch(null, "s3cret")).toBe(false);
  });
});

describe("cron reset-credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.$executeRaw).mockResolvedValue(3 as never);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("with an Authorization header", () => {
    it("resets credits for the right secret on POST and GET", async () => {
      vi.stubEnv("CRON_SECRET", "s3cret");
      for (const response of [await headerPOST(headerRequest("Bearer s3cret")), await headerGET(headerRequest("Bearer s3cret", "GET"))]) {
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, usersUpdated: 3 });
      }
      expect(db.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it("rejects a wrong or missing secret", async () => {
      vi.stubEnv("CRON_SECRET", "s3cret");
      expect((await headerPOST(headerRequest("Bearer nope"))).status).toBe(401);
      expect((await headerPOST(headerRequest())).status).toBe(401);
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it("fails closed without CRON_SECRET", async () => {
      vi.stubEnv("CRON_SECRET", "");
      expect((await headerPOST(headerRequest("Bearer "))).status).toBe(500);
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe("with a path token", () => {
    it("resets credits for the right token", async () => {
      vi.stubEnv("CRON_PATH_TOKEN", "path-token");
      const response = await pathGET(...pathRequest("path-token"));
      expect(response.status).toBe(200);
      expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it("rejects a wrong token", async () => {
      vi.stubEnv("CRON_PATH_TOKEN", "path-token");
      expect((await pathGET(...pathRequest("path-tokem"))).status).toBe(401);
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it("does not exist without CRON_PATH_TOKEN, even when CRON_SECRET is set", async () => {
      vi.stubEnv("CRON_PATH_TOKEN", "");
      vi.stubEnv("CRON_SECRET", "s3cret");
      expect((await pathGET(...pathRequest("s3cret"))).status).toBe(404);
      expect((await pathGET(...pathRequest(""))).status).toBe(404);
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });
  });

  it("reports a database failure", async () => {
    vi.stubEnv("CRON_PATH_TOKEN", "path-token");
    vi.mocked(db.$executeRaw).mockRejectedValue(new Error("down") as never);
    const response = await pathGET(...pathRequest("path-token"));
    expect(response.status).toBe(500);
  });
});
