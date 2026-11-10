import { describe, it, expect } from "vitest";
import { getDatabaseDriver, getDatabaseUrl } from "@/lib/db-config";
import { LEGACY_SENTRY_DSN, resolveBuildConfig, resolveDeployTarget } from "@/lib/build-config";
import { getAppUrl, getWebhookSiteUrl } from "@/lib/app-url";

const SPACEFAST_ADAPTER = "/home/me/.npm/_npx/abc/node_modules/spacefast/dist/e2b-next-adapter/dist/index.mjs";

describe("getDatabaseUrl", () => {
  it("prefers PCHAT_DATABASE_URL over DATABASE_URL", () => {
    expect(getDatabaseUrl({ PCHAT_DATABASE_URL: "postgres://a", DATABASE_URL: "postgres://b" })).toBe("postgres://a");
  });

  it("falls back to DATABASE_URL", () => {
    expect(getDatabaseUrl({ DATABASE_URL: "postgres://b" })).toBe("postgres://b");
    expect(getDatabaseUrl({ PCHAT_DATABASE_URL: "", DATABASE_URL: "postgres://b" })).toBe("postgres://b");
  });

  it("is undefined when neither is set", () => {
    expect(getDatabaseUrl({})).toBeUndefined();
  });
});

describe("getDatabaseDriver", () => {
  it("uses Prisma's engine on Node and Neon's driver in a worker", () => {
    expect(getDatabaseDriver({}, false)).toBe("prisma");
    expect(getDatabaseDriver({}, true)).toBe("neon");
  });

  it("honours PCHAT_DB_DRIVER", () => {
    expect(getDatabaseDriver({ PCHAT_DB_DRIVER: "neon" }, false)).toBe("neon");
    expect(getDatabaseDriver({ PCHAT_DB_DRIVER: " Prisma " }, true)).toBe("prisma");
  });

  it("rejects unknown drivers", () => {
    expect(() => getDatabaseDriver({ PCHAT_DB_DRIVER: "mysql" }, false)).toThrow(/PCHAT_DB_DRIVER/);
  });
});

describe("resolveDeployTarget", () => {
  it("detects Vercel, the Spacefast adapter and plain Node", () => {
    expect(resolveDeployTarget({ VERCEL: "1" })).toBe("vercel");
    expect(resolveDeployTarget({ NEXT_ADAPTER_PATH: SPACEFAST_ADAPTER })).toBe("spacefast");
    expect(resolveDeployTarget({})).toBe("node");
  });

  it("lets PCHAT_DEPLOY_TARGET override detection", () => {
    expect(resolveDeployTarget({ VERCEL: "1", PCHAT_DEPLOY_TARGET: "node" })).toBe("node");
    expect(() => resolveDeployTarget({ PCHAT_DEPLOY_TARGET: "heroku" })).toThrow(/PCHAT_DEPLOY_TARGET/);
  });
});

describe("resolveBuildConfig", () => {
  it("keeps prompts.chat's Vercel defaults", () => {
    expect(resolveBuildConfig({ VERCEL: "1" })).toEqual({
      target: "vercel",
      sentryDsn: LEGACY_SENTRY_DSN,
      sentryServer: true,
      imageOptimization: true,
      imageRemoteHosts: ["**"],
      maxUploadMb: 4,
      hostingBadge: "vercel",
    });
  });

  it("turns off Sentry, image optimization and the badge by default on Spacefast", () => {
    expect(resolveBuildConfig({ NEXT_ADAPTER_PATH: SPACEFAST_ADAPTER })).toMatchObject({
      target: "spacefast",
      sentryDsn: "",
      sentryServer: false,
      imageOptimization: false,
      hostingBadge: "none",
    });
  });

  it("reports only from the browser on Spacefast when a DSN is set", () => {
    const config = resolveBuildConfig({ NEXT_ADAPTER_PATH: SPACEFAST_ADAPTER, NEXT_PUBLIC_SENTRY_DSN: "https://k@sentry.example/1" });
    expect(config.sentryDsn).toBe("https://k@sentry.example/1");
    expect(config.sentryServer).toBe(false);
  });

  it("does not report to prompts.chat's Sentry from self-hosted Node builds", () => {
    expect(resolveBuildConfig({})).toMatchObject({ target: "node", sentryDsn: "", sentryServer: false, hostingBadge: "none" });
  });

  it("lets a DSN of off disable Sentry on Vercel", () => {
    expect(resolveBuildConfig({ VERCEL: "1", SENTRY_DSN: "off" })).toMatchObject({ sentryDsn: "", sentryServer: false });
  });

  it("parses image, upload and badge settings", () => {
    expect(
      resolveBuildConfig({
        PCHAT_IMAGE_OPTIMIZATION: "off",
        PCHAT_IMAGE_REMOTE_HOSTS: "cdn.example.com, *.githubusercontent.com,",
        NEXT_PUBLIC_MAX_UPLOAD_MB: "10",
        NEXT_PUBLIC_HOSTING_BADGE: "vercel",
      })
    ).toMatchObject({
      imageOptimization: false,
      imageRemoteHosts: ["cdn.example.com", "*.githubusercontent.com"],
      maxUploadMb: 10,
      hostingBadge: "vercel",
    });
  });

  it("rejects invalid settings", () => {
    expect(() => resolveBuildConfig({ PCHAT_IMAGE_OPTIMIZATION: "maybe" })).toThrow(/PCHAT_IMAGE_OPTIMIZATION/);
    expect(() => resolveBuildConfig({ NEXT_PUBLIC_MAX_UPLOAD_MB: "-1" })).toThrow(/NEXT_PUBLIC_MAX_UPLOAD_MB/);
    expect(() => resolveBuildConfig({ NEXT_PUBLIC_HOSTING_BADGE: "netlify" })).toThrow(/NEXT_PUBLIC_HOSTING_BADGE/);
  });
});

describe("app URLs", () => {
  it("uses the Auth.js URL first for site URLs", () => {
    expect(getAppUrl({ NEXTAUTH_URL: "https://a.example/", NEXT_PUBLIC_APP_URL: "https://b.example" })).toBe("https://a.example");
    expect(getAppUrl({ AUTH_URL: "https://a.example" })).toBe("https://a.example");
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: "https://b.example" })).toBe("https://b.example");
  });

  it("uses NEXT_PUBLIC_APP_URL first for webhooks", () => {
    expect(getWebhookSiteUrl({ NEXTAUTH_URL: "https://a.example", NEXT_PUBLIC_APP_URL: "https://b.example/" })).toBe("https://b.example");
    expect(getWebhookSiteUrl({ AUTH_URL: "https://a.example" })).toBe("https://a.example");
  });

  it("falls back to the Vercel production domain, then localhost", () => {
    expect(getAppUrl({ VERCEL_PROJECT_PRODUCTION_URL: "prompts.chat" })).toBe("https://prompts.chat");
    expect(getWebhookSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "prompts.chat" })).toBe("https://prompts.chat");
    expect(getAppUrl({ PORT: "8080" })).toBe("http://localhost:8080");
    expect(getAppUrl({})).toBe("http://localhost:3000");
  });
});
