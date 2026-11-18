/**
 * Host-dependent build settings, read by next.config.ts. Everything here is
 * decided when `next build` runs; values the browser needs are inlined.
 * Kept free of imports so next.config.ts can load it before anything else.
 */

type Env = Record<string, string | undefined>;

/**
 * - `vercel`: Vercel's Node runtime.
 * - `node`: `next start` or the standalone server (Docker, Railway, a VM).
 * - `spacefast`: an OpenNext worker isolate on Spacefast (no Node APIs, no TCP).
 */
export type DeployTarget = "vercel" | "node" | "spacefast";

const DEPLOY_TARGETS: readonly DeployTarget[] = ["vercel", "node", "spacefast"];

/** The Sentry project prompts.chat has always reported to; kept as the default on Vercel only */
export const LEGACY_SENTRY_DSN =
  "https://9c2eb3b4441745efad28a908001c30bf@o4510673866063872.ingest.de.sentry.io/4510673871306832";

export const DEFAULT_MAX_UPLOAD_MB = 4;

export function resolveDeployTarget(env: Env = process.env): DeployTarget {
  const configured = env.PCHAT_DEPLOY_TARGET?.trim().toLowerCase();
  if (configured) {
    if (!(DEPLOY_TARGETS as readonly string[]).includes(configured)) {
      throw new Error(`PCHAT_DEPLOY_TARGET must be one of ${DEPLOY_TARGETS.join(", ")}; got "${env.PCHAT_DEPLOY_TARGET}"`);
    }
    return configured as DeployTarget;
  }
  if (env.VERCEL) return "vercel";
  // `sf publish` points Next at its bundled adapter for the build
  if (/spacefast|e2b-next-adapter/i.test(env.NEXT_ADAPTER_PATH ?? "")) return "spacefast";
  return "node";
}

function parseSwitch(value: string | undefined, name: string): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  throw new Error(`${name} must be on or off; got "${value}"`);
}

export interface BuildConfig {
  target: DeployTarget;
  /** Empty when Sentry is off */
  sentryDsn: string;
  /** Server-side Sentry needs Node; worker isolates only report from the browser */
  sentryServer: boolean;
  imageOptimization: boolean;
  imageRemoteHosts: string[];
  maxUploadMb: number;
  /** Which "hosted on" badge the homepage shows, or "none" */
  hostingBadge: "vercel" | "none";
}

export function resolveBuildConfig(env: Env = process.env): BuildConfig {
  const target = resolveDeployTarget(env);

  const dsnSetting = env.NEXT_PUBLIC_SENTRY_DSN ?? env.SENTRY_DSN;
  const sentryDsn =
    dsnSetting === undefined
      ? target === "vercel" ? LEGACY_SENTRY_DSN : ""
      : ["", "off", "false", "0"].includes(dsnSetting.trim().toLowerCase()) ? "" : dsnSetting.trim();

  const imageOptimization = parseSwitch(env.PCHAT_IMAGE_OPTIMIZATION, "PCHAT_IMAGE_OPTIMIZATION") ?? target !== "spacefast";

  const imageRemoteHosts = (env.PCHAT_IMAGE_REMOTE_HOSTS ?? "**")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  const maxUploadMb = Number(env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);
  if (!Number.isFinite(maxUploadMb) || maxUploadMb <= 0) {
    throw new Error(`NEXT_PUBLIC_MAX_UPLOAD_MB must be a positive number; got "${env.NEXT_PUBLIC_MAX_UPLOAD_MB}"`);
  }

  const badgeSetting = env.NEXT_PUBLIC_HOSTING_BADGE?.trim().toLowerCase();
  if (badgeSetting && badgeSetting !== "vercel" && badgeSetting !== "none") {
    throw new Error(`NEXT_PUBLIC_HOSTING_BADGE must be vercel or none; got "${env.NEXT_PUBLIC_HOSTING_BADGE}"`);
  }
  const hostingBadge = (badgeSetting as BuildConfig["hostingBadge"] | undefined) ?? (target === "vercel" ? "vercel" : "none");

  return {
    target,
    sentryDsn,
    sentryServer: sentryDsn !== "" && target !== "spacefast",
    imageOptimization,
    imageRemoteHosts: imageRemoteHosts.length > 0 ? imageRemoteHosts : ["**"],
    maxUploadMb,
    hostingBadge,
  };
}
