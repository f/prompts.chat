type Env = Record<string, string | undefined>;

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Origin used when nothing is configured: Vercel's production domain on
 * Vercel (the shortest production domain, e.g. prompts.chat), else localhost.
 */
function fallbackUrl(env: Env): string {
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${env.PORT || 3000}`;
}

/**
 * The public origin of this instance for canonical, sitemap and structured
 * data URLs, without a trailing slash. The Auth.js URL (`NEXTAUTH_URL` /
 * `AUTH_URL`) wins over `NEXT_PUBLIC_APP_URL`.
 */
export function getAppUrl(env: Env = process.env): string {
  return withoutTrailingSlash(env.NEXTAUTH_URL || env.AUTH_URL || env.NEXT_PUBLIC_APP_URL || fallbackUrl(env));
}

/**
 * The origin sent to webhook receivers, without a trailing slash.
 * `NEXT_PUBLIC_APP_URL` wins over the Auth.js URL.
 */
export function getWebhookSiteUrl(env: Env = process.env): string {
  return withoutTrailingSlash(env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || env.AUTH_URL || fallbackUrl(env));
}
